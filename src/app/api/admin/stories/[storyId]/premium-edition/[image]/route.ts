import { z } from 'zod';
import { authenticateAdmin } from '@/lib/api-helpers';
import { callPremiumEditionImage, PrintDomainError } from '@/services/print';

const inputSchema = z.object({
  storyId: z.uuid().toLowerCase(),
  image: z.string().regex(/^(front|back|motif|[1-9]\d?)$/),
  revision: z.uuid().toLowerCase(),
});
const headers = { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' };

export async function GET(
  request: Request,
  { params }: { params: Promise<{ storyId: string; image: string }> },
) {
  const actor = await authenticateAdmin();
  if ('error' in actor) return actor.error;
  const parsed = inputSchema.safeParse({
    ...(await params),
    revision: new URL(request.url).searchParams.get('revision'),
  });
  if (!parsed.success) return new Response(null, { status: 404, headers });
  try {
    const { bytes, contentType } = await callPremiumEditionImage(parsed.data, actor.email);
    return new Response(bytes, { headers: { ...headers, 'Content-Type': contentType } });
  } catch (error) {
    const status = error instanceof PrintDomainError ? error.status : 502;
    return new Response(null, { status, headers });
  }
}
