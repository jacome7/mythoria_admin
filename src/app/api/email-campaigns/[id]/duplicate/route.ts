import { NextResponse } from 'next/server';
import { authenticateAdmin } from '@/lib/api-helpers';
import { campaignService } from '@/db/services/campaigns';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/email-campaigns/[id]/duplicate
 * Create a draft copy of a campaign with assets.
 */
export async function POST(_request: Request, { params }: RouteParams) {
  try {
    const result = await authenticateAdmin();
    if ('error' in result) return result.error;

    const { id } = await params;
    const campaign = await campaignService.duplicateCampaign(id, result.email);

    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    return NextResponse.json(campaign, { status: 201 });
  } catch (error) {
    console.error('Error duplicating campaign:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
