import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { exportResponsesCsv } from '@/db/services/survey-analytics';
import { logAdminAudit } from '@/lib/audit';
import { toCsvRow } from '@/lib/csv';
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

const CHUNK_ROWS = 500;

/**
 * GET /api/admin/surveys/[surveyVersionId]/export — streams coded responses as CSV.
 * Requires survey:analyze. `includeText=true` adds free-text columns. Every export is audited.
 */
export async function GET(request: NextRequest, { params }: RouteContext) {
  return withSurveyPermission('survey:analyze', async (actor) => {
    const { surveyVersionId } = await params;
    if (!isUuid(surveyVersionId)) return badRequest('Invalid survey version id');
    const search = request.nextUrl.searchParams;
    const studyId = optionalString(search.get('studyId'));
    if (studyId && !isUuid(studyId)) return badRequest('Invalid study id');
    const filters = {
      studyId,
      cohortKey: optionalString(search.get('cohort')),
      from: parseDateParam(search.get('from')),
      to: parseDateParam(search.get('to'), true),
    };
    const includeText = search.get('includeText') === 'true';

    const exported = await exportResponsesCsv({ surveyVersionId, ...filters, includeText });
    if (!exported) return NextResponse.json({ error: 'Survey version not found' }, { status: 404 });

    await logAdminAudit({
      actorEmail: actor.email,
      action: 'survey.export',
      entityType: 'survey_version',
      entityId: surveyVersionId,
      metadata: {
        studyId: filters.studyId ?? null,
        cohortKey: filters.cohortKey ?? null,
        from: filters.from?.toISOString() ?? null,
        to: filters.to?.toISOString() ?? null,
        includeText,
        rowCount: exported.rowCount,
      },
    });

    const encoder = new TextEncoder();
    let index = 0;
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode(`${toCsvRow(exported.header)}\r\n`));
      },
      pull(controller) {
        if (index >= exported.rows.length) {
          controller.close();
          return;
        }
        const chunk = exported.rows.slice(index, index + CHUNK_ROWS);
        index += CHUNK_ROWS;
        controller.enqueue(encoder.encode(chunk.map((row) => `${toCsvRow(row)}\r\n`).join('')));
      },
    });

    const stamp = new Date().toISOString().slice(0, 10);
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="survey-${surveyVersionId}-${stamp}.csv"`,
        'Cache-Control': 'no-store',
      },
    });
  });
}
