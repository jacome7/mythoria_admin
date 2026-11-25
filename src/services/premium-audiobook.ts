import { GoogleAuth } from 'google-auth-library';

const auth = new GoogleAuth();

export async function getPremiumAudioTrack(
  storyId: string,
  runId: string,
  index: number,
  range: string | null,
) {
  const base = process.env.STORY_GENERATION_WORKFLOW_URL;
  const key = process.env.STORY_GENERATION_WORKFLOW_API_KEY;
  if (!base || !key) throw new Error('Story generation workflow is not configured');
  const origin = new URL(base).origin;
  const client = await auth.getIdTokenClient(origin);
  const result = await client.request<ArrayBuffer>({
    url: new URL(
      `/internal/audiobook/premium/${encodeURIComponent(storyId)}/${encodeURIComponent(runId)}/${index}`,
      origin,
    ).href,
    headers: { 'x-api-key': key, ...(range && { range }) },
    responseType: 'arraybuffer',
    retry: false,
    timeout: 30_000,
    validateStatus: () => true,
  });
  const headers = new Headers({ 'Cache-Control': 'private, no-store' });
  if (result.status === 200 || result.status === 206 || result.status === 416) {
    headers.set('Content-Type', 'audio/mpeg');
    headers.set('Accept-Ranges', 'bytes');
    const contentRange = result.headers.get('content-range');
    if (contentRange) headers.set('Content-Range', contentRange);
    return new Response(result.status === 416 ? null : new Uint8Array(result.data), {
      status: result.status,
      headers,
    });
  }
  return new Response(null, { status: result.status === 404 ? 404 : 502, headers });
}
