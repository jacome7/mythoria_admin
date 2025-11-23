import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { ALLOWED_DOMAINS } from '@/config/auth';
import { TicketService } from '@/lib/ticketing/service';
import type { TicketMetadata } from '@/lib/ticketing/types';
import { getMythoriaDb } from '@/db';
import { paymentOrders, paymentEvents } from '@/db/schema/payments';
import { creditLedger, authorCreditBalances } from '@/db/schema/credits';
import { sql } from 'drizzle-orm';
import { notificationClient } from '@/lib/notifications/client';
import { adminService } from '@/db/services';
import { ga4Service } from '@/lib/analytics/ga4';

const FIVE_DAYS_MS = 5 * 24 * 60 * 60 * 1000;

type AllowedAction = 'confirmPayment' | 'paymentNotReceived';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const isAllowedDomain = ALLOWED_DOMAINS.some((domain) => session.user!.email!.endsWith(domain));
  if (!isAllowedDomain) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id: ticketId } = await params;
  const { action } = (await request.json().catch(() => ({}))) as { action?: AllowedAction };

  if (action !== 'confirmPayment' && action !== 'paymentNotReceived') {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  }

  const ticket = await TicketService.getTicketById(ticketId);
  if (!ticket) {
    return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
  }

  const metadata = (ticket.metadata || {}) as TicketMetadata;
  if (ticket.category !== 'payment_request' || metadata.paymentMethod !== 'mbway') {
    return NextResponse.json(
      { error: 'Action only available for MB Way payment tickets' },
      { status: 400 },
    );
  }

  if (metadata.mbwayPayment?.status === 'confirmed') {
    return NextResponse.json(
      { error: 'Payment already confirmed for this ticket' },
      { status: 409 },
    );
  }

  if (metadata.mbwayPayment?.status === 'not_received') {
    return NextResponse.json(
      { error: 'Ticket already marked as payment not received' },
      { status: 409 },
    );
  }

  if (ticket.status === 'resolved' || ticket.status === 'closed') {
    return NextResponse.json({ error: 'This ticket has already been completed.' }, { status: 409 });
  }

  if (action === 'confirmPayment') {
    try {
      await confirmMbwayPayment(ticket, metadata, session.user.email!);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Unable to confirm MB Way payment for this ticket.';
      return NextResponse.json({ error: message }, { status: 400 });
    }
  } else {
    const createdAtMs = new Date(ticket.createdAt).getTime();
    if (Date.now() - createdAtMs < FIVE_DAYS_MS) {
      return NextResponse.json(
        { error: 'Please wait 5 days before marking the payment as not received.' },
        { status: 400 },
      );
    }

    await closeMbwayTicket(ticket, metadata, session.user.email!);
  }

  const updatedTicket = await TicketService.getTicketById(ticketId);
  return NextResponse.json(updatedTicket, { status: 200 });
}

async function confirmMbwayPayment(
  ticket: Awaited<ReturnType<typeof TicketService.getTicketById>>,
  metadata: TicketMetadata,
  actorEmail: string,
) {
  if (!ticket) {
    throw new Error('Ticket not found');
  }

  const authorId = metadata.author?.id || ticket.userId;
  if (!authorId) {
    throw new Error('Ticket is missing a linked user.');
  }

  const credits = typeof metadata.credits === 'number' ? metadata.credits : null;
  const amount = typeof metadata.amount === 'number' ? metadata.amount : null;
  if (!credits || credits <= 0 || !amount || amount <= 0) {
    throw new Error('Ticket metadata is missing the amount or credits.');
  }

  const mythoriaDb = getMythoriaDb();
  const now = new Date();
  let orderId: string | null = null;

  await mythoriaDb.transaction(async (tx) => {
    const [order] = await tx
      .insert(paymentOrders)
      .values({
        authorId,
        amount: Math.round(amount * 100),
        currency: 'EUR',
        status: 'completed',
        provider: 'other',
        providerOrderId: `MBWAY-${ticket.id}`,
        creditBundle: {
          credits,
          price: amount,
          packages: metadata.creditPackages || [],
        },
        metadata: {
          ticketId: ticket.id,
          paymentMethod: 'mbway',
          confirmedBy: actorEmail,
        },
      })
      .returning({ orderId: paymentOrders.orderId });

    orderId = order.orderId;

    await tx.insert(paymentEvents).values([
      {
        orderId: orderId!,
        eventType: 'order_created',
        data: { ticketId: ticket.id, origin: 'mbway-admin' },
      },
      {
        orderId: orderId!,
        eventType: 'payment_completed',
        data: { ticketId: ticket.id, confirmedBy: actorEmail },
      },
    ]);

    await tx.insert(creditLedger).values({
      authorId,
      amount: credits,
      creditEventType: 'creditPurchase',
      purchaseId: orderId!,
    });

    await tx
      .insert(authorCreditBalances)
      .values({
        authorId,
        totalCredits: credits,
        lastUpdated: now,
      })
      .onConflictDoUpdate({
        target: authorCreditBalances.authorId,
        set: {
          totalCredits: sql`${authorCreditBalances.totalCredits} + ${credits}`,
          lastUpdated: now,
        },
      });
  });

  const updatedMetadata: TicketMetadata = {
    ...metadata,
    mbwayPayment: {
      ...(metadata.mbwayPayment || {}),
      status: 'confirmed',
      updatedAt: now.toISOString(),
      updatedBy: actorEmail,
      paymentOrderId: orderId || undefined,
      requestedAt: metadata.mbwayPayment?.requestedAt || metadata.requestedAt,
    },
  };

  await TicketService.updateMetadata(ticket.id, updatedMetadata);
  await TicketService.updateStatus(ticket.id, 'resolved');

  // Send GA4 Purchase Event
  try {
    // Extract analytics data from metadata if available
    const analyticsData = metadata.analytics ?? {};

    await ga4Service.sendPurchaseEvent({
      user_id: authorId,
      client_id: analyticsData.client_id,
      session_id: analyticsData.session_id,
      transaction_id: orderId || `MBWAY-${ticket.id}`,
      value: amount,
      currency: 'EUR',
      items: [
        {
          item_id: `credits-${credits}`,
          item_name: `${credits} Credits Bundle`,
          price: amount,
          quantity: 1,
        },
      ],
    });
  } catch (error) {
    console.error('Failed to send GA4 purchase event:', error);
  }

  // Send notification to user
  try {
    const user = await adminService.getUserById(authorId);
    if (user && user.email) {
      await notificationClient.sendCreditsAddedNotification({
        email: user.email,
        name: user.displayName || user.email,
        credits: credits,
        preferredLocale: user.preferredLocale,
        authorId: authorId,
        source: 'mbway',
        entityId: ticket.id,
      });
    }
  } catch (error) {
    console.error('Failed to send notification:', error);
    // Don't fail the request if notification fails
  }
}

async function closeMbwayTicket(
  ticket: Awaited<ReturnType<typeof TicketService.getTicketById>>,
  metadata: TicketMetadata,
  actorEmail: string,
) {
  if (!ticket) {
    return;
  }

  const nowIso = new Date().toISOString();
  const updatedMetadata: TicketMetadata = {
    ...metadata,
    mbwayPayment: {
      ...(metadata.mbwayPayment || {}),
      status: 'not_received',
      updatedAt: nowIso,
      updatedBy: actorEmail,
      requestedAt: metadata.mbwayPayment?.requestedAt || metadata.requestedAt,
    },
  };

  await TicketService.updateMetadata(ticket.id, updatedMetadata);
  await TicketService.updateStatus(ticket.id, 'closed', { suppressNotification: true });
}
