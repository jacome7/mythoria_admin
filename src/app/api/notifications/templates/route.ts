import { NextResponse } from 'next/server';
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

async function getTemplates(): Promise<NotificationTemplate[]> {
  console.warn('Notification templates read is disabled until real persistence is implemented.');
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

    const templates = await getTemplates();

    return NextResponse.json({
      success: true,
      data: templates,
      readOnly: true,
      warning: 'Notification templates are unavailable until real persistence is implemented.',
    });
  } catch (error) {
    console.error('Error fetching notification templates:', error);
    return NextResponse.json({ error: 'Failed to fetch notification templates' }, { status: 500 });
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

    console.warn('Notification template creation is disabled until real persistence is implemented.');

    return NextResponse.json(
      {
        error: 'Notification template creation is not available yet',
      },
      { status: 501 },
    );
  } catch (error) {
    console.error('Error creating notification template:', error);
    return NextResponse.json({ error: 'Failed to create notification template' }, { status: 500 });
  }
}
