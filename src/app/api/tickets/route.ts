import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, unauthorizedResponse } from '@/lib/auth/middleware';
import { TicketService } from '@/lib/ticketing/service';
import type { TicketFilters } from '@/lib/ticketing/service';

export async function GET(request: NextRequest) {
  try {
    // Authenticate request (session or API key)
    const auth = await authenticateRequest(request);
    if (!auth.success) {
      return unauthorizedResponse(auth.error);
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);

    const statusParam = searchParams.get('status');
    const status = statusParam
      ? (statusParam.split(',') as ('open' | 'in_progress' | 'resolved' | 'closed')[])
      : undefined;

    const filters: TicketFilters = {
      status: status,
      category: searchParams.get('category') || undefined,
      priority: (searchParams.get('priority') as 'low' | 'medium' | 'high') || undefined,
      search: searchParams.get('search') || undefined,
      page: parseInt(searchParams.get('page') || '1'),
      limit: parseInt(searchParams.get('limit') || '50'),
    };

    // Get tickets
    const tickets = await TicketService.getTickets(filters);

    return NextResponse.json({
      data: tickets,
      pagination: {
        page: filters.page,
        limit: filters.limit,
        hasNext: tickets.length === filters.limit,
        hasPrev: (filters.page || 1) > 1,
      },
    });
  } catch (error) {
    console.error('Error fetching tickets:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    // Authenticate request (session or API key)
    const auth = await authenticateRequest(request);
    if (!auth.success) {
      return unauthorizedResponse(auth.error);
    }

    const body = await request.json();

    // Validate required fields based on category
    if (!body.category) {
      return NextResponse.json({ error: 'Missing required field: category' }, { status: 400 });
    }

    // Create ticket based on category
    let ticket;

    switch (body.category) {
      case 'contact':
        if (!body.email || !body.name || !body.type || !body.message) {
          return NextResponse.json(
            { error: 'Missing required fields for contact ticket: email, name, type, message' },
            { status: 400 },
          );
        }
        ticket = await TicketService.createContactTicket({
          email: body.email,
          name: body.name,
          type: body.type,
          message: body.message,
          userId: body.userId,
        });
        break;

      case 'print_request':
        if (!body.storyId) {
          return NextResponse.json(
            { error: 'Missing required field for print request: storyId' },
            { status: 400 },
          );
        }
        ticket = await TicketService.createPrintTicket({
          storyId: body.storyId,
          userId: body.userId,
          shippingAddress: body.shippingAddress,
          printFormat: body.printFormat,
          numberOfCopies: body.numberOfCopies,
        });
        break;

      case 'payment_request':
        if (!body.amount) {
          return NextResponse.json(
            { error: 'Missing required field for payment request: amount' },
            { status: 400 },
          );
        }

        // For payment requests, use the rich metadata sent by the webapp
        // instead of the simplified createPaymentTicket method
        ticket = await TicketService.createTicket({
          userId: body.userId,
          category: body.category,
          subject: body.subject || `Payment Request - €${body.amount}`,
          description:
            body.description || `User requested payment processing for amount: €${body.amount}`,
          priority: body.priority,
          metadata: body.metadata, // Preserve all metadata from webapp
        });
        break;

      default:
        // Generic ticket creation - validate required fields
        if (!body.subject || !body.description) {
          return NextResponse.json(
            { error: 'Missing required fields for generic ticket: subject, description' },
            { status: 400 },
          );
        }
        ticket = await TicketService.createTicket({
          userId: body.userId,
          category: body.category,
          subject: body.subject,
          description: body.description,
          priority: body.priority,
          metadata: body.metadata,
        });
    }

    return NextResponse.json(ticket, { status: 201 });
  } catch (error) {
    console.error('Error creating ticket:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
