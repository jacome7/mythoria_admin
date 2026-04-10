import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { ALLOWED_DOMAINS } from '@/config/auth';

interface NotificationRule {
  id: string;
  name: string;
  eventType: 'ticket.created' | 'ticket.status_updated' | 'ticket.comment_added';
  channels: string[];
  templateId: string;
  enabled: boolean;
  conditions?: Record<string, unknown>;
  recipients?: {
    includeAdmins: boolean;
    includeCustomers: boolean;
    customEmails: string[];
  };
  createdAt: string;
  updatedAt: string;
}

// Mock data - In a real implementation, this would come from a database
const mockRules: NotificationRule[] = [
  {
    id: '1',
    name: 'New Ticket Created',
    eventType: 'ticket.created',
    channels: ['email'],
    templateId: 'ticket-created',
    enabled: true,
    conditions: {},
    recipients: {
      includeAdmins: true,
      includeCustomers: false,
      customEmails: [],
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: '2',
    name: 'Ticket Status Updated',
    eventType: 'ticket.status_updated',
    channels: ['email'],
    templateId: 'ticket-status-updated',
    enabled: true,
    conditions: {
      priority: ['high', 'urgent'],
    },
    recipients: {
      includeAdmins: true,
      includeCustomers: true,
      customEmails: [],
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: '3',
    name: 'New Comment Added',
    eventType: 'ticket.comment_added',
    channels: ['email'],
    templateId: 'ticket-comment-added',
    enabled: true,
    conditions: {},
    recipients: {
      includeAdmins: false,
      includeCustomers: true,
      customEmails: [],
    },
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
    const isAllowedDomain = ALLOWED_DOMAINS.some((domain) => session.user?.email?.endsWith(domain));

    if (!isAllowedDomain) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // TODO: Implement database query to fetch notification rules
    // For now, return mock data
    return NextResponse.json({
      success: true,
      data: mockRules,
    });
  } catch (error) {
    console.error('Error fetching notification rules:', error);
    return NextResponse.json({ error: 'Failed to fetch notification rules' }, { status: 500 });
  }
}

export async function POST(_request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user has admin access
    const isAllowedDomain = ALLOWED_DOMAINS.some((domain) => session.user?.email?.endsWith(domain));

    if (!isAllowedDomain) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    console.warn('Notification rule creation is disabled until real persistence is implemented.');

    return NextResponse.json(
      {
        error: 'Notification rule creation is not available yet',
      },
      { status: 501 },
    );
  } catch (error) {
    console.error('Error creating notification rule:', error);
    return NextResponse.json({ error: 'Failed to create notification rule' }, { status: 500 });
  }
}
