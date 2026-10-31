import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { logAdminAudit } from '@/lib/audit';
import { callSurveyDomain } from '@/services/surveys';
import { studyStatusSchema } from '@/lib/surveys/study-schemas';
import { runSurveyRoute } from '@/lib/surveys/study-api';

export const dynamic = 'force-dynamic';

/** POST /api/admin/surveys/studies/[studyId]/status — activate / close / archive a study. */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ studyId: string }> },
) {
  return runSurveyRoute(request, 'survey:manage', async (actor) => {
    const studyId = z
      .string()
      .uuid()
      .parse((await context.params).studyId);
    const { status } = studyStatusSchema.parse(await request.json());
    const study = await callSurveyDomain('setStudyStatus', { studyId, status }, actor);
    await logAdminAudit({
      actorEmail: actor.email,
      action: 'survey_study.set_status',
      entityType: 'survey_study',
      entityId: studyId,
      metadata: { status },
    });
    return study;
  });
}
