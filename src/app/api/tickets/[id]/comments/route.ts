import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { TicketService } from '@/lib/ticketing/service';
import { ALLOWED_DOMAINS } from '@/config/auth';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    // Check if user is authenticated and authorized
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user has admin access
    const isAllowedDomain = ALLOWED_DOMAINS.some((domain) => session.user?.email?.endsWith(domain));

    if (!isAllowedDomain) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    const ticketId = id; // Now using UUID string directly

    // Basic UUID validation
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(ticketId)) {
      return NextResponse.json({ error: 'Invalid ticket ID format' }, { status: 400 });
    }

    const body = await request.json();

    const commentContent = body.content || body.body; // Support both field names
    if (!commentContent || commentContent.trim() === '') {
      return NextResponse.json({ error: 'Comment content is required' }, { status: 400 });
    }

    // Use the session user ID as the author
    // Note: authorId expects a UUID but session.user.id might be an email
    // For now, we'll set it to null since it's nullable and track via authorName
    const authorId = null; // TODO: Map email to UUID if needed
    const authorName = body.authorName || session.user.name || session.user.email || 'Admin';

    const comment = await TicketService.addComment(
      ticketId,
      commentContent,
      authorId,
      body.isInternal || false,
    );

    // Send notification for the new comment
    await TicketService.sendCommentNotification(ticketId, comment, authorName);

    return NextResponse.json(comment, { status: 201 });
  } catch (error) {
    console.error('Error adding comment:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
