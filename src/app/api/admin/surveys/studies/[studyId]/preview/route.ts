import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { callSurveyDomain } from '@/services/surveys';
import { previewAudienceSchema } from '@/lib/surveys/study-schemas';
import { runSurveyRoute } from '@/lib/surveys/study-api';

export const dynamic = 'force-dynamic';

/** POST /api/admin/surveys/studies/[studyId]/preview — read-only cohort/audience preview. */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ studyId: string }> },
) {
  return runSurveyRoute(request, 'survey:view', async (actor) => {
    const studyId = z
      .string()
      .uuid()
      .parse((await context.params).studyId);
    const body = await request.json().catch(() => ({}));
    const input = previewAudienceSchema.parse(body);
    return callSurveyDomain('previewAudience', { studyId, ...input }, actor);
  });
}
