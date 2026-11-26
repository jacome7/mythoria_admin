import { z } from 'zod';
import { authenticateAdmin } from '@/lib/api-helpers';
import { hasTrustedAdminOrigin } from '@/lib/admin-request-origin';
import { logAdminAudit } from '@/lib/audit';
import { getPremiumPrintStatus, PremiumPrintError } from '@/services/premium-print';

const headers = { 'Cache-Control': 'private, no-store' };
const input = z.object({ storyId: z.uuid().toLowerCase(), revision: z.uuid().toLowerCase() });
type Context = { params: Promise<{ storyId: string }> };

async function handleRequest(request: Request, { params }: Context, generate: boolean) {
  const actor = await authenticateAdmin();
  if ('error' in actor) return actor.error;
  if (generate && !hasTrustedAdminOrigin(request)) {
    return Response.json({ error: 'Forbidden' }, { status: 403, headers });
  }
  const parsed = input.safeParse({
    ...(await params),
    revision: new URL(request.url).searchParams.get('revision'),
  });
  if (!parsed.success) {
    return Response.json({ error: 'Invalid edition.' }, { status: 400, headers });
  }
  const { storyId, revision } = parsed.data;
  try {
    const data = await getPremiumPrintStatus(storyId, revision, request.signal, generate);
    if (generate && 'runId' in data) {
      await logAdminAudit({
        actorEmail: actor.email,
        action: 'premium_print.requested',
        entityType: 'story',
        entityId: storyId,
        metadata: { revision, runId: data.runId, status: data.status },
      });
    }
    return Response.json(
      { data },
      { status: generate && data.status === 'queued' ? 202 : 200, headers },
    );
  } catch (error) {
    const status = error instanceof PremiumPrintError ? error.status : 502;
    return Response.json(
      {
        error:
          status === 404 || status === 409
            ? 'This published edition is unavailable. Refresh the story to check its current revision.'
            : 'The PDF export is temporarily unavailable.',
      },
      { status, headers },
    );
  }
}

export function GET(request: Request, context: Context) {
  return handleRequest(request, context, false);
}

export function POST(request: Request, context: Context) {
  return handleRequest(request, context, true);
}
