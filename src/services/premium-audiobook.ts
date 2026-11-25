import { GoogleAuth } from 'google-auth-library';

const auth = new GoogleAuth();

export async function getPremiumAudioTrack(
  storyId: string,
  runId: string,
  index: number,
  request: Request,
  download: boolean,
) {
  const base = process.env.STORY_GENERATION_WORKFLOW_URL;
  const key = process.env.STORY_GENERATION_WORKFLOW_API_KEY;
  if (!base || !key) throw new Error('Story generation workflow is not configured');
  const origin = new URL(base).origin;
  const client = await auth.getIdTokenClient(origin);
  const url = new URL(
    `/internal/audiobook/premium/${encodeURIComponent(storyId)}/${encodeURIComponent(runId)}/${index}`,
    origin,
  );
  const upstreamHeaders = new Headers(await client.getRequestHeaders(url));
  upstreamHeaders.set('x-api-key', key);
  const range = request.headers.get('range');
  if (range) upstreamHeaders.set('range', range);

  const deadline = new AbortController();
  const timer = setTimeout(() => deadline.abort(), 30_000);
  const result = await fetch(url, {
    headers: upstreamHeaders,
    redirect: 'error',
    cache: 'no-store',
    signal: AbortSignal.any([request.signal, deadline.signal]),
  }).finally(() => clearTimeout(timer));

  const headers = new Headers({ 'Cache-Control': 'private, no-store' });
  if (result.status === 200 || result.status === 206 || result.status === 416) {
    headers.set('Content-Type', 'audio/mpeg');
    headers.set('Accept-Ranges', 'bytes');
    headers.set('X-Content-Type-Options', 'nosniff');
    if (download)
      headers.set('Content-Disposition', 'attachment; filename="mythoria-audiobook.mp3"');
    for (const name of ['content-range', 'content-length']) {
      const value = result.headers.get(name);
      if (value) headers.set(name, value);
    }
    return new Response(result.body, { status: result.status, headers });
  }
  await result.body?.cancel();
  return new Response(null, { status: result.status === 404 ? 404 : 502, headers });
}
