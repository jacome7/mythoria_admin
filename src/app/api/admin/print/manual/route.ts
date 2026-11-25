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
  proofVersion: z.number().int().positive(),
  checkedInbox: z.literal(true),
  subject: z.string().trim().min(1).max(255),
  bodyText: z.string().trim().min(1).max(10000),
});

const artifactSchema = z.object({
  generation: z.string().regex(/^\d+$/),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
});

const reservationSchema = z.object({
  reservationId: z.uuid(),
  interiorUri: z.string().startsWith('gs://'),
  coverUri: z.string().startsWith('gs://'),
  proofFiles: z.object({ interior: artifactSchema, cover: artifactSchema }),
  squareOrder: z
    .object({
      copies: z.number().int().min(1).max(10),
      proofOnly: z.boolean(),
      shipping: z.object({
        name: z.string(),
        street1: z.string(),
        street2: z.string().optional(),
        city: z.string(),
        postcode: z.string(),
        country_code: z.string(),
        state_code: z.string().optional(),
        phone_number: z.string(),
        email: z.email(),
        recipient_tax_id: z.string().optional(),
      }),
    })
    .optional(),
  downloadLinks: z
    .object({
      interior: z.url({ protocol: /^https$/ }),
      cover: z.url({ protocol: /^https$/ }),
    })
    .optional(),
});

export async function POST(request: Request) {
  const actor = await authenticateAdmin();
  if ('error' in actor) return actor.error;
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin)
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return Response.json({ error: 'Invalid manual print request' }, { status: 400 });
  const { ticketId, partnerId, proofVersion, checkedInbox, subject, bodyText } = parsed.data;
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
    if (
      !partner ||
      partner.type !== 'printer' ||
      partner.status !== 'active' ||
      !partner.email ||
      !z.email().safeParse(partner.email).success
    ) {
      return Response.json(
        { error: 'An active printer with a valid email is required' },
        { status: 400 },
      );
    }
    const url = process.env.NOTIFICATION_ENGINE_URL;
    const apiKey = process.env.NOTIFICATION_ENGINE_API_KEY;
    if (!url || !apiKey)
      return Response.json({ error: 'Notification engine is not configured' }, { status: 503 });
    const emailEndpoint = new URL('/email/admin-print-request', url);
    await logAdminAudit({
      actorEmail: actor.email,
      action: 'print.manual_dispatch',
      entityType: 'print',
      entityId: ticketId,
      metadata: { partnerId, printRequestId, proofVersion },
    });
    const reservation = reservationSchema.parse(
      await callPrintDomain(
        'reserveManual',
        { printRequestId, ticketId, partnerId, proofVersion, checkedInbox },
        actor.email,
      ),
    );
    let outcome: 'sent' | 'uncertain' = 'uncertain';
    let message = bodyText;
    if (reservation.squareOrder) {
      const { copies, proofOnly, shipping } = reservation.squareOrder;
      message = [
        bodyText,
        '',
        proofOnly ? 'Prova de produção' : 'Encomenda',
        `Exemplares: ${copies} · Capa dura quadrada, 8,5 × 8,5 pol. (216 × 216 mm)`,
        `Versão da prova: ${proofVersion}`,
        '',
        'Morada de entrega',
        shipping.name,
        shipping.street1,
        shipping.street2,
        [shipping.postcode, shipping.city, shipping.state_code].filter(Boolean).join(' '),
        shipping.country_code,
        shipping.phone_number,
        shipping.email,
        shipping.recipient_tax_id ? `NIF do destinatário: ${shipping.recipient_tax_id}` : undefined,
      ]
        .filter((line) => line !== undefined)
        .join('\n');
    }
    try {
      const response = await fetch(emailEndpoint, {
        method: 'POST',
        redirect: 'error',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'Idempotency-Key': `manual-print:${reservation.reservationId}`,
        },
        body: JSON.stringify({
          toEmail: partner.email,
          subject,
          bodyText: message,
          coverPdfUri: reservation.coverUri,
          interiorPdfUri: reservation.interiorUri,
          proofFiles: reservation.proofFiles,
          downloadLinks: reservation.downloadLinks,
        }),
        signal: AbortSignal.timeout(30000),
      });
      const result = await response.json().catch(() => null);
      if (response.ok && result?.data?.deliveryStatus === 'sent') outcome = 'sent';
    } catch {
      /* An unknown delivery outcome must never be retried automatically. */
    }
    await logAdminAudit({
      actorEmail: actor.email,
      action: 'print.manual_dispatch_result',
      entityType: 'print',
      entityId: ticketId,
      metadata: {
        partnerId,
        printRequestId,
        proofVersion,
        reservationId: reservation.reservationId,
        outcome,
      },
    });
    let data: unknown;
    try {
      data = await callPrintDomain(
        'finalizeManual',
        { printRequestId, ticketId, reservationId: reservation.reservationId, outcome },
        actor.email,
      );
    } catch (error) {
      console.error('Could not finalize manual print dispatch', {
        ticketId,
        reservationId: reservation.reservationId,
        outcome,
        error,
      });
      return Response.json(
        {
          error: 'The dispatch was attempted. Investigate the delivery before any further action.',
        },
        { status: 502 },
      );
    }
    return Response.json({ data, outcome }, { headers: { 'Cache-Control': 'private, no-store' } });
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
