import { hasTrustedAdminOrigin } from '@/lib/admin-request-origin';
import { z } from 'zod';
import { authenticateAdmin } from '@/lib/api-helpers';
import { logAdminAudit } from '@/lib/audit';
import { callPrintDomain, PrintDomainError } from '@/services/print';

const headers = { 'Cache-Control': 'private, no-store' };

const requestSchema = z
  .object({
    intentId: z.never().optional(),
    bookFormat: z.enum(['premium_square', 'standard_a5']),
    binding: z.enum(['paperback', 'hardcover']),
    copies: z.number().int().min(1).max(10),
    orderKind: z.enum(['staff_proof', 'admin_order']),
    provider: z.enum(['lulu', 'manual']).default('lulu'),
    legacyTicketId: z.uuid().toLowerCase().optional(),
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
  });

type Context = { params: Promise<{ storyId: string }> };

export async function POST(request: Request, { params }: Context) {
  const actor = await authenticateAdmin();
  if ('error' in actor) return actor.error;
  if (!hasTrustedAdminOrigin(request))
    return Response.json({ error: 'Forbidden' }, { status: 403, headers });

  const story = z
    .uuid()
    .toLowerCase()
    .safeParse((await params).storyId);
  const body = requestSchema.safeParse(await request.json().catch(() => null));
  if (!story.success || !body.success) {
    return Response.json(
      { error: 'Enter a valid story, print format, and carrier shipping address.' },
      { status: 400, headers },
    );
  }

  const { prepareNow, ...orderInput } = body.data;
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
    },
  });

  try {
    const created = z
      .object({ ticketId: z.uuid(), printRequestId: z.uuid() })
      .parse(
        await callPrintDomain(
          'createAdminOrder',
          { storyId: story.data, ...orderInput },
          actor.email,
        ),
      );

    let fulfillment: unknown;
    let prepareWarning: string | undefined;
    if (prepareNow) {
      try {
        fulfillment = await callPrintDomain(
          'prepare',
          {
            ticketId: created.ticketId,
            printRequestId: created.printRequestId,
            runImmediately: true,
          },
          actor.email,
        );
      } catch (error) {
        prepareWarning =
          error instanceof PrintDomainError
            ? error.message
            : 'Print ticket was created, but immediate preparation deferred to background polling.';
      }
    }

    return Response.json(
      {
        data: {
          ...created,
          ...(fulfillment !== undefined ? { fulfillment } : {}),
          ...(prepareWarning ? { prepareWarning } : {}),
        },
      },
      { status: 201, headers },
    );
  } catch (error) {
    if (error instanceof PrintDomainError)
      return Response.json({ error: error.message }, { status: error.status, headers });
    console.error('Admin Lulu print order failed', { storyId: story.data, error });
    return Response.json(
      { error: 'Could not create the admin print order.' },
      { status: 500, headers },
    );
  }
}
