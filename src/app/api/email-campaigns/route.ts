import { NextResponse, type NextRequest } from 'next/server';
import { authenticateAdmin } from '@/lib/api-helpers';
import { campaignService } from '@/db/services/campaigns';
import { createCampaignSchema, paginationSchema } from '@/lib/schemas/campaigns';
import type { CampaignStatus } from '@/db/schema/campaigns';

/**
 * GET /api/email-campaigns
 * List campaigns with optional status filter and pagination.
 */
export async function GET(request: NextRequest) {
  try {
    const result = await authenticateAdmin();
    if ('error' in result) return result.error;

    const { searchParams } = new URL(request.url);
    const parsed = paginationSchema.safeParse({
      page: searchParams.get('page') ?? '1',
      limit: searchParams.get('limit') ?? '20',
      status: searchParams.get('status') ?? undefined,
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { page, limit, status } = parsed.data;
    const data = await campaignService.listCampaigns(page, limit, status as CampaignStatus);

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error listing campaigns:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/email-campaigns
 * Create a new campaign in draft status.
 */
export async function POST(request: NextRequest) {
  try {
    const result = await authenticateAdmin();
    if ('error' in result) return result.error;

    const body = await request.json();
    const parsed = createCampaignSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const campaign = await campaignService.createCampaign(parsed.data, result.email);
    return NextResponse.json(campaign, { status: 201 });
  } catch (error) {
    console.error('Error creating campaign:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
