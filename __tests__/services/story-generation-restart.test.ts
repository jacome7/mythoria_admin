import { getMythoriaDb } from '@/db';
import { publishStoryRequest } from '@/lib/pubsub';
import { resumePremiumGeneration } from '@/services/premium-generation-resume';
jest.mock('@/services/premium-generation-resume', () => ({ resumePremiumGeneration: jest.fn() }));
jest.mock('@/lib/audit', () => ({ logAdminAudit: jest.fn() }));
import {
  restartStoryGeneration,
  StoryGenerationRestartError,
} from '@/services/story-generation-restart';

jest.mock('crypto', () => ({ randomUUID: () => '00000000-0000-4000-8000-000000000001' }));

jest.mock('@/db', () => ({
  getMythoriaDb: jest.fn(),
}));

jest.mock('@/lib/pubsub', () => ({
  publishStoryRequest: jest.fn(),
}));

const mockGetMythoriaDb = jest.mocked(getMythoriaDb);
const mockPublishStoryRequest = jest.mocked(publishStoryRequest);

function createDatabaseMock(options?: {
  storyStatus?: string;
  publishAttempts?: number;
  features?: unknown;
}) {
  const storyStatus = options?.storyStatus ?? 'published';
  const publishAttempts = options?.publishAttempts ?? 0;
  const request = {
    runId: '00000000-0000-4000-8000-000000000001',
    storyId: 'story-1',
    authorId: 'author-1',
    status: 'publishing',
    publishAttempts,
  };
  const transactionInsertValues = jest.fn().mockResolvedValue(undefined);
  const transactionUpdateSet = jest.fn(() => ({
    where: jest.fn().mockResolvedValue(undefined),
  }));
  const tx = {
    select: jest.fn(() => ({
      from: jest.fn(() => ({
        where: jest.fn().mockResolvedValue(
          storyStatus === 'missing'
            ? []
            : [
                {
                  storyId: 'story-1',
                  authorId: 'author-1',
                  status: storyStatus,
                  features: options?.features,
                },
              ],
        ),
      })),
    })),
    insert: jest.fn(() => ({ values: transactionInsertValues })),
    update: jest.fn(() => ({ set: transactionUpdateSet })),
  };

  const claimReturning = jest.fn().mockResolvedValue([request]);
  const publishedWhere = jest.fn().mockResolvedValue(undefined);
  const retryWhere = jest.fn().mockResolvedValue(undefined);
  const update = jest
    .fn()
    .mockReturnValueOnce({
      set: jest.fn(() => ({
        where: jest.fn(() => ({ returning: claimReturning })),
      })),
    })
    .mockReturnValueOnce({
      set: jest.fn(() => ({ where: publishedWhere })),
    })
    .mockReturnValueOnce({
      set: jest.fn(() => ({ where: retryWhere })),
    });

  const db = {
    transaction: jest.fn(async (callback: (transaction: typeof tx) => unknown) => callback(tx)),
    update,
    select: jest.fn(),
  };

  return { db, tx, transactionInsertValues, transactionUpdateSet, update };
}

describe('restartStoryGeneration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('persists the durable request before publishing the stable Pub/Sub contract', async () => {
    const { db, transactionInsertValues, transactionUpdateSet } = createDatabaseMock();
    mockGetMythoriaDb.mockReturnValue(db as never);
    mockPublishStoryRequest.mockResolvedValue('message-1');

    await expect(
      restartStoryGeneration({
        storyId: 'story-1',
        source: 'mythoria-admin',
        requestedBy: 'admin@mythoria.pt',
      }),
    ).resolves.toEqual({
      storyId: 'story-1',
      runId: '00000000-0000-4000-8000-000000000001',
      status: 'published',
      messageId: 'message-1',
    });

    expect(transactionInsertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        storyId: 'story-1',
        authorId: 'author-1',
        creditsSpent: 0,
        status: 'queued',
      }),
    );
    expect(transactionInsertValues).toHaveBeenCalledTimes(1);
    expect(transactionUpdateSet).toHaveBeenCalledWith(
      expect.objectContaining({ storyGenerationStatus: 'queued' }),
    );
    expect(mockPublishStoryRequest).toHaveBeenCalledWith({
      storyId: 'story-1',
      runId: '00000000-0000-4000-8000-000000000001',
    });
  });

  it('keeps a failed immediate publish in retrying state', async () => {
    const { db, update } = createDatabaseMock();
    mockGetMythoriaDb.mockReturnValue(db as never);
    mockPublishStoryRequest.mockRejectedValue(new Error('Pub/Sub unavailable'));

    const result = await restartStoryGeneration({
      storyId: 'story-1',
      source: 'mythoria-admin-mcp',
    });

    expect(result).toMatchObject({ status: 'retrying', dispatchError: 'Pub/Sub unavailable' });
    expect(update).toHaveBeenCalledTimes(2);
  });

  it('rejects stories outside the supported restart states', async () => {
    const { db, tx } = createDatabaseMock({ storyStatus: 'draft' });
    mockGetMythoriaDb.mockReturnValue(db as never);

    await expect(
      restartStoryGeneration({ storyId: 'story-1', source: 'mythoria-admin' }),
    ).rejects.toEqual(
      expect.objectContaining<Partial<StoryGenerationRestartError>>({
        status: 409,
        code: 'story_not_restartable',
      }),
    );
    expect(tx.insert).not.toHaveBeenCalled();
    expect(mockPublishStoryRequest).not.toHaveBeenCalled();
  });
  it('resumes an accepted premium run without inserting a new request or debit', async () => {
    const revision = '00000000-0000-4000-8000-000000000080';
    const { db, tx } = createDatabaseMock({
      features: {
        premiumBook: {
          version: 1,
          type: 'premium_children',
          state: 'queued',
          ownerId: 'author-1',
          revision,
        },
      },
    });
    mockGetMythoriaDb.mockReturnValue(db as never);
    jest.mocked(resumePremiumGeneration).mockResolvedValue(true);
    const input = { storyId: 'story-1', source: 'mythoria-admin' as const };
    await expect(
      restartStoryGeneration({ ...input, expectedRunId: 'older' }),
    ).rejects.toMatchObject({ status: 409 });
    expect(await restartStoryGeneration(input)).toMatchObject({ runId: revision });
    expect(resumePremiumGeneration).toHaveBeenCalledWith(input.storyId, revision);
    expect(tx.insert).not.toHaveBeenCalled();
    expect(mockPublishStoryRequest).not.toHaveBeenCalled();
  });
});
