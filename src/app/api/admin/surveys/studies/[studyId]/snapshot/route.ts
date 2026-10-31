import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { logAdminAudit } from '@/lib/audit';
import { callSurveyDomain } from '@/services/surveys';
import { snapshotAudienceSchema } from '@/lib/surveys/study-schemas';
import { runSurveyRoute } from '@/lib/surveys/study-api';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/surveys/studies/[studyId]/snapshot — freeze the audience into invitations.
 * `dryRun: true` reports what would be inserted without writing.
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ studyId: string }> },
) {
  return runSurveyRoute(request, 'survey:manage', async (actor) => {
    const studyId = z
      .string()
      .uuid()
      .parse((await context.params).studyId);
    const input = snapshotAudienceSchema.parse(await request.json());
    const result = await callSurveyDomain('snapshotAudience', { studyId, ...input }, actor);
    await logAdminAudit({
      actorEmail: actor.email,
      action: input.dryRun ? 'survey_audience.dry_run' : 'survey_audience.snapshot',
      entityType: 'survey_study',
      entityId: studyId,
      metadata: {
        cohortKeys: input.cohortKeys,
        notificationPreferences: input.notificationPreferences,
        dryRun: Boolean(input.dryRun),
        result,
      },
    });
    return result;
  });
}
