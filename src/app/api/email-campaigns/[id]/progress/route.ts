import { NextResponse } from 'next/server';
import { authenticateAdmin } from '@/lib/api-helpers';
import { campaignService } from '@/db/services/campaigns';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/email-campaigns/[id]/progress
 * Returns sent/remaining/failed/skipped stats for a campaign.
 */
export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const result = await authenticateAdmin();
    if ('error' in result) return result.error;

    const { id } = await params;
    const campaign = await campaignService.getCampaign(id);

    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    const progress = await campaignService.getCampaignProgress(id);

    return NextResponse.json(progress);
  } catch (error) {
    console.error('Error fetching campaign progress:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
