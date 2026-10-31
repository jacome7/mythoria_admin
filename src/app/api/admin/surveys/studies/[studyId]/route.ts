import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { campaignService } from '@/db/services/campaigns';
import { logAdminAudit } from '@/lib/audit';
import { callSurveyDomain } from '@/services/surveys';
import { updateStudySchema } from '@/lib/surveys/study-schemas';
import { runSurveyRoute } from '@/lib/surveys/study-api';
import { normalizeStudyDetail } from '@/lib/surveys/study-types';

export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ studyId: string }> };

async function parseStudyId(context: Context): Promise<string> {
  return z
    .string()
    .uuid()
    .parse((await context.params).studyId);
}

/** GET — study detail plus the backoffice survey campaigns created for it. */
export async function GET(request: NextRequest, context: Context) {
  return runSurveyRoute(request, 'survey:view', async (actor) => {
    const studyId = await parseStudyId(context);
    const [detail, campaigns] = await Promise.all([
      callSurveyDomain('getStudy', { studyId }, actor),
      campaignService.listSurveyCampaigns(studyId),
    ]);
    return {
      ...normalizeStudyDetail(detail),
      campaigns: campaigns.map((campaign) => ({
        id: campaign.id,
        title: campaign.title,
        status: campaign.status,
        cohortKey: campaign.surveyCohortKey,
        mode: campaign.surveyAudienceMode,
        startAt: campaign.startAt,
        endAt: campaign.endAt,
      })),
    };
  });
}

/** PATCH — update a draft study. */
export async function PATCH(request: NextRequest, context: Context) {
  return runSurveyRoute(request, 'survey:manage', async (actor) => {
    const studyId = await parseStudyId(context);
    const input = updateStudySchema.parse(await request.json());
    const study = await callSurveyDomain('updateStudy', { studyId, ...input }, actor);
    await logAdminAudit({
      actorEmail: actor.email,
      action: 'survey_study.update',
      entityType: 'survey_study',
      entityId: studyId,
      metadata: { fields: Object.keys(input) },
    });
    return study;
  });
}
