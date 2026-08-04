import { POST as restartStory } from '@/app/api/admin/stories/[storyId]/restart/route';
import { POST as retryWorkflow } from '@/app/api/workflows/[runId]/retry/route';
import { auth } from '@/auth';
import { isAllowedEmailDomain } from '@/config/auth';
import { adminService } from '@/db/services';
import { restartStoryGeneration } from '@/services/story-generation-restart';

jest.mock('@/auth', () => ({ auth: jest.fn() }));
jest.mock('@/config/auth', () => ({
  ALLOWED_DOMAINS: ['@mythoria.pt'],
  isAllowedEmailDomain: jest.fn(),
}));
jest.mock('@/db/services', () => ({
  adminService: {
    getWorkflowRunById: jest.fn(),
  },
}));
jest.mock('@/services/story-generation-restart', () => ({
  StoryGenerationRestartError: class StoryGenerationRestartError extends Error {},
  restartStoryGeneration: jest.fn(),
}));

const mockAuth = jest.mocked(auth);
const mockIsAllowedEmailDomain = jest.mocked(isAllowedEmailDomain);
const mockAdminService = jest.mocked(adminService);
const mockRestartStoryGeneration = jest.mocked(restartStoryGeneration);

describe('story generation restart API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { email: 'admin@mythoria.pt' } } as never);
    mockIsAllowedEmailDomain.mockReturnValue(true);
  });

  it('uses the shared restart dispatcher for the Admin UI route', async () => {
    mockRestartStoryGeneration.mockResolvedValue({
      storyId: 'story-1',
      runId: 'run-1',
      status: 'published',
      messageId: 'message-1',
    });

    const response = await restartStory(new Request('http://localhost') as never, {
      params: Promise.resolve({ storyId: 'story-1' }),
    });

    expect(response.status).toBe(200);
    expect(mockRestartStoryGeneration).toHaveBeenCalledWith({
      storyId: 'story-1',
      source: 'mythoria-admin',
      requestedBy: 'admin@mythoria.pt',
    });
  });

  it('returns an accepted response that exposes immediate dispatch failure', async () => {
    mockRestartStoryGeneration.mockResolvedValue({
      storyId: 'story-1',
      runId: 'run-1',
      status: 'retrying',
      dispatchError: 'Pub/Sub unavailable',
    });

    const response = await restartStory(new Request('http://localhost') as never, {
      params: Promise.resolve({ storyId: 'story-1' }),
    });
    const payload = await response.json();

    expect(response.status).toBe(202);
    expect(payload.dispatchFailed).toBe(true);
    expect(payload.status).toBe('retrying');
  });

  it('uses the shared zero-credit dispatcher for retries from the workflows UI', async () => {
    mockAdminService.getWorkflowRunById.mockResolvedValue({
      runId: 'failed-run',
      storyId: 'story-1',
      status: 'failed',
    } as never);
    mockRestartStoryGeneration.mockResolvedValue({
      storyId: 'story-1',
      runId: 'replacement-run',
      status: 'published',
      messageId: 'message-1',
    });

    const response = await retryWorkflow(new Request('http://localhost') as never, {
      params: Promise.resolve({ runId: 'failed-run' }),
    });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(mockRestartStoryGeneration).toHaveBeenCalledWith({
      storyId: 'story-1',
      source: 'mythoria-admin',
      requestedBy: 'admin@mythoria.pt',
    });
    expect(payload).toMatchObject({
      originalRunId: 'failed-run',
      newRunId: 'replacement-run',
      dispatchFailed: false,
    });
  });
});
