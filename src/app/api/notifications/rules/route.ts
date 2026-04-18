import { NextResponse } from 'next/server';
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

async function getRules(): Promise<NotificationRule[]> {
  console.warn('Notification rules read is disabled until real persistence is implemented.');
  return [];
}

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

    const rules = await getRules();

    return NextResponse.json({
      success: true,
      data: rules,
      readOnly: true,
      warning: 'Notification rules are unavailable until real persistence is implemented.',
    });
  } catch (error) {
    console.error('Error fetching notification rules:', error);
    return NextResponse.json({ error: 'Failed to fetch notification rules' }, { status: 500 });
  }
}

export async function POST() {
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
