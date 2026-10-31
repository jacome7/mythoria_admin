import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getSurveyResults } from '@/db/services/survey-analytics';
import {
  badRequest,
  isUuid,
  optionalString,
  parseDateParam,
  withSurveyPermission,
} from '@/lib/surveys/api';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ surveyVersionId: string }>;
}

/** GET /api/admin/surveys/[surveyVersionId]/results — funnel + per-question results (survey:view). */
export async function GET(request: NextRequest, { params }: RouteContext) {
  return withSurveyPermission('survey:view', async () => {
    const { surveyVersionId } = await params;
    if (!isUuid(surveyVersionId)) return badRequest('Invalid survey version id');
    const search = request.nextUrl.searchParams;
    const studyId = optionalString(search.get('studyId'));
    if (studyId && !isUuid(studyId)) return badRequest('Invalid study id');
    const result = await getSurveyResults({
      surveyVersionId,
      studyId,
      cohortKey: optionalString(search.get('cohort')),
      from: parseDateParam(search.get('from')),
      to: parseDateParam(search.get('to'), true),
      locale: optionalString(search.get('locale')),
      respondentLocale: optionalString(search.get('respondentLocale')),
    });
    if (!result) return NextResponse.json({ error: 'Survey version not found' }, { status: 404 });
    return NextResponse.json(result);
  });
}
