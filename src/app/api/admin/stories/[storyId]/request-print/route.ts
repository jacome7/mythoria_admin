import { createHash } from 'node:crypto';
import { hasTrustedAdminOrigin } from '@/lib/admin-request-origin';
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getBackofficeDb, getMythoriaDb } from '@/db';
import { partners, stories } from '@/db/schema';
import { tickets } from '@/db/schema/tickets';
import { and, eq, sql } from 'drizzle-orm';
import { authenticateAdmin, proxyToNotificationEngine } from '@/lib/api-helpers';
import { LegacyPrintConflict, TicketService } from '@/lib/ticketing/service';
import type { TicketMetadata } from '@/lib/ticketing/types';
import { callPrintDomain, PrintDomainError } from '@/services/print';

const confirmedDelivery = z.object({
  success: z.literal(true),
  data: z.object({ deliveryStatus: z.literal('sent') }),
});

const requestPrintSchema = z.object({
  partnerId: z.string().uuid('Invalid partner ID'),
  subject: z.string().min(1, 'Subject is required'),
  bodyText: z.string().min(1, 'Body is required'),
  coverPdfUri: z.string().url('Invalid Cover PDF URI'),
  interiorPdfUri: z.string().url('Invalid Interior PDF URI'),
  legacyTicketId: z.uuid().toLowerCase(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ storyId: string }> },
) {
  try {
    const actor = await authenticateAdmin();
    if ('error' in actor) return actor.error;
    if (!hasTrustedAdminOrigin(request))
      return Response.json({ error: 'Forbidden' }, { status: 403 });

    const { storyId } = await params;
    if (!z.uuid().safeParse(storyId).success) {
      return Response.json({ error: 'A valid story ID is required' }, { status: 400 });
    }

    const parsed = requestPrintSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return Response.json(
        { error: parsed.error.issues[0]?.message ?? 'Invalid payload.' },
        { status: 400 },
      );
    }

    const { partnerId, subject, bodyText, coverPdfUri, interiorPdfUri, legacyTicketId } =
      parsed.data;
    const legacyTicket = await TicketService.getTicketById(legacyTicketId);
    const metadata = legacyTicket?.metadata as TicketMetadata | null;
    if (
      legacyTicket?.category !== 'print_request' ||
      !['open', 'in_progress'].includes(legacyTicket.status) ||
      metadata?.storyId?.toLowerCase() !== storyId.toLowerCase() ||
      metadata.printRequestId
    ) {
      return Response.json(
        { error: 'An open legacy print ticket for this story is required.' },
        { status: 409 },
      );
    }

    const linked = await getBackofficeDb()
      .select({ id: tickets.id })
      .from(tickets)
      .where(
        and(
          eq(tickets.category, 'print_request'),
          sql`${tickets.metadata}->>'storyId' = ${storyId.toLowerCase()}`,
          sql`${tickets.metadata}->>'printRequestId' is not null`,
          sql`${tickets.metadata}->>'proofOnly' is null`,
          sql`${tickets.metadata}->>'adminPrintOrder' is null`,
        ),
      )
      .limit(1);
    let paidOrderExists = linked.length > 0;
    if (!paidOrderExists && process.env.PRINT_INTERNAL_AUDIENCE) {
      const result = await callPrintDomain<unknown>(
        'hasPaidOrderForStory',
        {
          storyId,
        },
        actor.email,
      );
      if (typeof result !== 'boolean')
        throw new PrintDomainError(502, 'The print service could not verify this story');
      paidOrderExists = result;
    }
    if (paidOrderExists) {
      return Response.json(
        {
          code: 'print_legacy_compare',
          error:
            'Compare the paid orders from the original legacy ticket before choosing how to fulfill this shipment.',
        },
        { status: 409 },
      );
    }

    const db = getMythoriaDb();
    const [story] = await db
      .select({
        coverPdfUri: stories.coverPdfUri,
        interiorPdfUri: stories.interiorPdfUri,
        features: stories.features,
      })
      .from(stories)
      .where(eq(stories.storyId, storyId))
      .limit(1);
    if (!story) return Response.json({ error: 'Story not found' }, { status: 404 });
    if (story.features && typeof story.features === 'object' && 'premiumBook' in story.features) {
      return Response.json(
        { error: 'Square hardcover orders can only be released from their paid print ticket.' },
        { status: 409 },
      );
    }
    if (story.coverPdfUri !== coverPdfUri || story.interiorPdfUri !== interiorPdfUri) {
      return Response.json(
        { error: 'The print files changed. Reopen the story to review its current files.' },
        { status: 409 },
      );
    }
    const partner = await db.select().from(partners).where(eq(partners.id, partnerId)).limit(1);

    if (!partner || partner.length === 0) {
      return Response.json({ error: 'Partner not found' }, { status: 404 });
    }

    const partnerEmail = partner[0].email;
    if (!partnerEmail) {
      return Response.json({ error: 'Partner does not have an email configured' }, { status: 400 });
    }

    const notificationPayload = {
      toEmail: partnerEmail,
      subject,
      bodyText,
      coverPdfUri,
      interiorPdfUri,
    };
    const fingerprint = createHash('sha256')
      .update(JSON.stringify(notificationPayload))
      .digest('hex');
    const reservation = await TicketService.reserveLegacyPrintDispatch(
      legacyTicketId,
      storyId,
      fingerprint,
    );
    if (reservation.alreadySent) return Response.json({ success: true });
    const uncertain = () =>
      Response.json(
        {
          error:
            'Printer delivery is unconfirmed. Check the printer inbox and the original ticket before taking further action.',
        },
        { status: 503 },
      );
    let outcome: 'sent' | 'uncertain' = 'uncertain';
    try {
      const response = await proxyToNotificationEngine('/email/admin-print-request', {
        method: 'POST',
        body: notificationPayload,
        idempotencyKey: `legacy-print:${reservation.reservationId}`,
        preserveStatus: true,
      });
      if (
        response.status !== 200 ||
        !confirmedDelivery.safeParse(
          await response
            .clone()
            .json()
            .catch(() => null),
        ).success
      )
        return uncertain();
      outcome = 'sent';
      return response;
    } catch {
      return uncertain();
    } finally {
      await TicketService.finishLegacyPrintDispatch(
        legacyTicketId,
        reservation.reservationId,
        outcome,
      );
    }
  } catch (error) {
    if (error instanceof LegacyPrintConflict) {
      return Response.json({ error: error.message }, { status: 409 });
    }
    if (error instanceof PrintDomainError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    console.error('Legacy printer dispatch could not be recorded');
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
