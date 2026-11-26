import { GoogleAuth } from 'google-auth-library';
import { z } from 'zod';
import { premiumPrintStatus, type PremiumPrintPart } from '@/lib/premium-print';

const auth = new GoogleAuth();

export class PremiumPrintError extends Error {
  constructor(public readonly status: number) {
    super('Premium print request failed');
  }
}

async function callPremiumPrint(
  storyId: string,
  revision: string,
  signal: AbortSignal,
  options?: { method?: 'POST'; part?: PremiumPrintPart; runId?: string },
) {
  const base = process.env.STORY_GENERATION_WORKFLOW_URL;
  const key = process.env.STORY_GENERATION_WORKFLOW_API_KEY;
  const adminKey = process.env.ADMIN_API_KEY;
  if (!base || !key || !adminKey) throw new PremiumPrintError(503);
  const origin = new URL(base).origin;
  const suffix = options?.part ? `/${options.runId}/${options.part}` : '';
  const url = new URL(`/internal/print/premium-admin/${storyId}/${revision}${suffix}`, origin);
  const client = await auth.getIdTokenClient(origin);
  const headers = new Headers(await client.getRequestHeaders(url));
  headers.set('x-api-key', key);
  headers.set('x-admin-api-key', adminKey);

  const response = await fetch(url, {
    method: options?.method ?? 'GET',
    headers,
    redirect: 'error',
    cache: 'no-store',
    signal: AbortSignal.any([signal, AbortSignal.timeout(20_000)]),
  });
  if (!response.ok) {
    await response.body?.cancel();
    throw new PremiumPrintError([404, 409, 503].includes(response.status) ? response.status : 502);
  }
  return response.json();
}

export async function getPremiumPrintStatus(
  storyId: string,
  revision: string,
  signal: AbortSignal,
  generate = false,
) {
  return premiumPrintStatus.parse(
    await callPremiumPrint(storyId, revision, signal, generate ? { method: 'POST' } : undefined),
  );
}

export async function getPremiumPrintDownload(
  storyId: string,
  revision: string,
  runId: string,
  part: PremiumPrintPart,
  signal: AbortSignal,
) {
  const { url } = z
    .object({ url: z.url() })
    .parse(await callPremiumPrint(storyId, revision, signal, { part, runId }));
  const download = new URL(url);
  if (
    download.origin !== 'https://storage.googleapis.com' ||
    !download.searchParams.has('X-Goog-Signature') ||
    !download.searchParams.has('generation')
  ) {
    throw new PremiumPrintError(502);
  }
  return download;
}
