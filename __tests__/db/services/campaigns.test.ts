/**
 * @jest-environment node
 */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('@/db/index', () => ({
  getBackofficeDb: jest.fn(),
  getMythoriaDb: jest.fn(),
}));

let campaignService: typeof import('@/db/services/campaigns').campaignService;
const { getBackofficeDb, getMythoriaDb } = jest.requireMock('@/db/index') as {
  getBackofficeDb: jest.Mock;
  getMythoriaDb: jest.Mock;
};

beforeAll(async () => {
  ({ campaignService } = await import('@/db/services/campaigns'));
});

type MockDb = {
  select?: jest.Mock;
  insert?: jest.Mock;
  update?: jest.Mock;
  delete?: jest.Mock;
};

function createSelectChain<T>(rows: T[]) {
  const chain: any = {
    from: jest.fn(),
    where: jest.fn(),
    orderBy: jest.fn(),
    limit: jest.fn(),
    offset: jest.fn(),
    groupBy: jest.fn(),
    then: (resolve: any, reject?: any) => Promise.resolve(rows).then(resolve, reject),
  };

  chain.from.mockReturnValue(chain);
  chain.where.mockReturnValue(chain);
  chain.orderBy.mockResolvedValue(rows);
  chain.limit.mockResolvedValue(rows);
  chain.offset.mockResolvedValue(rows);
  chain.groupBy.mockResolvedValue(rows);

  return chain;
}

function createInsertChain<T>(rows: T[]) {
  const chain: any = {
    values: jest.fn(),
    returning: jest.fn(),
    then: (resolve: any, reject?: any) => Promise.resolve(rows).then(resolve, reject),
  };

  chain.values.mockReturnValue(chain);
  chain.returning.mockResolvedValue(rows);

  return chain;
}

function createUpdateChain<T>(rows: T[]) {
  const whereChain: any = {
    returning: jest.fn(),
    then: (resolve: any, reject?: any) => Promise.resolve(rows).then(resolve, reject),
  };

  whereChain.returning.mockResolvedValue(rows);

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
    then: (resolve: any, reject?: any) => Promise.resolve(rows).then(resolve, reject),
  };

  whereChain.returning.mockResolvedValue(rows);

  const chain: any = {
    where: jest.fn(),
  };

  chain.where.mockReturnValue(whereChain);

  return chain;
}

describe('campaignService', () => {
  const getBackofficeDbMock = getBackofficeDb as jest.Mock;
  const getMythoriaDbMock = getMythoriaDb as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    getMythoriaDbMock.mockReturnValue({} as never);
  });

  it('creates draft campaigns', async () => {
    const created = {
      id: 'campaign-1',
      title: 'Welcome Campaign',
      status: 'draft',
      audienceSource: 'users',
    };

    const db: MockDb = {
      insert: jest.fn().mockReturnValue(createInsertChain([created])),
    };
    getBackofficeDbMock.mockReturnValue(db as never);

    const result = await campaignService.createCampaign(
      {
        title: 'Welcome Campaign',
        audienceSource: 'users',
      },
      'admin@mythoria.pt',
    );

    expect(result).toEqual(created);
    expect(db.insert).toHaveBeenCalled();
  });

  it('returns campaign details with assets', async () => {
    const campaign = {
      id: 'campaign-1',
      title: 'Detail Campaign',
      status: 'draft',
      audienceSource: 'users',
    };
    const assets = [
      {
        id: 'asset-1',
        campaignId: 'campaign-1',
        language: 'en-US',
        subject: 'Hi',
        htmlBody: '<p>Hi</p>',
        textBody: 'Hi',
      },
    ];

    const db: MockDb = {
      select: jest
        .fn()
        .mockReturnValueOnce(createSelectChain([campaign]))
        .mockReturnValueOnce(createSelectChain(assets)),
    };
    getBackofficeDbMock.mockReturnValue(db as never);

    const result = await campaignService.getCampaign('campaign-1');

    expect(result).toEqual({
      ...campaign,
      assets,
    });
  });

  it('validates allowed and rejected state transitions', async () => {
    const dbAllowed: MockDb = {
      select: jest.fn().mockReturnValue(createSelectChain([{ id: 'campaign-1', status: 'draft' }])),
      update: jest
        .fn()
        .mockReturnValue(createUpdateChain([{ id: 'campaign-1', status: 'active' }])),
    };
    getBackofficeDbMock.mockReturnValue(dbAllowed as never);

    const allowed = await campaignService.transitionCampaignStatus(
      'campaign-1',
      'active',
      'admin@mythoria.pt',
    );
    expect(allowed?.status).toBe('active');

    const dbRejected: MockDb = {
      select: jest
        .fn()
        .mockReturnValue(createSelectChain([{ id: 'campaign-2', status: 'completed' }])),
      update: jest
        .fn()
        .mockReturnValue(createUpdateChain([{ id: 'campaign-2', status: 'active' }])),
    };
    getBackofficeDbMock.mockReturnValue(dbRejected as never);

    await expect(
      campaignService.transitionCampaignStatus('campaign-2', 'active', 'admin@mythoria.pt'),
    ).rejects.toThrow(`Invalid transition: 'completed' -> 'active'`);
  });

  it('upserts campaign assets by creating and updating locale rows', async () => {
    const createDb: MockDb = {
      select: jest
        .fn()
        .mockReturnValueOnce(createSelectChain([{ status: 'draft' }]))
        .mockReturnValueOnce(createSelectChain([])),
      insert: jest.fn().mockReturnValue(
        createInsertChain([
          {
            id: 'asset-new',
            campaignId: 'campaign-1',
            language: 'en-US',
            subject: 'Subject',
            htmlBody: '<p>Hello</p>',
            textBody: 'Hello',
          },
        ]),
      ),
    };
    getBackofficeDbMock.mockReturnValue(createDb as never);

    const inserted = await campaignService.upsertCampaignAsset('campaign-1', {
      language: 'en-US',
      subject: 'Subject',
      htmlBody: '<p>Hello</p>',
      textBody: 'Hello',
    });
    expect(inserted.id).toBe('asset-new');

    const updateDb: MockDb = {
      select: jest
        .fn()
        .mockReturnValueOnce(createSelectChain([{ status: 'draft' }]))
        .mockReturnValueOnce(
          createSelectChain([
            {
              id: 'asset-existing',
              campaignId: 'campaign-1',
              language: 'en-US',
            },
          ]),
        ),
      update: jest.fn().mockReturnValue(
        createUpdateChain([
          {
            id: 'asset-existing',
            campaignId: 'campaign-1',
            language: 'en-US',
            subject: 'Updated',
            htmlBody: '<p>Updated</p>',
            textBody: 'Updated',
          },
        ]),
      ),
    };
    getBackofficeDbMock.mockReturnValue(updateDb as never);

    const updated = await campaignService.upsertCampaignAsset('campaign-1', {
      language: 'en-US',
      subject: 'Updated',
      htmlBody: '<p>Updated</p>',
      textBody: 'Updated',
    });
    expect(updated.subject).toBe('Updated');
  });

  it('enforces delete restrictions and deletes eligible campaigns', async () => {
    const restrictedDb: MockDb = {
      select: jest.fn().mockReturnValue(createSelectChain([{ status: 'active' }])),
      delete: jest.fn(),
    };
    getBackofficeDbMock.mockReturnValue(restrictedDb as never);

    await expect(campaignService.deleteCampaign('campaign-active')).rejects.toThrow(
      `Cannot delete campaign in 'active' status.`,
    );

    const deletableDb: MockDb = {
      select: jest.fn().mockReturnValue(createSelectChain([{ status: 'draft' }])),
      delete: jest.fn().mockReturnValue(createDeleteChain([{ id: 'campaign-draft' }])),
    };
    getBackofficeDbMock.mockReturnValue(deletableDb as never);

    const deleted = await campaignService.deleteCampaign('campaign-draft');
    expect(deleted).toBe(true);
  });

  it('aggregates progress counters by status', async () => {
    const db: MockDb = {
      select: jest.fn().mockReturnValue(
        createSelectChain([
          { status: 'sent', count: 5 },
          { status: 'failed', count: 2 },
          { status: 'skipped', count: 1 },
          { status: 'queued', count: 3 },
        ]),
      ),
    };
    getBackofficeDbMock.mockReturnValue(db as never);

    const progress = await campaignService.getCampaignProgress('campaign-1');

    expect(progress).toEqual({
      sent: 5,
      failed: 2,
      skipped: 1,
      queued: 3,
      total: 11,
    });
  });
});
