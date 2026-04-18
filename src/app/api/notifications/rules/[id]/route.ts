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

async function getRuleById(): Promise<NotificationRule | null> {
  console.warn('Notification rule detail read is disabled until real persistence is implemented.');
  return null;
}

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

    await params;

    const rule = await getRuleById();

    if (!rule) {
      return NextResponse.json(
        { error: 'Notification rule details are unavailable until real persistence is implemented.' },
        { status: 501 },
      );
    }

    return NextResponse.json({
      success: true,
      data: rule,
      readOnly: true,
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
