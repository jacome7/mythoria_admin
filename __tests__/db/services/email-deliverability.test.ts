import { getMythoriaDb } from '@/db';
import { markEmailBounced } from '@/db/services/emailDeliverability';

jest.mock('@/db', () => ({
  getMythoriaDb: jest.fn(),
}));

const mockGetMythoriaDb = jest.mocked(getMythoriaDb);

function selectQuery(result: unknown[]) {
  return {
    from: jest.fn().mockReturnThis(),
    where: jest.fn().mockResolvedValue(result),
  };
}

describe('markEmailBounced', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('matches the normalized email across leads and users', async () => {
    const updates: Array<Record<string, unknown>> = [];
    const tx = {
      select: jest
        .fn()
        .mockReturnValueOnce(selectQuery([{ id: 1, emailStatus: 'ready' }]))
        .mockReturnValueOnce(selectQuery([{ authorId: 'author-1', emailStatus: 'soft_bounce' }])),
      update: jest.fn(() => ({
        set: jest.fn((values: Record<string, unknown>) => {
          updates.push(values);
          return { where: jest.fn().mockResolvedValue(undefined) };
        }),
      })),
    };
    mockGetMythoriaDb.mockReturnValue({
      transaction: jest.fn((callback: (transaction: typeof tx) => unknown) => callback(tx)),
    } as never);

    await expect(markEmailBounced('  Person@Example.COM ', 'hard')).resolves.toEqual(
      expect.objectContaining({
        normalizedEmail: 'person@example.com',
        bounceType: 'hard',
        found: true,
        leadsMatched: 1,
        usersMatched: 1,
        updated: 2,
        unchanged: 0,
      }),
    );
    expect(updates).toEqual([
      expect.objectContaining({ emailStatus: 'hard_bounce' }),
      expect.objectContaining({ emailStatus: 'hard_bounce' }),
    ]);
  });

  it('never downgrades unsubscribe or hard-bounce status', async () => {
    const tx = {
      select: jest
        .fn()
        .mockReturnValueOnce(selectQuery([{ id: 1, emailStatus: 'unsub' }]))
        .mockReturnValueOnce(selectQuery([{ authorId: 'author-1', emailStatus: 'hard_bounce' }])),
      update: jest.fn(),
    };
    mockGetMythoriaDb.mockReturnValue({
      transaction: jest.fn((callback: (transaction: typeof tx) => unknown) => callback(tx)),
    } as never);

    await expect(markEmailBounced('person@example.com', 'soft')).resolves.toEqual(
      expect.objectContaining({ updated: 0, unchanged: 2 }),
    );
    expect(tx.update).not.toHaveBeenCalled();
  });

  it('reports when no matching lead or user exists', async () => {
    const tx = {
      select: jest.fn().mockReturnValueOnce(selectQuery([])).mockReturnValueOnce(selectQuery([])),
      update: jest.fn(),
    };
    mockGetMythoriaDb.mockReturnValue({
      transaction: jest.fn((callback: (transaction: typeof tx) => unknown) => callback(tx)),
    } as never);

    await expect(markEmailBounced('missing@example.com', 'hard')).resolves.toEqual(
      expect.objectContaining({ found: false, updated: 0, unchanged: 0 }),
    );
  });
});
