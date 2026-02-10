import { NextResponse, type NextRequest } from 'next/server';
import { authenticateAdmin } from '@/lib/api-helpers';
import { campaignService } from '@/db/services/campaigns';
import { updateCampaignSchema, campaignAssetSchema } from '@/lib/schemas/campaigns';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/email-campaigns/[id]
 * Get campaign detail with assets.
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const result = await authenticateAdmin();
    if ('error' in result) return result.error;

    const { id } = await params;
    const campaign = await campaignService.getCampaign(id);

    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    // Also fetch batch history and progress
    const [progress, batchHistory] = await Promise.all([
      campaignService.getCampaignProgress(id),
      campaignService.getBatchHistory(id, 1, 10),
    ]);

    return NextResponse.json({ ...campaign, progress, batchHistory });
  } catch (error) {
    console.error('Error fetching campaign:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PATCH /api/email-campaigns/[id]
 * Update campaign metadata and/or upsert assets.
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const result = await authenticateAdmin();
    if ('error' in result) return result.error;

    const { id } = await params;
    const deleteAssetId = request.nextUrl.searchParams.get('deleteAsset');
    const body = await request.json();

    // Handle asset deletion if requested via query param
    if (deleteAssetId) {
      const deleted = await campaignService.deleteCampaignAsset(deleteAssetId);
      if (!deleted) {
        return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
      }
      const campaign = await campaignService.getCampaign(id);
      return NextResponse.json(campaign);
    }

    // Handle asset upserts if included
    if (body.assets && Array.isArray(body.assets)) {
      for (const asset of body.assets) {
        const assetParsed = campaignAssetSchema.safeParse(asset);
        if (!assetParsed.success) {
          return NextResponse.json(
            {
              error: 'Asset validation failed',
              details: assetParsed.error.flatten(),
              language: asset.language,
            },
            { status: 400 },
          );
        }
        await campaignService.upsertCampaignAsset(id, assetParsed.data);
      }
    }

    // Handle metadata update
    const metadata = Object.fromEntries(Object.entries(body).filter(([key]) => key !== 'assets'));
    if (Object.keys(metadata).length > 0) {
      const parsed = updateCampaignSchema.safeParse(metadata);
      if (!parsed.success) {
        return NextResponse.json(
          { error: 'Validation failed', details: parsed.error.flatten() },
          { status: 400 },
        );
      }

      const updated = await campaignService.updateCampaign(id, parsed.data, result.email);
      if (!updated) {
        return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
      }
    }

    // Return full updated campaign
    const campaign = await campaignService.getCampaign(id);
    return NextResponse.json(campaign);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    const status = message.includes('Cannot') ? 409 : 500;
    console.error('Error updating campaign:', error);
    return NextResponse.json({ error: message }, { status });
  }
}

/**
 * DELETE /api/email-campaigns/[id]
 * Delete a draft or cancelled campaign.
 */
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const result = await authenticateAdmin();
    if ('error' in result) return result.error;

    const { id } = await params;
    const deleted = await campaignService.deleteCampaign(id);

    if (!deleted) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    const status = message.includes('Cannot') ? 409 : 500;
    console.error('Error deleting campaign:', error);
    return NextResponse.json({ error: message }, { status });
  }
}
