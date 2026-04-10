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
];

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

    const { id } = await params;

    // TODO: Implement database query to fetch specific notification rule
    const rule = mockRules.find((r) => r.id === id);

    if (!rule) {
      return NextResponse.json({ error: 'Rule not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: rule,
    });
  } catch (error) {
    console.error('Error fetching notification rule:', error);
    return NextResponse.json({ error: 'Failed to fetch notification rule' }, { status: 500 });
  }
}

export async function PUT() {
  return NextResponse.json(
    { error: 'Notification rule updates are not implemented yet.' },
    { status: 501 },
  );
}

export async function DELETE() {
  return NextResponse.json(
    { error: 'Notification rule deletion is not implemented yet.' },
    { status: 501 },
  );
}
