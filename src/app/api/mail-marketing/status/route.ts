import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { ALLOWED_DOMAINS } from '@/config/auth';

const getNotificationEngineUrl = () => {
  const url = process.env.NOTIFICATION_ENGINE_URL;
  if (!url) {
    throw new Error('NOTIFICATION_ENGINE_URL is not configured');
  }
  return url;
};

const getNotificationEngineApiKey = () => {
  const apiKey = process.env.NOTIFICATION_ENGINE_API_KEY;
  if (!apiKey) {
    throw new Error('NOTIFICATION_ENGINE_API_KEY is not configured');
  }
  return apiKey;
};

/**
 * GET /api/mail-marketing/status
 * Fetch simplified mail marketing status from notification engine
 */
export async function GET() {
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
      `${getNotificationEngineUrl()}/internal/mail-marketing/status`,
      {
        headers: {
          'x-api-key': getNotificationEngineApiKey(),
        },
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Notification engine error:', errorText);
      return NextResponse.json(
        { error: 'Failed to fetch status from notification engine' },
        { status: response.status },
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching mail marketing status:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
