import { NextResponse } from 'next/server';
import { authenticateAdmin } from '@/lib/api-helpers';
import { campaignService } from '@/db/services/campaigns';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/email-campaigns/[id]/pause
 * Transition campaign: active -> paused
 */
export async function POST(_request: Request, { params }: RouteParams) {
  try {
    const result = await authenticateAdmin();
    if ('error' in result) return result.error;

    const { id } = await params;
    const campaign = await campaignService.transitionCampaignStatus(id, 'paused', result.email);

    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    return NextResponse.json(campaign);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    const status = message.includes('Invalid transition') ? 409 : 500;
    console.error('Error pausing campaign:', error);
    return NextResponse.json({ error: message }, { status });
  }
}
