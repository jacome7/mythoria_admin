import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getBusinessOutcomes } from '@/db/services/survey-analytics';
import { badRequest, isUuid, withSurveyPermission } from '@/lib/surveys/api';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ studyId: string }>;
}

/** GET /api/admin/surveys/studies-analytics/[studyId]/outcomes?windowDays=7|30 — ADM-013. */
export async function GET(request: NextRequest, { params }: RouteContext) {
  return withSurveyPermission('survey:view', async () => {
    const { studyId } = await params;
    if (!isUuid(studyId)) return badRequest('Invalid study id');
    const raw = request.nextUrl.searchParams.get('windowDays') ?? '30';
    if (raw !== '7' && raw !== '30') return badRequest('windowDays must be 7 or 30');
    return NextResponse.json(
      await getBusinessOutcomes({ studyId, windowDays: raw === '7' ? 7 : 30 }),
    );
  });
}
