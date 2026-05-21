/**
 * @jest-environment node
 */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('@/db/index', () => ({
  getMythoriaDb: jest.fn(),
  getWorkflowsDb: jest.fn(),
}));

let adminService: typeof import('@/db/services').adminService;
const { getMythoriaDb } = jest.requireMock('@/db/index') as {
  getMythoriaDb: jest.Mock;
};

beforeAll(async () => {
  ({ adminService } = await import('@/db/services'));
});

type MockDb = {
  select?: jest.Mock;
  update?: jest.Mock;
  delete?: jest.Mock;
};

function createSelectChain<T>(rows: T[]) {
  const chain: any = {
    from: jest.fn(),
    where: jest.fn(),
    then: (resolve: any, reject?: any) => Promise.resolve(rows).then(resolve, reject),
  };

  chain.from.mockReturnValue(chain);
  chain.where.mockReturnValue(chain);

  return chain;
}

function createUpdateChain<T>(rows: T[], returningError?: unknown) {
  const whereChain: any = {
    returning: jest.fn(),
  };

  if (returningError) {
    whereChain.returning.mockRejectedValue(returningError);
  } else {
    whereChain.returning.mockResolvedValue(rows);
  }

  const chain: any = {
    set: jest.fn(),
    where: jest.fn(),
  };

  chain.set.mockReturnValue(chain);
  chain.where.mockReturnValue(whereChain);

  return chain;
}

function createDeleteChain<T>(rows: T[]) {
  const whereChain: any = {
    returning: jest.fn(),
  };
  whereChain.returning.mockResolvedValue(rows);

  const chain: any = {
    where: jest.fn().mockReturnValue(whereChain),
  };

  return chain;
}

describe('adminService promotion code mutations', () => {
  const getMythoriaDbMock = getMythoriaDb as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('updates an unused promotion code', async () => {
    const updated = {
      promotionCodeId: 'promo-1',
      code: 'SPRING25',
      creditAmount: 25,
      active: true,
    };
    const db: MockDb = {
      select: jest
        .fn()
        .mockReturnValueOnce(createSelectChain([{ promotionCodeId: 'promo-1' }]))
        .mockReturnValueOnce(createSelectChain([{ totalRedemptions: 0 }])),
      update: jest.fn().mockReturnValue(createUpdateChain([updated])),
    };
    getMythoriaDbMock.mockReturnValue(db as never);

    const result = await adminService.updatePromotionCode('promo-1', {
      code: 'spring25',
      type: 'partner',
      creditAmount: 25,
      maxGlobalRedemptions: null,
      maxRedemptionsPerUser: 1,
      validFrom: null,
      validUntil: null,
      active: true,
    });

    expect(result).toEqual(updated);
    expect(db.update).toHaveBeenCalled();
  });

  it('rejects updates for used promotion codes', async () => {
    const db: MockDb = {
      select: jest
        .fn()
        .mockReturnValueOnce(createSelectChain([{ promotionCodeId: 'promo-used' }]))
        .mockReturnValueOnce(createSelectChain([{ totalRedemptions: 1 }])),
      update: jest.fn(),
    };
    getMythoriaDbMock.mockReturnValue(db as never);

    await expect(
      adminService.updatePromotionCode('promo-used', {
        code: 'USED',
        type: 'partner',
        creditAmount: 10,
        maxGlobalRedemptions: null,
        maxRedemptionsPerUser: 1,
        validFrom: null,
        validUntil: null,
        active: true,
      }),
    ).rejects.toMatchObject({ code: 'promotion_code_used' });
    expect(db.update).not.toHaveBeenCalled();
  });

  it('returns duplicate conflicts when editing to an existing code', async () => {
    const db: MockDb = {
      select: jest
        .fn()
        .mockReturnValueOnce(createSelectChain([{ promotionCodeId: 'promo-1' }]))
        .mockReturnValueOnce(createSelectChain([{ totalRedemptions: 0 }])),
      update: jest
        .fn()
        .mockReturnValue(createUpdateChain([], new Error('duplicate key value violates unique'))),
    };
    getMythoriaDbMock.mockReturnValue(db as never);

    await expect(
      adminService.updatePromotionCode('promo-1', {
        code: 'DUPLICATE',
        type: 'partner',
        creditAmount: 10,
        maxGlobalRedemptions: null,
        maxRedemptionsPerUser: 1,
        validFrom: null,
        validUntil: null,
        active: true,
      }),
    ).rejects.toMatchObject({ code: 'code_exists' });
  });

  it('deletes only inactive unused promotion codes', async () => {
    const deleted = { promotionCodeId: 'promo-inactive', active: false };
    const db: MockDb = {
      select: jest
        .fn()
        .mockReturnValueOnce(
          createSelectChain([{ promotionCodeId: 'promo-inactive', active: false }]),
        )
        .mockReturnValueOnce(createSelectChain([{ totalRedemptions: 0 }])),
      delete: jest.fn().mockReturnValue(createDeleteChain([deleted])),
    };
    getMythoriaDbMock.mockReturnValue(db as never);

    const result = await adminService.deletePromotionCode('promo-inactive');

    expect(result).toEqual(deleted);
    expect(db.delete).toHaveBeenCalled();
  });

  it('rejects deletion for active or used promotion codes', async () => {
    const activeDb: MockDb = {
      select: jest
        .fn()
        .mockReturnValueOnce(
          createSelectChain([{ promotionCodeId: 'promo-active', active: true }]),
        ),
      delete: jest.fn(),
    };
    getMythoriaDbMock.mockReturnValue(activeDb as never);

    await expect(adminService.deletePromotionCode('promo-active')).rejects.toMatchObject({
      code: 'promotion_code_active',
    });
    expect(activeDb.delete).not.toHaveBeenCalled();

    const usedDb: MockDb = {
      select: jest
        .fn()
        .mockReturnValueOnce(createSelectChain([{ promotionCodeId: 'promo-used', active: false }]))
        .mockReturnValueOnce(createSelectChain([{ totalRedemptions: 1 }])),
      delete: jest.fn(),
    };
    getMythoriaDbMock.mockReturnValue(usedDb as never);

    await expect(adminService.deletePromotionCode('promo-used')).rejects.toMatchObject({
      code: 'promotion_code_used',
    });
    expect(usedDb.delete).not.toHaveBeenCalled();
  });
});
