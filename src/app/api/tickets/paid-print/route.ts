import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticateRequest, unauthorizedResponse } from '@/lib/auth/middleware';
import { TicketService } from '@/lib/ticketing/service';
import type { TicketMetadata } from '@/lib/ticketing/types';

const requestSchema = z.object({
  category: z.literal('print_request'),
  storyId: z.uuid().toLowerCase(),
  userId: z.uuid().toLowerCase(),
  printFormat: z.enum(['paperback', 'hardcover']),
  numberOfCopies: z.number().int().positive(),
  orderDetails: z.object({
    fulfillmentVersion: z.literal(1),
    printRequestId: z.uuid().toLowerCase(),
  }),
});

export async function POST(request: NextRequest) {
  const actor = await authenticateRequest(request);
  if (!actor.success) return unauthorizedResponse(actor.error);
  if (actor.source !== 'api-key') {
    return NextResponse.json(
      { error: 'Paid print tickets must be created by the print checkout service' },
      { status: 403 },
    );
  }

  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json({ error: 'Invalid paid print ticket linkage' }, { status: 400 });

  const { storyId, userId, printFormat, numberOfCopies, orderDetails } = parsed.data;
  const { printRequestId } = orderDetails;
  try {
    const ticket = await TicketService.createLinkedPrintTicket({
      storyId,
      userId,
      printFormat,
      numberOfCopies,
      printRequestId,
    });
    const metadata = ticket.metadata as TicketMetadata | null;
    if (metadata?.printRequestId !== printRequestId) {
      return NextResponse.json({ error: 'Paid print ticket linkage failed' }, { status: 502 });
    }
    return NextResponse.json({ id: ticket.id, metadata: { printRequestId } }, { status: 201 });
  } catch (error) {
    console.error('Error creating paid print ticket', { printRequestId, error });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
