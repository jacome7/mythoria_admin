import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { ALLOWED_DOMAINS } from '@/config/auth';

interface NotificationTemplate {
  id: string;
  name: string;
  type: 'email' | 'sms' | 'push';
  language: string;
  eventType: string;
  subject?: string;
  htmlContent?: string;
  textContent?: string;
  variables: string[];
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

// Mock data - In a real implementation, this would come from a database
const mockTemplates: NotificationTemplate[] = [
  {
    id: 'ticket-created',
    name: 'Ticket Created',
    type: 'email',
    language: 'en',
    eventType: 'ticket.created',
    subject: 'New Ticket Created: {{ticket.subject}}',
    htmlContent: '<h2>New Ticket Created</h2><p>A new ticket has been created: {{ticket.subject}}</p>',
    textContent: 'New Ticket Created\n\nA new ticket has been created: {{ticket.subject}}',
    variables: ['ticket.id', 'ticket.subject', 'ticket.description', 'customer.name', 'customer.email'],
    enabled: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'ticket-status-updated',
    name: 'Ticket Status Updated',
    type: 'email',
    language: 'en',
    eventType: 'ticket.status_updated',
    subject: 'Ticket Status Updated: {{ticket.subject}}',
    htmlContent: '<h2>Ticket Status Updated</h2><p>Ticket {{ticket.id}} status changed to {{ticket.status}}</p>',
    textContent: 'Ticket Status Updated\n\nTicket {{ticket.id}} status changed to {{ticket.status}}',
    variables: ['ticket.id', 'ticket.subject', 'ticket.status', 'customer.name'],
    enabled: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'ticket-comment-added',
    name: 'Ticket Comment Added',
    type: 'email',
    language: 'en',
    eventType: 'ticket.comment_added',
    subject: 'New Comment on Ticket: {{ticket.subject}}',
    htmlContent: '<h2>New Comment Added</h2><p>A new comment has been added to ticket {{ticket.id}}</p>',
    textContent: 'New Comment Added\n\nA new comment has been added to ticket {{ticket.id}}',
    variables: ['ticket.id', 'ticket.subject', 'comment.content', 'comment.author'],
    enabled: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

export async function GET() {
  try {
    const session = await auth();
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user has admin access
    const isAllowedDomain = ALLOWED_DOMAINS.some(domain => 
      session.user?.email?.endsWith(domain)
    );

    if (!isAllowedDomain) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // TODO: Implement database query to fetch notification templates
    return NextResponse.json({
      success: true,
      data: mockTemplates
    });
  } catch (error) {
    console.error('Error fetching notification templates:', error);
    return NextResponse.json(
      { error: 'Failed to fetch notification templates' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user has admin access
    const isAllowedDomain = ALLOWED_DOMAINS.some(domain => 
      session.user?.email?.endsWith(domain)
    );

    if (!isAllowedDomain) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    
    const newTemplate: NotificationTemplate = {
      id: body.id || Date.now().toString(),
      name: body.name,
      type: body.type,
      language: body.language || 'en',
      eventType: body.eventType,
      subject: body.subject,
      htmlContent: body.htmlContent,
      textContent: body.textContent,
      variables: body.variables || [],
      enabled: body.enabled ?? true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // TODO: Implement database insert
    console.log('Creating notification template:', newTemplate);

    return NextResponse.json({
      success: true,
      data: newTemplate
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating notification template:', error);
    return NextResponse.json(
      { error: 'Failed to create notification template' },
      { status: 500 }
    );
  }
}
