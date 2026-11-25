import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticateRequest, unauthorizedResponse } from '@/lib/auth/middleware';
import { TicketService } from '@/lib/ticketing/service';
import type { TicketMetadata } from '@/lib/ticketing/types';

const schema = z.object({
  category: z.literal('print_request'),
  storyId: z.uuid().toLowerCase(),
  userId: z.uuid().toLowerCase(),
  printFormat: z.literal('hardcover'),
  numberOfCopies: z.literal(1),
  orderDetails: z.object({
    fulfillmentVersion: z.literal(1),
    printRequestId: z.uuid().toLowerCase(),
    proofOnly: z.object({ revision: z.uuid().toLowerCase(), requestedBy: z.email().max(255) }),
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
    return NextResponse.json({ error: 'Invalid staff proof linkage' }, { status: 400, headers });
  const { storyId, userId, printFormat, numberOfCopies, orderDetails } = result.data;
  const { proofOnly, printRequestId } = orderDetails;
  try {
    const ticket = await TicketService.createLinkedPrintTicket({
      storyId,
      userId,
      printFormat,
      numberOfCopies,
      printRequestId,
      proofOnly,
    });
    const metadata = ticket.metadata as TicketMetadata | null;
    if (
      metadata?.printRequestId !== printRequestId ||
      metadata.proofOnly?.revision !== proofOnly.revision
    )
      return NextResponse.json({ error: 'Staff proof linkage failed' }, { status: 502, headers });
    return NextResponse.json(
      { id: ticket.id, metadata: { printRequestId, staffProofRevision: proofOnly.revision } },
      { status: 201, headers },
    );
  } catch (error) {
    console.error('Staff proof ticket linkage failed', { printRequestId, error });
    return NextResponse.json(
      { error: 'Could not link staff proof ticket' },
      { status: 500, headers },
    );
  }
}
