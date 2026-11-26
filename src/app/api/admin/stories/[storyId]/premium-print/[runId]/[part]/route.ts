import { z } from 'zod';
import { authenticateAdmin } from '@/lib/api-helpers';
import { logAdminAudit } from '@/lib/audit';
import { premiumPrintPart } from '@/lib/premium-print';
import { getPremiumPrintDownload, PremiumPrintError } from '@/services/premium-print';

const input = z.object({
  storyId: z.uuid().toLowerCase(),
  revision: z.uuid().toLowerCase(),
  runId: z.uuid().toLowerCase(),
  part: premiumPrintPart,
});
const headers = { 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer' };

export async function GET(
  request: Request,
  { params }: { params: Promise<{ storyId: string; runId: string; part: string }> },
) {
  const actor = await authenticateAdmin();
  if ('error' in actor) return actor.error;
  const parsed = input.safeParse({
    ...(await params),
    revision: new URL(request.url).searchParams.get('revision'),
  });
  if (!parsed.success) return new Response(null, { status: 404, headers });
  const { storyId, revision, runId, part } = parsed.data;
  try {
    const url = await getPremiumPrintDownload(storyId, revision, runId, part, request.signal);
    await logAdminAudit({
      actorEmail: actor.email,
      action: 'premium_print.download_issued',
      entityType: 'story',
      entityId: storyId,
      metadata: { revision, runId, part },
    });
    return new Response(null, { status: 303, headers: { ...headers, Location: url.href } });
  } catch (error) {
    const status = error instanceof PremiumPrintError ? error.status : 502;
    return new Response('This PDF is unavailable. Return to the story and refresh the export.', {
      status,
      headers,
    });
  }
}
