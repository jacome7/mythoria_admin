import { NextResponse } from 'next/server';
import { getRewardOps } from '@/db/services/survey-analytics';
import { badRequest, isUuid, withSurveyPermission } from '@/lib/surveys/api';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ studyId: string }>;
}

/** GET /api/admin/surveys/studies-analytics/[studyId]/rewards — ADM-014 (survey:view). */
export async function GET(_request: Request, { params }: RouteContext) {
  return withSurveyPermission('survey:view', async () => {
    const { studyId } = await params;
    if (!isUuid(studyId)) return badRequest('Invalid study id');
    return NextResponse.json(await getRewardOps(studyId));
  });
}
