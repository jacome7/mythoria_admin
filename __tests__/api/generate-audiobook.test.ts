/** @jest-environment node */
import { POST } from '@/app/api/admin/stories/[storyId]/generate-audiobook/route';
import { auth } from '@/auth';
import { adminService } from '@/db/services';
import { publishAudiobookRequest } from '@/lib/pubsub';

jest.mock('@/auth', () => ({ auth: jest.fn() }));
jest.mock('@/db/services', () => ({
  adminService: { getStoryByIdWithAuthor: jest.fn(), updateStory: jest.fn() },
}));
jest.mock('@/lib/pubsub', () => ({ publishAudiobookRequest: jest.fn() }));
jest.mock('@/lib/audit', () => ({ logAdminAudit: jest.fn() }));
jest.mock('uuid', () => ({ v4: () => 'd65bb5f3-204a-479d-b4df-9ee71f6c513e' }));

const publicOrigin = 'https://admin.example.test';
const storyId = 'eb417f3e-ffb1-4168-958e-ddc463ebb00f';

function request(origin: string) {
  return POST(
    new Request(`http://localhost:8080/api/admin/stories/${storyId}/generate-audiobook`, {
      method: 'POST',
      headers: { origin, 'content-type': 'application/json' },
      body: '{}',
    }),
    { params: Promise.resolve({ storyId }) },
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.replaceProperty(process, 'env', { ...process.env, NEXTAUTH_URL: publicOrigin });
  (auth as jest.Mock).mockResolvedValue({ user: { email: 'staff@mythoria.pt' } });
  (adminService.getStoryByIdWithAuthor as jest.Mock).mockResolvedValue({ status: 'published' });
});

afterEach(() => jest.restoreAllMocks());

it('queues narration for the public Admin origin behind the proxy', async () => {
  expect((await request(publicOrigin)).status).toBe(202);
  expect(publishAudiobookRequest).toHaveBeenCalledWith(
    expect.objectContaining({ storyId, source: 'admin-portal' }),
  );
});

it.each(['https://other.example.test', 'http://localhost:8080'])(
  'rejects %s before dispatch',
  async (origin) => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    expect((await request(origin)).status).toBe(403);
    expect(publishAudiobookRequest).not.toHaveBeenCalled();
  },
);
