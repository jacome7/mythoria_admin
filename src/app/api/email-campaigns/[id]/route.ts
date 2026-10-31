import { NextResponse, type NextRequest } from 'next/server';
import { authenticateAdmin } from '@/lib/api-helpers';
import { campaignService } from '@/db/services/campaigns';
import {
  updateCampaignSchema,
  campaignAssetSchema,
  SURVEY_AUDIENCE_SOURCE,
} from '@/lib/schemas/campaigns';
import {
  findMissingSurveyAssetVariables,
  SurveyAssetValidationError,
} from '@/lib/surveys/asset-requirements';

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
    const [progress, batchHistory, successMetrics] = await Promise.all([
      campaignService.getCampaignProgress(id),
      campaignService.getBatchHistory(id, 1, 10),
      campaignService.getCampaignSuccessMetrics(id),
    ]);

    // For survey reminders, expose the sibling invite's start so the UI can warn about ordering.
    let surveyContext: { siblingInviteStartAt: string | null } | undefined;
    if (
      campaign.audienceSource === SURVEY_AUDIENCE_SOURCE &&
      campaign.surveyAudienceMode === 'reminder' &&
      campaign.surveyStudyId
    ) {
      const siblings = await campaignService.listSurveyCampaigns(campaign.surveyStudyId);
      const invite = siblings.find(
        (sibling) =>
          sibling.surveyCohortKey === campaign.surveyCohortKey &&
          sibling.surveyAudienceMode === 'invite' &&
          sibling.status !== 'cancelled',
      );
      surveyContext = { siblingInviteStartAt: invite?.startAt?.toISOString() ?? null };
    }

    return NextResponse.json({
      ...campaign,
      progress,
      batchHistory,
      successMetrics,
      ...(surveyContext ? { surveyContext } : {}),
    });
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
    const requestUrl =
      (request as { nextUrl?: URL }).nextUrl ?? (request.url ? new URL(request.url) : null);
    const deleteAssetId = requestUrl?.searchParams.get('deleteAsset');
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
      // Validate every asset before saving any, so a rejected locale never leaves a partial save.
      const parsedAssets = [];
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
        parsedAssets.push(assetParsed.data);
      }
      const existing = await campaignService.getCampaign(id);
      if (existing?.audienceSource === 'survey_invitations') {
        for (const asset of parsedAssets) {
          const missing = findMissingSurveyAssetVariables(asset);
          if (missing.length > 0) throw new SurveyAssetValidationError(missing, asset.language);
        }
      }
      for (const asset of parsedAssets) {
        await campaignService.upsertCampaignAsset(id, asset);
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
    if (error instanceof SurveyAssetValidationError) {
      return NextResponse.json(
        { error: error.message, missing: error.missing, language: error.language },
        { status: 400 },
      );
    }
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
