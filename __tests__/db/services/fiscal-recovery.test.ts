import { createHash } from 'node:crypto';
import { reserveRecovery, transitionRecovery } from '@/db/services/fiscal-recovery';
import { getMythoriaDb } from '@/db';

jest.mock('@/db', () => ({ getMythoriaDb: jest.fn() }));
const digest = (s: string) => createHash('sha256').update(s).digest('hex');

function dbWithDocument(
  doc: Record<string, unknown> | null,
  history: Record<string, unknown> | null = null,
) {
  const updateReturning = jest.fn().mockResolvedValue([{ id: 'doc', orderId: 'order' }]);
  const values = jest.fn().mockResolvedValue(undefined);
  const tx = {
    select: () => ({
      from: () => ({
        where: () =>
          Object.assign(Promise.resolve(history ? [history] : []), {
            for: async () => (doc ? [doc] : []),
          }),
      }),
    }),
    update: () => ({ set: () => ({ where: () => ({ returning: updateReturning }) }) }),
    insert: () => ({ values }),
  };
  jest
    .mocked(getMythoriaDb)
    .mockReturnValue({ transaction: (fn: (t: typeof tx) => unknown) => fn(tx) } as never);
  return { updateReturning, values };
}

const valid = {
  id: 'doc',
  status: 'failed',
  orderId: 'order',
  recoveryTokenHash: digest('abcdefghijklmnopqrstuvwxyzABCDEF'),
  recoveryOwner: 'admin@example.com',
  recoveryPayloadHash: digest('"payload"'),
  recoveryState: 'reserved',
  recoveryExpiresAt: new Date(Date.now() + 60_000),
};
const request = {
  id: 'doc',
  orderId: 'order',
  actor: 'admin@example.com',
  token: 'abcdefghijklmnopqrstuvwxyzABCDEF',
  payload: '"payload"',
};

describe('fiscal recovery transactions', () => {
  beforeEach(() => jest.clearAllMocks());
  it('stores hashes and audit rather than the raw generated token', async () => {
    const { values } = dbWithDocument(null);
    const result = await reserveRecovery({ ...request, expectedUpdatedAt: '2026-01-01T00:00:00Z' });
    expect(result).not.toHaveProperty('token');
    expect(values.mock.calls[0][0]).toMatchObject({
      tokenHash: digest(request.token),
      payloadHash: digest('"payload"'),
      state: 'reserved',
    });
    expect(JSON.stringify(values.mock.calls)).not.toContain(request.token);
  });
  it('rejects issuing workers, expired submissions, and changed payloads', async () => {
    dbWithDocument({ ...valid, status: 'issuing' });
    await expect(transitionRecovery({ ...request, state: 'submitted' })).rejects.toThrow();
    dbWithDocument({ ...valid, recoveryExpiresAt: new Date(0) });
    await expect(transitionRecovery({ ...request, state: 'submitted' })).rejects.toThrow('expired');
    dbWithDocument(valid);
    await expect(
      transitionRecovery({ ...request, payload: '"different"', state: 'submitted' }),
    ).rejects.toThrow();
  });
  it('rejects mismatched actors and tokens and a failed compare-and-swap', async () => {
    dbWithDocument(valid);
    await expect(
      transitionRecovery({ ...request, actor: 'other', state: 'submitted' }),
    ).rejects.toThrow('credentials');
    await expect(
      transitionRecovery({ ...request, token: 'z'.repeat(32), state: 'submitted' }),
    ).rejects.toThrow('credentials');
    const { updateReturning } = dbWithDocument(valid);
    updateReturning.mockResolvedValueOnce([]);
    await expect(transitionRecovery({ ...request, state: 'submitted' })).rejects.toThrow(
      'state changed',
    );
  });

  it('allows cancellation after expiration and never permits submitted replay', async () => {
    dbWithDocument({ ...valid, recoveryExpiresAt: new Date(0) });
    await expect(transitionRecovery({ ...request, state: 'cancelled' })).resolves.toEqual({
      id: 'doc',
      state: 'cancelled',
    });
    dbWithDocument({ ...valid, recoveryState: 'submitted' });
    await expect(transitionRecovery({ ...request, state: 'submitted' })).rejects.toThrow(
      'Invalid recovery transition',
    );
  });

  it('rejects a reused token when the permanent ledger reports a duplicate', async () => {
    const { values } = dbWithDocument(null);
    values.mockRejectedValueOnce(new Error('duplicate token hash'));
    await expect(
      reserveRecovery({ ...request, expectedUpdatedAt: '2026-01-01T00:00:00Z' }),
    ).rejects.toThrow('duplicate');
    expect(values).toHaveBeenCalledTimes(1);
  });

  it('treats identical reconciliations as idempotent only with matching ledger history', async () => {
    const identity = {
      docType: 'FT',
      docSeries: 'A',
      docNum: '1',
      issuedAt: '2026-01-01T00:00:00Z',
      reason: 'Verified',
    };
    const issued = {
      ...valid,
      status: 'issued',
      recoveryState: 'reconciled',
      ...identity,
      issuedAt: new Date(identity.issuedAt),
    };
    const { values } = dbWithDocument(issued, { state: 'reconciled' });
    await expect(
      transitionRecovery({ ...request, state: 'reconciled', confirm: true, identity }),
    ).resolves.toEqual({ id: 'doc', state: 'reconciled' });
    expect(values).not.toHaveBeenCalled();
    dbWithDocument(issued);
    await expect(
      transitionRecovery({ ...request, state: 'reconciled', confirm: true, identity }),
    ).rejects.toThrow('history mismatch');
    dbWithDocument(issued, { state: 'reconciled' });
    await expect(
      transitionRecovery({
        ...request,
        state: 'reconciled',
        confirm: true,
        identity: { ...identity, docNum: '2' },
      }),
    ).rejects.toThrow('identity conflicts');
  });

  it('rejects reservation when the version compare-and-swap fails', async () => {
    const { updateReturning } = dbWithDocument(null);
    updateReturning.mockResolvedValueOnce([]);
    await expect(
      reserveRecovery({ ...request, expectedUpdatedAt: '2026-01-01T00:00:00Z' }),
    ).rejects.toThrow('not eligible');
  });

  it('prevents cancellation after submission and permits audited reconciliation', async () => {
    const { values } = dbWithDocument({ ...valid, recoveryState: 'submitted' });
    await expect(transitionRecovery({ ...request, state: 'cancelled' })).rejects.toThrow(
      'Invalid recovery transition',
    );
    await expect(
      transitionRecovery({
        ...request,
        state: 'reconciled',
        confirm: true,
        identity: {
          docType: 'FT',
          docSeries: 'A',
          docNum: '1',
          issuedAt: '2026-01-01T00:00:00Z',
          reason: 'Verified',
        },
      }),
    ).resolves.toEqual({ id: 'doc', state: 'reconciled' });
    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'recovery_reconciled' }),
    );
  });
});
