import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticateRequest, unauthorizedResponse } from '@/lib/auth/middleware';
import { LegacyPrintConflict, TicketService } from '@/lib/ticketing/service';
import type { TicketMetadata } from '@/lib/ticketing/types';

const schema = z.object({
  category: z.literal('print_request'),
  storyId: z.uuid().toLowerCase(),
  userId: z.uuid().toLowerCase(),
  shippingAddress: z.null().optional(),
  printFormat: z.enum(['paperback', 'hardcover']),
  numberOfCopies: z.number().int().min(1).max(10),
  legacyTicketId: z.uuid().toLowerCase().optional(),
  orderDetails: z.object({
    fulfillmentVersion: z.literal(1),
    printRequestId: z.uuid().toLowerCase(),
    adminPrintOrder: z.literal(true),
    orderKind: z.enum(['staff_proof', 'admin_order']),
    bookFormat: z.enum(['premium_square', 'standard_a5']),
    requestedBy: z.email().max(255),
    proofOnly: z
      .object({ revision: z.uuid().toLowerCase(), requestedBy: z.email().max(255) })
      .optional(),
  }),
});
const headers = { 'Cache-Control': 'private, no-store' };

export async function POST(request: NextRequest) {
  const actor = await authenticateRequest(request);
  if (!actor.success) return unauthorizedResponse(actor.error);
  if (actor.source !== 'api-key')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403, headers });
  const result = schema.safeParse(await request.json().catch(() => null));
  if (!result.success)
    return NextResponse.json({ error: 'Invalid admin print linkage' }, { status: 400, headers });
  const { storyId, userId, printFormat, numberOfCopies, legacyTicketId, orderDetails } =
    result.data;
  const { printRequestId, orderKind, bookFormat, requestedBy, proofOnly } = orderDetails;
  try {
    const ticket = await TicketService.createOrLinkAdminPrintTicket({
      storyId,
      userId,
      printFormat,
      numberOfCopies,
      printRequestId,
      orderKind,
      bookFormat,
      requestedBy,
      legacyTicketId,
      proofOnly,
    });
    const metadata = ticket.metadata as TicketMetadata | null;
    if (metadata?.printRequestId !== printRequestId)
      return NextResponse.json({ error: 'Admin print linkage failed' }, { status: 502, headers });
    return NextResponse.json(
      { id: ticket.id, metadata: { printRequestId } },
      { status: 201, headers },
    );
  } catch (error) {
    if (error instanceof LegacyPrintConflict)
      return NextResponse.json({ error: error.message }, { status: 409, headers });
    console.error('Admin print ticket linkage failed', { printRequestId, error });
    return NextResponse.json(
      { error: 'Could not link admin print ticket' },
      { status: 500, headers },
    );
  }
}
