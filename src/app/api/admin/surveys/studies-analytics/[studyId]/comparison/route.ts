import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getCrossCohortComparison } from '@/db/services/survey-analytics';
import { badRequest, isUuid, optionalString, withSurveyPermission } from '@/lib/surveys/api';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ studyId: string }>;
}

/** GET /api/admin/surveys/studies-analytics/[studyId]/comparison — cross-cohort shared dimensions. */
export async function GET(request: NextRequest, { params }: RouteContext) {
  return withSurveyPermission('survey:view', async () => {
    const { studyId } = await params;
    if (!isUuid(studyId)) return badRequest('Invalid study id');
    const locale = optionalString(request.nextUrl.searchParams.get('locale'));
    return NextResponse.json(await getCrossCohortComparison(studyId, locale));
  });
}
