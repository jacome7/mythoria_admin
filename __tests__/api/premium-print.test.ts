/** @jest-environment node */
import { GET, POST } from '@/app/api/admin/stories/[storyId]/premium-print/route';
import { GET as download } from '@/app/api/admin/stories/[storyId]/premium-print/[runId]/[part]/route';
import { authenticateAdmin } from '@/lib/api-helpers';
import { logAdminAudit } from '@/lib/audit';

jest.mock('@/lib/api-helpers', () => ({ authenticateAdmin: jest.fn() }));
jest.mock('@/lib/audit', () => ({ logAdminAudit: jest.fn() }));
jest.mock('google-auth-library', () => ({
  GoogleAuth: jest.fn().mockImplementation(() => ({
    getIdTokenClient: async () => ({
      getRequestHeaders: async () => new Headers({ authorization: 'Bearer synthetic' }),
    }),
  })),
}));

const storyId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const revision = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const runId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const session = { email: 'staff@mythoria.pt' };
const context = { params: Promise.resolve({ storyId }) };
const endpoint = `https://admin.example/api/admin/stories/${storyId}/premium-print`;

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(authenticateAdmin).mockResolvedValue(session);
  jest.replaceProperty(process, 'env', {
    ...process.env,
    NEXTAUTH_URL: 'https://admin.example',
    STORY_GENERATION_WORKFLOW_URL: 'https://sgw.example',
    STORY_GENERATION_WORKFLOW_API_KEY: 'workflow-secret',
    ADMIN_API_KEY: 'admin-secret',
  });
});

afterEach(() => jest.restoreAllMocks());

it('requires staff authentication and a same-origin request before enqueueing', async () => {
  const upstream = jest.spyOn(globalThis, 'fetch');
  const post = (origin: string) =>
    POST(
      new Request(`${endpoint}?revision=${revision}`, { method: 'POST', headers: { origin } }),
      context,
    );
  jest
    .mocked(authenticateAdmin)
    .mockResolvedValueOnce({ error: Response.json({}, { status: 401 }) } as never);
  expect((await post('https://admin.example')).status).toBe(401);
  expect((await post('https://untrusted.example')).status).toBe(403);
  expect(upstream).not.toHaveBeenCalled();

  upstream.mockResolvedValueOnce(Response.json({ status: 'queued', runId }, { status: 202 }));
  expect(await (await post('https://admin.example')).json()).toEqual({
    data: { status: 'queued', runId },
  });
  const [url, init] = upstream.mock.calls[0];
  expect(String(url)).toBe(
    `https://sgw.example/internal/print/premium-admin/${storyId}/${revision}`,
  );
  expect(init?.method).toBe('POST');
  expect(new Headers(init?.headers).get('x-api-key')).toBe('workflow-secret');
  expect(new Headers(init?.headers).get('x-admin-api-key')).toBe('admin-secret');
  expect(logAdminAudit).toHaveBeenCalledWith(
    expect.objectContaining({
      actorEmail: session.email,
      metadata: { revision, runId, status: 'queued' },
    }),
  );
});

it('exposes ready variants without a signed URL and only redirects the requested part', async () => {
  const signed =
    'https://storage.googleapis.com/private/example.pdf?generation=123&X-Goog-Signature=signature';
  const upstream = jest
    .spyOn(globalThis, 'fetch')
    .mockResolvedValueOnce(
      Response.json({
        status: 'ready',
        source: 'self-print',
        runId,
        parts: ['interiorCmyk'],
        url: signed,
      }),
    )
    .mockResolvedValueOnce(Response.json({ url: signed }));
  const status = await GET(new Request(`${endpoint}?revision=${revision}`), context);
  expect(status.headers.get('cache-control')).toBe('private, no-store');
  expect(await status.json()).toEqual({
    data: { status: 'ready', source: 'self-print', runId, parts: ['interiorCmyk'] },
  });

  const result = await download(
    new Request(`${endpoint}/${runId}/interiorCmyk?revision=${revision}`),
    {
      params: Promise.resolve({ storyId, runId, part: 'interiorCmyk' }),
    },
  );
  expect(result.status).toBe(303);
  expect(result.headers.get('location')).toBe(signed);
  expect(result.headers.get('cache-control')).toBe('private, no-store');
  expect(upstream.mock.calls[1]?.[0].toString()).toBe(
    `https://sgw.example/internal/print/premium-admin/${storyId}/${revision}/${runId}/interiorCmyk`,
  );
  expect(logAdminAudit).toHaveBeenCalledWith(
    expect.objectContaining({ metadata: { revision, runId, part: 'interiorCmyk' } }),
  );
});

it('rejects a URL that is missing the GCS generation', async () => {
  jest.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
    Response.json({
      url: 'https://storage.googleapis.com/private/example.pdf?X-Goog-Signature=signature',
    }),
  );
  const result = await download(new Request(`${endpoint}/${runId}/cover?revision=${revision}`), {
    params: Promise.resolve({ storyId, runId, part: 'cover' }),
  });
  expect(result.status).toBe(502);
  expect(result.headers.get('location')).toBeNull();
  expect(logAdminAudit).not.toHaveBeenCalled();
});
