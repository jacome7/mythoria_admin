import { NextResponse } from 'next/server';
import { authenticateAdmin, proxyToNotificationEngine } from '@/lib/api-helpers';
import { sampleSendSchema } from '@/lib/schemas/campaigns';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/email-campaigns/[id]/send-sample
 * Send a sample email for a specific campaign and locale.
 * Proxied to notification engine.
 */
export async function POST(request: Request, { params }: RouteParams) {
  try {
    const result = await authenticateAdmin();
    if ('error' in result) return result.error;

    const { id } = await params;
    const body = await request.json();

    const parsed = sampleSendSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    return proxyToNotificationEngine(`/internal/campaigns/${id}/send-sample`, {
      method: 'POST',
      body: { ...parsed.data, requestedBy: result.email },
    });
  } catch (error) {
    console.error('Error sending campaign sample:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
