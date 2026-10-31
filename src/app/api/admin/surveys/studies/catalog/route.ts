import type { NextRequest } from 'next/server';
import { callSurveyDomain } from '@/services/surveys';
import { runSurveyRoute } from '@/lib/surveys/study-api';

export const dynamic = 'force-dynamic';

/** GET /api/admin/surveys/studies/catalog — published surveys and versions (cohort selectors). */
export async function GET(request: NextRequest) {
  return runSurveyRoute(request, 'survey:view', (actor) =>
    callSurveyDomain('listSurveys', {}, actor),
  );
}
