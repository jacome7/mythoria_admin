import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { getMythoriaDb } from '@/db';
import { partners } from '@/db/schema';
import { authenticateAdmin } from '@/lib/api-helpers';
import { logAdminAudit } from '@/lib/audit';
import { TicketService } from '@/lib/ticketing/service';
import type { TicketMetadata } from '@/lib/ticketing/types';
import { callPrintDomain, PrintDomainError } from '@/services/print';

const schema = z.object({
  ticketId: z.string().uuid(),
  partnerId: z.string().uuid(),
  subject: z.string().trim().min(1).max(255),
  bodyText: z.string().trim().min(1).max(10000),
});

export async function POST(request: Request) {
  const actor = await authenticateAdmin();
  if ('error' in actor) return actor.error;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return Response.json({ error: 'Invalid manual print request' }, { status: 400 });
  const { ticketId, partnerId, subject, bodyText } = parsed.data;
  try {
    const ticket = await TicketService.getTicketById(ticketId);
    const printRequestId = (ticket?.metadata as TicketMetadata | null)?.printRequestId;
    if (!ticket || ticket.category !== 'print_request' || !printRequestId)
      return Response.json({ error: 'Linked print request not found' }, { status: 404 });
    if (['resolved', 'closed'].includes(ticket.status))
      return Response.json({ error: 'Ticket is closed or resolved' }, { status: 409 });
    const [partner] = await getMythoriaDb()
      .select()
      .from(partners)
      .where(eq(partners.id, partnerId))
      .limit(1);
    if (!partner || partner.type !== 'printer' || !partner.email)
      return Response.json({ error: 'Printer email not found' }, { status: 400 });
    const url = process.env.NOTIFICATION_ENGINE_URL;
    if (!url || !process.env.NOTIFICATION_ENGINE_API_KEY)
      return Response.json({ error: 'Notification engine is not configured' }, { status: 503 });
    await logAdminAudit({
      actorEmail: actor.email,
      action: 'print.manual_dispatch',
      entityType: 'print',
      entityId: ticketId,
      metadata: { partnerId },
    });
    const reservation = await callPrintDomain<{
      reservationId: string;
      interiorUri: string;
      coverUri: string;
      downloadLinks?: { interior: string; cover: string };
    }>('reserveManual', { printRequestId, ticketId, partnerId }, actor.email);
    let outcome: 'sent' | 'uncertain' = 'uncertain';
    try {
      const response = await fetch(`${url.replace(/\/$/, '')}/email/admin-print-request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.NOTIFICATION_ENGINE_API_KEY,
          'Idempotency-Key': `manual-print:${reservation.reservationId}`,
        },
        body: JSON.stringify({
          toEmail: partner.email,
          subject,
          bodyText,
          coverPdfUri: reservation.coverUri,
          interiorPdfUri: reservation.interiorUri,
          downloadLinks: reservation.downloadLinks,
        }),
        signal: AbortSignal.timeout(30000),
      });
      const result = await response.json().catch(() => null);
      if (response.ok && result?.data?.deliveryStatus === 'sent') outcome = 'sent';
    } catch {
      /* An unknown delivery outcome must never be retried automatically. */
    }
    const data = await callPrintDomain(
      'finalizeManual',
      { printRequestId, ticketId, reservationId: reservation.reservationId, outcome },
      actor.email,
    );
    return Response.json({ data, outcome });
  } catch (error) {
    if (error instanceof PrintDomainError)
      return Response.json({ error: error.message }, { status: error.status });
    console.error('Manual print dispatch failed', { ticketId, error });
    return Response.json(
      { error: 'Manual dispatch could not be confirmed. Check the ticket before retrying.' },
      { status: 500 },
    );
  }
}
