import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { ALLOWED_DOMAINS } from '@/config/auth';

interface NotificationChannel {
  id: string;
  name: string;
  type: 'email' | 'sms' | 'push' | 'webhook';
  enabled: boolean;
  config: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

async function getChannels(): Promise<NotificationChannel[]> {
  console.warn('Notification channels read is disabled until real persistence is implemented.');
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

    const channels = await getChannels();

    return NextResponse.json({
      success: true,
      data: channels,
      readOnly: true,
      warning: 'Notification channels are unavailable until real persistence is implemented.',
    });
  } catch (error) {
    console.error('Error fetching notification channels:', error);
    return NextResponse.json({ error: 'Failed to fetch notification channels' }, { status: 500 });
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

    console.warn('Notification channel creation is disabled until real persistence is implemented.');

    return NextResponse.json(
      {
        error: 'Notification channel creation is not available yet',
      },
      { status: 501 },
    );
  } catch (error) {
    console.error('Error creating notification channel:', error);
    return NextResponse.json({ error: 'Failed to create notification channel' }, { status: 500 });
  }
}
