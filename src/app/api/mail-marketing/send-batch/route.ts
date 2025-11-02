import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { ALLOWED_DOMAINS } from '@/config/auth';

/**
 * POST /api/mail-marketing/send-batch
 * Trigger batch sending of marketing emails to ready leads
 * This proxies to the notification engine's send-batch endpoint
 */
export async function POST() {
  try {
    // Check authentication
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const isAllowedDomain = ALLOWED_DOMAINS.some((domain) => session.user?.email?.endsWith(domain));
    if (!isAllowedDomain) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Make request to notification engine
    const response = await fetch(
      `${process.env.NOTIFICATION_ENGINE_URL}/internal/mail-marketing/send-batch`,
      {
        method: 'POST',
        headers: {
          'x-api-key': process.env.NOTIFICATION_ENGINE_API_KEY || '',
          'Content-Type': 'application/json',
        },
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Notification engine error:', errorText);
      return NextResponse.json(
        { error: 'Failed to trigger batch send from notification engine' },
        { status: response.status },
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error triggering batch send:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
