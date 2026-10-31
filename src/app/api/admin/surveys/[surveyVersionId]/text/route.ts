import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getOpenTextAnswers } from '@/db/services/survey-analytics';
import { logAdminAudit } from '@/lib/audit';
import { badRequest, isUuid, optionalString, withSurveyPermission } from '@/lib/surveys/api';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ surveyVersionId: string }>;
}

/** GET /api/admin/surveys/[surveyVersionId]/text — free-text answers (survey:analyze, audited). */
export async function GET(request: NextRequest, { params }: RouteContext) {
  return withSurveyPermission('survey:analyze', async (actor) => {
    const { surveyVersionId } = await params;
    if (!isUuid(surveyVersionId)) return badRequest('Invalid survey version id');
    const search = request.nextUrl.searchParams;
    const studyId = optionalString(search.get('studyId'));
    if (studyId && !isUuid(studyId)) return badRequest('Invalid study id');
    const page = Math.max(Number.parseInt(search.get('page') ?? '1', 10) || 1, 1);
    const filters = {
      questionId: optionalString(search.get('questionId')),
      cohortKey: optionalString(search.get('cohort')),
      studyId,
      search: optionalString(search.get('search')),
    };
    const result = await getOpenTextAnswers({ surveyVersionId, ...filters, page });
    if (!result) return NextResponse.json({ error: 'Survey version not found' }, { status: 404 });
    await logAdminAudit({
      actorEmail: actor.email,
      action: 'survey.text.view',
      entityType: 'survey_version',
      entityId: surveyVersionId,
      metadata: { ...filters, page, returned: result.items.length, total: result.total },
    });
    return NextResponse.json(result);
  });
}
