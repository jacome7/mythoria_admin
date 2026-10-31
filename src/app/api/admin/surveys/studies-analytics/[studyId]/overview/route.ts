import { NextResponse } from 'next/server';
import { getStudyOverview } from '@/db/services/survey-analytics';
import { badRequest, isUuid, withSurveyPermission } from '@/lib/surveys/api';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ studyId: string }>;
}

/** GET /api/admin/surveys/studies-analytics/[studyId]/overview — per-cohort funnel (survey:view). */
export async function GET(_request: Request, { params }: RouteContext) {
  return withSurveyPermission('survey:view', async () => {
    const { studyId } = await params;
    if (!isUuid(studyId)) return badRequest('Invalid study id');
    const result = await getStudyOverview(studyId);
    if (!result) return NextResponse.json({ error: 'Study not found' }, { status: 404 });
    return NextResponse.json(result);
  });
}
