import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { logAdminAudit } from '@/lib/audit';
import { createCampaignsSchema } from '@/lib/surveys/study-schemas';
import { createSurveyStudyCampaigns } from '@/lib/surveys/study-campaigns';
import { runSurveyRoute } from '@/lib/surveys/study-api';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/surveys/studies/[studyId]/create-campaigns — idempotently creates the invite and
 * reminder draft campaigns for each cohort and links them to the study in the WebApp.
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ studyId: string }> },
) {
  return runSurveyRoute(request, 'survey:manage', async (actor) => {
    const studyId = z
      .string()
      .uuid()
      .parse((await context.params).studyId);
    const body = await request.json().catch(() => ({}));
    const input = createCampaignsSchema.parse(body);
    const cohorts = await createSurveyStudyCampaigns({
      studyId,
      cohortKeys: input.cohortKeys,
      actorEmail: actor.email,
    });
    await logAdminAudit({
      actorEmail: actor.email,
      action: 'survey_campaigns.create',
      entityType: 'survey_study',
      entityId: studyId,
      metadata: { cohorts },
    });
    return { cohorts };
  });
}
