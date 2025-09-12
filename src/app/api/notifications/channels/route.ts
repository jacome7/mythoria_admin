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

// Mock data - In a real implementation, this would come from a database
const mockChannels: NotificationChannel[] = [
  {
    id: 'email',
    name: 'Email',
    type: 'email',
    enabled: true,
    config: {
      provider: 'smtp',
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'sms',
    name: 'SMS',
    type: 'sms',
    enabled: false,
    config: {
      provider: 'twilio',
      accountSid: '',
      authToken: '',
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'push',
    name: 'Push Notifications',
    type: 'push',
    enabled: false,
    config: {
      provider: 'firebase',
      serverKey: '',
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'webhook',
    name: 'Webhook',
    type: 'webhook',
    enabled: false,
    config: {
      url: '',
      method: 'POST',
      headers: {},
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
    const isAllowedDomain = ALLOWED_DOMAINS.some(domain => 
      session.user?.email?.endsWith(domain)
    );

    if (!isAllowedDomain) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // TODO: Implement database query to fetch notification channels
    return NextResponse.json({
      success: true,
      data: mockChannels
    });
  } catch (error) {
    console.error('Error fetching notification channels:', error);
    return NextResponse.json(
      { error: 'Failed to fetch notification channels' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user has admin access
    const isAllowedDomain = ALLOWED_DOMAINS.some(domain => 
      session.user?.email?.endsWith(domain)
    );

    if (!isAllowedDomain) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    
    const newChannel: NotificationChannel = {
      id: body.id || Date.now().toString(),
      name: body.name,
      type: body.type,
      enabled: body.enabled ?? true,
      config: body.config || {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // TODO: Implement database insert
    console.log('Creating notification channel:', newChannel);

    return NextResponse.json({
      success: true,
      data: newChannel
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating notification channel:', error);
    return NextResponse.json(
      { error: 'Failed to create notification channel' },
      { status: 500 }
    );
  }
}
