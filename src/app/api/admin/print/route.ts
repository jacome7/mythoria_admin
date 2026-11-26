import { hasTrustedAdminOrigin } from '@/lib/admin-request-origin';
import { z } from 'zod';
import { authenticateAdmin } from '@/lib/api-helpers';
import { logAdminAudit } from '@/lib/audit';
import { TicketService } from '@/lib/ticketing/service';
import type { TicketMetadata } from '@/lib/ticketing/types';
import { callPrintDomain, PrintDomainError } from '@/services/print';

type PrintSettings = {
  defaultProvider: string;
  maxEurPerCopy: number;
  hardcoverCredits: number | null;
  savedHardcoverCredits?: number | null;
};
function auditSettings(settings: PrintSettings) {
  return {
    defaultProvider: settings.defaultProvider,
    maxEurPerCopy: settings.maxEurPerCopy,
    hardcoverCredits: settings.hardcoverCredits,
    savedHardcoverCredits: settings.savedHardcoverCredits ?? null,
  };
}

const requestSchema = z.discriminatedUnion('operation', [
  z.object({ operation: z.literal('getConfig') }),
  z.object({
    operation: z.literal('setConfig'),
    defaultProvider: z.enum(['none', 'lulu']),
    maxEurPerCopy: z.number().min(0).max(99999999.99).finite(),
    hardcoverCredits: z.number().int().positive().max(1000000).nullable().optional(),
  }),
  ...(['get', 'clear', 'revise', 'reconcile'] as const).map((operation) =>
    z.object({ operation: z.literal(operation), ticketId: z.string().uuid() }),
  ),
  z.object({
    operation: z.literal('prepare'),
    ticketId: z.string().uuid(),
    runImmediately: z.boolean().optional(),
  }),
  z.object({
    operation: z.literal('cancel'),
    ticketId: z.string().uuid(),
    reason: z.string().trim().min(1).max(500),
  }),
  z.object({
    operation: z.literal('select'),
    ticketId: z.string().uuid(),
    provider: z.enum(['manual', 'lulu']),
  }),
  z.object({
    operation: z.literal('hold'),
    ticketId: z.string().uuid(),
    reason: z.string().trim().min(1).max(500),
  }),
  z.object({
    operation: z.literal('submit'),
    ticketId: z.string().uuid(),
    confirmationId: z.uuid(),
    checkedInbox: z.literal(true),
    confirmedTotalEur: z.number().positive().finite(),
    proofVersion: z.number().int().positive().optional(),
  }),
  z.object({
    operation: z.literal('correctSquareEdition'),
    ticketId: z.uuid(),
    expectedRevision: z.uuid(),
    correctedRevision: z.uuid(),
    reason: z.string().trim().min(1).max(500),
  }),
  z.object({
    operation: z.literal('correctShipping'),
    ticketId: z.string().uuid(),
    customerConfirmed: z.literal(true),
    expectedProofVersion: z.number().int().positive().optional(),
    shippingAddress: z.object({
      name: z.string().trim().min(1).max(120),
      street1: z.string().trim().min(1).max(255),
      street2: z.string().trim().max(255).optional(),
      city: z.string().trim().min(1).max(120),
      postcode: z.string().trim().max(20),
      country_code: z
        .string()
        .trim()
        .toUpperCase()
        .regex(/^[A-Z]{2}$/),
      state_code: z.string().trim().max(120).optional(),
      phone_number: z.string().trim().max(30),
      email: z.string().trim().email().max(255),
      recipient_tax_id: z.string().trim().max(40).optional(),
    }),
  }),
]);

export async function POST(request: Request) {
  const actor = await authenticateAdmin();
  if ('error' in actor) return actor.error;
  if (!hasTrustedAdminOrigin(request))
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: 'Invalid print command' }, { status: 400 });
  const command = parsed.data;
  try {
    let input: Record<string, unknown> = {};
    let previousSettings: PrintSettings | undefined;
    if (command.operation === 'setConfig') {
      previousSettings = await callPrintDomain<PrintSettings>('getConfig', {}, actor.email);
      input = {
        defaultProvider: command.defaultProvider,
        maxEurPerCopy: command.maxEurPerCopy,
        ...(command.hardcoverCredits !== undefined
          ? { hardcoverCredits: command.hardcoverCredits }
          : {}),
      };
    } else if ('ticketId' in command) {
      const ticket = await TicketService.getTicketById(command.ticketId);
      const metadata = ticket?.metadata as TicketMetadata | null;
      if (!ticket || ticket.category !== 'print_request' || !metadata?.printRequestId) {
        return Response.json({ error: 'Linked print request not found' }, { status: 404 });
      }
      if (
        !['get', 'reconcile'].includes(command.operation) &&
        ['closed', 'resolved'].includes(ticket.status)
      ) {
        return Response.json({ error: 'Ticket is closed or resolved' }, { status: 409 });
      }
      input = { ...command, printRequestId: metadata.printRequestId };
      delete input.operation;
    }
    if (!['get', 'getConfig'].includes(command.operation)) {
      await logAdminAudit({
        actorEmail: actor.email,
        action: `print.${command.operation}`,
        entityType: 'print',
        entityId: 'ticketId' in command ? command.ticketId : undefined,
        ...(command.operation === 'correctSquareEdition'
          ? {
              metadata: {
                previousRevision: command.expectedRevision,
                correctedRevision: command.correctedRevision,
                reason: command.reason,
              },
            }
          : command.operation === 'cancel'
            ? { metadata: { reason: command.reason } }
            : {}),
      });
    }
    const data = await callPrintDomain(command.operation, input, actor.email);
    if (command.operation === 'setConfig') {
      await logAdminAudit({
        actorEmail: actor.email,
        action: 'print.settings_updated',
        entityType: 'print_settings',
        metadata: {
          outcome: 'success',
          previous: previousSettings && auditSettings(previousSettings),
          current: auditSettings(data as PrintSettings),
        },
      });
    }
    return Response.json({ data }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    if (command.operation === 'setConfig') {
      await logAdminAudit({
        actorEmail: actor.email,
        action: 'print.settings_updated',
        entityType: 'print_settings',
        metadata: { outcome: 'failed' },
      });
    }
    if (error instanceof PrintDomainError)
      return Response.json({ error: error.message }, { status: error.status });
    console.error('Print command failed', { operation: command.operation, error });
    return Response.json({ error: 'Print command failed' }, { status: 500 });
  }
}
