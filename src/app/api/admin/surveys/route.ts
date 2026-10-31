import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { listSurveysOverview } from '@/db/services/survey-analytics';
import { optionalString, parseDateParam, withSurveyPermission } from '@/lib/surveys/api';

export const dynamic = 'force-dynamic';

/** GET /api/admin/surveys — ADM-001/002 survey list with filters (survey:view). */
export async function GET(request: NextRequest) {
  return withSurveyPermission('survey:view', async () => {
    const params = request.nextUrl.searchParams;
    const result = await listSurveysOverview({
      surveyId: optionalString(params.get('surveyId')),
      studyId: optionalString(params.get('studyId')),
      campaignId: optionalString(params.get('campaignId')),
      status: optionalString(params.get('status')),
      cohortKey: optionalString(params.get('cohort')),
      from: parseDateParam(params.get('from')),
      to: parseDateParam(params.get('to'), true),
    });
    return NextResponse.json(result);
  });
}
