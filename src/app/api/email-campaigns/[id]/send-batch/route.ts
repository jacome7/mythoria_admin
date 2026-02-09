import { NextResponse } from 'next/server';
import { authenticateAdmin, proxyToNotificationEngine } from '@/lib/api-helpers';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/email-campaigns/[id]/send-batch
 * Trigger a manual batch send for a single campaign.
 * Proxied to notification engine.
 */
export async function POST(_request: Request, { params }: RouteParams) {
  try {
    const result = await authenticateAdmin();
    if ('error' in result) return result.error;

    const { id } = await params;

    return proxyToNotificationEngine(`/internal/campaigns/${id}/send-batch`, {
      method: 'POST',
      body: { requestedBy: result.email },
    });
  } catch (error) {
    console.error('Error triggering campaign batch send:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
