/** @jest-environment node */
import { GET } from '@/app/api/admin/stories/[storyId]/audio/[chapterIndex]/route';
import { auth } from '@/auth';
import { adminService } from '@/db/services';

const getRequestHeaders = jest.fn(async () => new Headers({ authorization: 'Bearer synthetic' }));
jest.mock('google-auth-library', () => ({
  GoogleAuth: jest.fn().mockImplementation(() => ({
    getIdTokenClient: async () => ({ getRequestHeaders }),
  })),
}));
jest.mock('@/auth', () => ({ auth: jest.fn() }));
jest.mock('@/db/services', () => ({ adminService: { getStoryById: jest.fn() } }));

const storyId = 'eb417f3e-ffb1-4168-958e-ddc463ebb00f';
const revision = 'af14c317-c9c8-4922-87e2-67983cd2ae81';
const runId = 'd65bb5f3-204a-479d-b4df-9ee71f6c513e';
const digest = 'a'.repeat(64);
const story = {
  status: 'published',
  features: {
    premiumBook: { version: 1, type: 'premium_children', state: 'published', revision },
  },
  audiobookUri: {
    type: 'premium_children',
    revision,
    runId,
    duration: 3,
    audio: {
      key: `${storyId}/premium/revisions/${revision}/audiobooks/${runId}/audiobook-${digest}.mp3`,
      sha256: digest,
      generation: '123',
      bytes: 4,
    },
  },
};

function request(index: number, query: string, range?: string) {
  return GET(
    new Request(`https://admin.example.test/audio/${index}?${query}`, {
      headers: range ? { range } : {},
    }),
    { params: Promise.resolve({ storyId, chapterIndex: String(index) }) },
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  (auth as jest.Mock).mockResolvedValue({ user: { email: 'staff@mythoria.pt' } });
  (adminService.getStoryById as jest.Mock).mockResolvedValue(story);
});

afterEach(() => {
  jest.restoreAllMocks();
});

it('streams a range with attachment and public-safe headers through authenticated SGW', async () => {
  jest.replaceProperty(process, 'env', {
    ...process.env,
    STORY_GENERATION_WORKFLOW_URL: 'https://sgw.example.test',
    STORY_GENERATION_WORKFLOW_API_KEY: 'synthetic-key',
  });
  const upstream = jest.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response('bc', {
      status: 206,
      headers: { 'content-length': '2', 'content-range': 'bytes 1-2/4' },
    }),
  );

  const response = await request(0, `runId=${runId}&download=1`, 'bytes=1-2');
  expect(response.status).toBe(206);
  expect(response.headers.get('content-length')).toBe('2');
  expect(response.headers.get('content-range')).toBe('bytes 1-2/4');
  expect(response.headers.get('cache-control')).toBe('private, no-store');
  expect(response.headers.get('content-disposition')).toContain('attachment');
  await expect(response.text()).resolves.toBe('bc');
  const [url, init] = upstream.mock.calls[0];
  expect(String(url)).toBe(
    `https://sgw.example.test/internal/audiobook/premium/${storyId}/${runId}/0`,
  );
  expect(new Headers(init?.headers).get('authorization')).toBe('Bearer synthetic');
  expect(new Headers(init?.headers).get('x-api-key')).toBe('synthetic-key');
  expect(new Headers(init?.headers).get('range')).toBe('bytes=1-2');
});

it('blocks unauthorized, stale and out-of-bounds requests before fetching SGW', async () => {
  (auth as jest.Mock).mockResolvedValueOnce(null);
  const upstream = jest.spyOn(globalThis, 'fetch');
  expect((await request(0, `runId=${runId}`)).status).toBe(401);
  expect((await request(0, 'runId=stale')).status).toBe(404);
  expect((await request(1, `runId=${runId}`)).status).toBe(404);
  expect(upstream).not.toHaveBeenCalled();
});
