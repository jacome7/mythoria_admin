import type { NextRequest } from 'next/server';
import { logAdminAudit } from '@/lib/audit';
import { callSurveyDomain } from '@/services/surveys';
import { createStudySchema } from '@/lib/surveys/study-schemas';
import { runSurveyRoute } from '@/lib/surveys/study-api';
import { normalizeStudyDetail } from '@/lib/surveys/study-types';

export const dynamic = 'force-dynamic';

/** GET /api/admin/surveys/studies — list studies with cohorts. */
export async function GET(request: NextRequest) {
  return runSurveyRoute(request, 'survey:view', (actor) =>
    callSurveyDomain('listStudies', {}, actor),
  );
}

/** POST /api/admin/surveys/studies — create a draft study. */
export async function POST(request: NextRequest) {
  return runSurveyRoute(
    request,
    'survey:manage',
    async (actor) => {
      const input = createStudySchema.parse(await request.json());
      const created = await callSurveyDomain<unknown>('createStudy', input, actor);
      const { study } = normalizeStudyDetail(created);
      await logAdminAudit({
        actorEmail: actor.email,
        action: 'survey_study.create',
        entityType: 'survey_study',
        entityId: study?.studyId,
        metadata: {
          studyKey: input.studyKey,
          cohorts: input.cohorts,
          holdoutPercent: input.holdoutPercent,
        },
      });
      return created;
    },
    { status: 201 },
  );
}
