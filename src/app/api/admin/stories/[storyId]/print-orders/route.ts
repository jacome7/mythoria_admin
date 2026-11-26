import { z } from 'zod';
import {
  adminPrintBookFormat,
  adminPrintMatch,
  adminPrintOrderKind,
  adminPrintOrderResult,
  adminPrintProgress,
  adminPrintProvider,
} from '@/lib/admin-print-order';
import { hasTrustedAdminOrigin } from '@/lib/admin-request-origin';
import { authenticateAdmin } from '@/lib/api-helpers';
import { logAdminAudit } from '@/lib/audit';
import { getAdminPrintStory } from '@/services/admin-print-story';
import { callPrintDomain, PrintDomainError } from '@/services/print';

const headers = { 'Cache-Control': 'private, no-store' };
const uuid = z.uuid().toLowerCase();
const ticketContext = z.object({
  legacyTicketId: uuid.optional(),
  requestedThrough: z.iso.datetime({ offset: true }).optional(),
});

const requestSchema = z
  .object({
    intentId: uuid,
    bookFormat: adminPrintBookFormat,
    revision: uuid.optional(),
    binding: z.enum(['paperback', 'hardcover']),
    copies: z.number().int().min(1).max(10),
    orderKind: adminPrintOrderKind,
    provider: adminPrintProvider.default('lulu'),
    legacyTicketId: uuid.optional(),
    allowRepeat: z.boolean().optional(),
    confirmSeparateLegacyShipment: z.literal(true).optional(),
    prepareNow: z.boolean().default(true),
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
      phone_number: z.string().trim().min(1).max(30),
      email: z.email().max(255),
      recipient_tax_id: z.string().trim().max(40).optional(),
    }),
  })
  .refine((value) => value.bookFormat !== 'premium_square' || value.binding === 'hardcover', {
    message: 'Premium Square orders require hardcover binding.',
  })
  .refine((value) => value.orderKind !== 'staff_proof' || value.copies === 1, {
    message: 'Staff proofs are limited to 1 copy.',
  })
  .refine((value) => !value.confirmSeparateLegacyShipment || Boolean(value.legacyTicketId), {
    message: 'A legacy print ticket is required to confirm a separate shipment.',
  });

const requestWithOperation = z.union([
  requestSchema,
  z.object({ operation: z.literal('recover'), intentId: uuid }),
]);

type Context = { params: Promise<{ storyId: string }> };

function printError(error: unknown, storyId: string, fallback: string) {
  if (error instanceof PrintDomainError) {
    return Response.json(
      { error: error.message, ...(error.code && { code: error.code }) },
      { status: error.status, headers },
    );
  }
  console.error('Admin print request failed', { storyId });
  return Response.json({ error: fallback }, { status: 500, headers });
}

export async function GET(request: Request, { params }: Context) {
  const actor = await authenticateAdmin();
  if ('error' in actor) return actor.error;
  const story = uuid.safeParse((await params).storyId);
  const ticket = ticketContext.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!story.success || !ticket.success) {
    return Response.json({ error: 'Invalid story or ticket.' }, { status: 400, headers });
  }

  try {
    const details = await getAdminPrintStory(story.data, !ticket.data.legacyTicketId);
    if (!details) {
      return Response.json({ error: 'Published story unavailable.' }, { status: 404, headers });
    }
    const matches = await callPrintDomain(
      'findAdminOrderMatches',
      {
        storyId: story.data,
        ...ticket.data,
        ...(!ticket.data.legacyTicketId &&
          details.premiumRevision && { revision: details.premiumRevision }),
      },
      actor.email,
    );
    return Response.json(
      { data: { ...details, matches: z.array(adminPrintMatch).parse(matches) } },
      { headers },
    );
  } catch (error) {
    return printError(error, story.data, 'Could not look up print options for this story.');
  }
}

export async function POST(request: Request, { params }: Context) {
  const actor = await authenticateAdmin();
  if ('error' in actor) return actor.error;
  if (!hasTrustedAdminOrigin(request)) {
    return Response.json({ error: 'Forbidden' }, { status: 403, headers });
  }

  const story = uuid.safeParse((await params).storyId);
  const body = requestWithOperation.safeParse(await request.json().catch(() => null));
  if (!story.success || !body.success) {
    return Response.json(
      { error: 'Enter a valid story, print format, and carrier shipping address.' },
      { status: 400, headers },
    );
  }

  try {
    if ('operation' in body.data) {
      const data = adminPrintOrderResult.parse(
        await callPrintDomain(
          'recoverAdminOrder',
          { storyId: story.data, intentId: body.data.intentId },
          actor.email,
        ),
      );
      return Response.json({ data }, { headers });
    }

    const { prepareNow, ...orderInput } = body.data;
    const created = adminPrintOrderResult.parse(
      await callPrintDomain(
        'createAdminOrderV2',
        { storyId: story.data, ...orderInput },
        actor.email,
      ),
    );
    if ('status' in created || created.reused) return Response.json({ data: created }, { headers });

    await logAdminAudit({
      actorEmail: actor.email,
      action: 'story.lulu_print_order_created',
      entityType: 'story',
      entityId: story.data,
      metadata: {
        bookFormat: orderInput.bookFormat,
        binding: orderInput.binding,
        copies: orderInput.copies,
        orderKind: orderInput.orderKind,
        provider: orderInput.provider,
        legacyTicketId: orderInput.legacyTicketId ?? null,
        printRequestId: created.printRequestId,
        ...(orderInput.confirmSeparateLegacyShipment && { confirmSeparateLegacyShipment: true }),
      },
    });

    let fulfillment: z.infer<typeof adminPrintProgress> | undefined;
    let prepareWarning: string | undefined;
    if (prepareNow) {
      try {
        fulfillment = adminPrintProgress.parse(
          await callPrintDomain(
            'prepare',
            {
              ticketId: created.ticketId,
              printRequestId: created.printRequestId,
              runImmediately: true,
            },
            actor.email,
          ),
        );
      } catch (error) {
        prepareWarning =
          error instanceof PrintDomainError
            ? error.message
            : 'Immediate preparation could not be confirmed. Check the print ticket for progress.';
      }
    }

    return Response.json(
      {
        data: {
          ...created,
          ...(fulfillment && { fulfillment }),
          ...(prepareWarning && { prepareWarning }),
        },
      },
      { status: 201, headers },
    );
  } catch (error) {
    return printError(error, story.data, 'Could not create or recover the admin print order.');
  }
}
