import { NextResponse, type NextRequest } from 'next/server';
import { authenticateAdmin } from '@/lib/api-helpers';
import { campaignService } from '@/db/services/campaigns';
import type { CampaignAudienceSource } from '@/db/schema/campaigns';
import { audienceEstimateSchema, type FilterTree } from '@/lib/schemas/campaigns';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/email-campaigns/[id]/audience-count
 * Returns the estimated audience count for a campaign based on its filters.
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

    const audienceCount = await campaignService.getEstimatedAudienceCount(
      id,
      campaign.audienceSource as CampaignAudienceSource,
      campaign.filterTree as FilterTree | null,
      campaign.userNotificationPreferences as string[] | null | undefined,
    );

    return NextResponse.json(audienceCount);
  } catch (error) {
    console.error('Error fetching audience count:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/email-campaigns/[id]/audience-count
 * Returns the estimated audience count using draft overrides.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const result = await authenticateAdmin();
    if ('error' in result) return result.error;

    const { id } = await params;
    const campaign = await campaignService.getCampaign(id);

    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    const body = await request.json();
    const parsed = audienceEstimateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const hasAudienceSource = Object.prototype.hasOwnProperty.call(body, 'audienceSource');
    const hasFilterTree = Object.prototype.hasOwnProperty.call(body, 'filterTree');
    const hasPreferences = Object.prototype.hasOwnProperty.call(
      body,
      'userNotificationPreferences',
    );

    const audienceSource = hasAudienceSource
      ? (parsed.data.audienceSource ?? campaign.audienceSource)
      : campaign.audienceSource;

    const filterTree = hasFilterTree
      ? (parsed.data.filterTree as FilterTree | null | undefined)
      : (campaign.filterTree as FilterTree | null);

    const userNotificationPreferences = hasPreferences
      ? parsed.data.userNotificationPreferences
      : (campaign.userNotificationPreferences as string[] | null | undefined);

    const audienceCount = await campaignService.getEstimatedAudienceCount(
      id,
      audienceSource as CampaignAudienceSource,
      filterTree as FilterTree | null,
      userNotificationPreferences,
    );

    return NextResponse.json(audienceCount);
  } catch (error) {
    console.error('Error fetching audience count:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
