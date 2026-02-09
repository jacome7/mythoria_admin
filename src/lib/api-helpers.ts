import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { ALLOWED_DOMAINS } from '@/config/auth';

/**
 * Authenticate an admin API request.
 * Returns the admin email on success, or a NextResponse error on failure.
 */
export async function authenticateAdmin(): Promise<{ email: string } | { error: NextResponse }> {
  const session = await auth();
  if (!session?.user?.email) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  const isAllowedDomain = ALLOWED_DOMAINS.some((domain) => session.user?.email?.endsWith(domain));
  if (!isAllowedDomain) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }

  return { email: session.user.email };
}

/**
 * Proxy a request to the notification engine.
 */
export async function proxyToNotificationEngine(
  path: string,
  options: {
    method?: string;
    body?: unknown;
  } = {},
): Promise<NextResponse> {
  const { method = 'POST', body } = options;

  const headers: Record<string, string> = {
    'x-api-key': process.env.NOTIFICATION_ENGINE_API_KEY || '',
  };

  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(`${process.env.NOTIFICATION_ENGINE_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    console.error(`Notification engine error [${path}]:`, data);
    return NextResponse.json(data ?? { error: 'Notification engine request failed' }, {
      status: response.status,
    });
  }

  return NextResponse.json(data);
}
