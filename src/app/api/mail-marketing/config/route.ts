import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { ALLOWED_DOMAINS } from '@/config/auth';

/**
 * GET /api/mail-marketing/config
 * Fetch mail marketing configuration from notification engine
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
      `${process.env.NOTIFICATION_ENGINE_URL}/internal/mail-marketing/config`,
      {
        headers: {
          'x-api-key': process.env.NOTIFICATION_ENGINE_API_KEY || '',
        },
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Notification engine error:', errorText);
      return NextResponse.json(
        { error: 'Failed to fetch configuration from notification engine' },
        { status: response.status },
      );
    }

    const json = await response.json();
    // Unwrap the notification engine envelope { success, data }
    return NextResponse.json(json.data ?? json);
  } catch (error) {
    console.error('Error fetching mail marketing config:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PUT /api/mail-marketing/config
 * Update mail marketing configuration in notification engine
 */
export async function PUT(request: Request) {
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

    // Parse request body
    const body = await request.json();

    // Make request to notification engine
    const response = await fetch(
      `${process.env.NOTIFICATION_ENGINE_URL}/internal/mail-marketing/config`,
      {
        method: 'PUT',
        headers: {
          'x-api-key': process.env.NOTIFICATION_ENGINE_API_KEY || '',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      },
    );

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Notification engine error:', errorData);
      return NextResponse.json(errorData, { status: response.status });
    }

    const json = await response.json();
    // Unwrap the notification engine envelope { success, data }
    return NextResponse.json(json.data ?? json);
  } catch (error) {
    console.error('Error updating mail marketing config:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
