/**
 * @jest-environment node
 */

import { beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { NextResponse } from 'next/server';

jest.mock('@/lib/api-helpers', () => ({
  authenticateAdmin: jest.fn(),
  proxyToNotificationEngine: jest.fn(),
}));

jest.mock('@/db/services/campaigns', () => ({
  campaignService: {
    listCampaigns: jest.fn(),
    createCampaign: jest.fn(),
    getCampaign: jest.fn(),
    updateCampaign: jest.fn(),
    deleteCampaign: jest.fn(),
    transitionCampaignStatus: jest.fn(),
    getEstimatedAudienceCount: jest.fn(),
    getCampaignProgress: jest.fn(),
    getBatchHistory: jest.fn(),
    upsertCampaignAsset: jest.fn(),
  },
}));

const { authenticateAdmin, proxyToNotificationEngine } = jest.requireMock('@/lib/api-helpers') as {
  authenticateAdmin: jest.Mock;
  proxyToNotificationEngine: jest.Mock;
};

const { campaignService } = jest.requireMock('@/db/services/campaigns') as {
  campaignService: Record<string, jest.Mock>;
};

let listCampaignsGet: typeof import('@/app/api/email-campaigns/route').GET;
let listCampaignsPost: typeof import('@/app/api/email-campaigns/route').POST;
let campaignDelete: typeof import('@/app/api/email-campaigns/[id]/route').DELETE;
let campaignPatch: typeof import('@/app/api/email-campaigns/[id]/route').PATCH;
let campaignActivate: typeof import('@/app/api/email-campaigns/[id]/activate/route').POST;
let campaignPause: typeof import('@/app/api/email-campaigns/[id]/pause/route').POST;
let campaignCancel: typeof import('@/app/api/email-campaigns/[id]/cancel/route').POST;
let audienceCountGet: typeof import('@/app/api/email-campaigns/[id]/audience-count/route').GET;
let sendSamplePost: typeof import('@/app/api/email-campaigns/[id]/send-sample/route').POST;

beforeAll(async () => {
  ({ GET: listCampaignsGet, POST: listCampaignsPost } =
    await import('@/app/api/email-campaigns/route'));
  ({ DELETE: campaignDelete, PATCH: campaignPatch } =
    await import('@/app/api/email-campaigns/[id]/route'));
  ({ POST: campaignActivate } = await import('@/app/api/email-campaigns/[id]/activate/route'));
  ({ POST: campaignPause } = await import('@/app/api/email-campaigns/[id]/pause/route'));
  ({ POST: campaignCancel } = await import('@/app/api/email-campaigns/[id]/cancel/route'));
  ({ GET: audienceCountGet } = await import('@/app/api/email-campaigns/[id]/audience-count/route'));
  ({ POST: sendSamplePost } = await import('@/app/api/email-campaigns/[id]/send-sample/route'));
});

describe('email campaigns API routes', () => {
  const authenticateAdminMock = authenticateAdmin as jest.MockedFunction<
    (...args: never[]) => Promise<unknown>
  >;
  const proxyToNotificationEngineMock = proxyToNotificationEngine as jest.MockedFunction<
    (...args: never[]) => Promise<unknown>
  >;
  const campaignServiceMock = campaignService as Record<string, jest.Mock>;

  beforeEach(() => {
    jest.clearAllMocks();
    authenticateAdminMock.mockResolvedValue({
      email: 'admin@mythoria.pt',
    });
  });

  it('supports full lifecycle transitions: create -> edit -> activate -> pause -> cancel', async () => {
    campaignServiceMock.createCampaign.mockResolvedValue({
      id: 'campaign-1',
      title: 'Spring Blast',
      status: 'draft',
      audienceSource: 'users',
    } as never);

    const createResponse = await listCampaignsPost(
      new Request('http://localhost/api/email-campaigns', {
        method: 'POST',
        body: JSON.stringify({
          title: 'Spring Blast',
          audienceSource: 'users',
        }),
        headers: { 'content-type': 'application/json' },
      }) as never,
    );
    expect(createResponse.status).toBe(201);

    campaignServiceMock.updateCampaign.mockResolvedValue({
      id: 'campaign-1',
      title: 'Spring Blast Updated',
      status: 'draft',
      audienceSource: 'users',
    } as never);
    campaignServiceMock.getCampaign.mockResolvedValue({
      id: 'campaign-1',
      title: 'Spring Blast Updated',
      status: 'draft',
      audienceSource: 'users',
      assets: [],
    } as never);

    const patchResponse = await campaignPatch(
      new Request('http://localhost/api/email-campaigns/campaign-1', {
        method: 'PATCH',
        body: JSON.stringify({ title: 'Spring Blast Updated' }),
        headers: { 'content-type': 'application/json' },
      }) as never,
      { params: Promise.resolve({ id: 'campaign-1' }) },
    );
    expect(patchResponse.status).toBe(200);

    campaignServiceMock.transitionCampaignStatus
      .mockResolvedValueOnce({
        id: 'campaign-1',
        status: 'active',
      } as never)
      .mockResolvedValueOnce({
        id: 'campaign-1',
        status: 'paused',
      } as never)
      .mockResolvedValueOnce({
        id: 'campaign-1',
        status: 'cancelled',
      } as never);

    const activateResponse = await campaignActivate(
      new Request('http://localhost/api/email-campaigns/campaign-1/activate', {
        method: 'POST',
      }),
      { params: Promise.resolve({ id: 'campaign-1' }) },
    );
    expect(activateResponse.status).toBe(200);

    const pauseResponse = await campaignPause(
      new Request('http://localhost/api/email-campaigns/campaign-1/pause', { method: 'POST' }),
      { params: Promise.resolve({ id: 'campaign-1' }) },
    );
    expect(pauseResponse.status).toBe(200);

    const cancelResponse = await campaignCancel(
      new Request('http://localhost/api/email-campaigns/campaign-1/cancel', { method: 'POST' }),
      { params: Promise.resolve({ id: 'campaign-1' }) },
    );
    expect(cancelResponse.status).toBe(200);

    expect(campaignServiceMock.transitionCampaignStatus).toHaveBeenNthCalledWith(
      1,
      'campaign-1',
      'active',
      'admin@mythoria.pt',
    );
    expect(campaignServiceMock.transitionCampaignStatus).toHaveBeenNthCalledWith(
      2,
      'campaign-1',
      'paused',
      'admin@mythoria.pt',
    );
    expect(campaignServiceMock.transitionCampaignStatus).toHaveBeenNthCalledWith(
      3,
      'campaign-1',
      'cancelled',
      'admin@mythoria.pt',
    );
  });

  it('returns audience counts for a campaign filter', async () => {
    campaignServiceMock.getCampaign.mockResolvedValue({
      id: 'campaign-2',
      title: 'Audience Test',
      status: 'draft',
      audienceSource: 'both',
      filterTree: {
        logic: 'and',
        conditions: [{ field: 'preferredLocale', operator: 'eq', value: 'en-US' }],
      },
      assets: [],
    } as never);

    (
      campaignServiceMock.getEstimatedAudienceCount as unknown as {
        mockResolvedValue: (value: unknown) => unknown;
      }
    ).mockResolvedValue({
      users: 12,
      leads: 8,
      total: 20,
    });

    const response = await audienceCountGet(
      new Request('http://localhost/api/email-campaigns/campaign-2/audience-count') as never,
      { params: Promise.resolve({ id: 'campaign-2' }) },
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ users: 12, leads: 8, total: 20 });
  });

  it('proxies sample sends to notification-engine', async () => {
    (
      proxyToNotificationEngineMock as { mockResolvedValue: (value: unknown) => unknown }
    ).mockResolvedValue(NextResponse.json({ success: true, data: { ok: true } }));

    const response = await sendSamplePost(
      new Request('http://localhost/api/email-campaigns/campaign-3/send-sample', {
        method: 'POST',
        body: JSON.stringify({
          locale: 'en-US',
          email: 'qa@example.com',
          variables: { name: 'QA' },
        }),
        headers: { 'content-type': 'application/json' },
      }),
      { params: Promise.resolve({ id: 'campaign-3' }) },
    );

    expect(response.status).toBe(200);
    const firstCall = (proxyToNotificationEngineMock as unknown as { mock: { calls: unknown[][] } })
      .mock.calls[0];
    expect(firstCall?.[0]).toBe('/internal/campaigns/campaign-3/send-sample');
    expect(firstCall?.[1]).toEqual({
      method: 'POST',
      body: {
        locale: 'en-US',
        email: 'qa@example.com',
        variables: { name: 'QA' },
        requestedBy: 'admin@mythoria.pt',
      },
    });
  });

  it('enforces delete restrictions to draft/cancelled campaigns only', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    (
      campaignServiceMock.deleteCampaign as unknown as {
        mockRejectedValue: (value: unknown) => unknown;
      }
    ).mockRejectedValue(
      new Error(
        `Cannot delete campaign in 'active' status. Only draft or cancelled campaigns can be deleted.`,
      ),
    );

    try {
      const response = await campaignDelete(
        new Request('http://localhost/api/email-campaigns/campaign-4', {
          method: 'DELETE',
        }) as never,
        { params: Promise.resolve({ id: 'campaign-4' }) },
      );

      expect(response.status).toBe(409);
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });

  it('requires admin authentication', async () => {
    authenticateAdminMock.mockResolvedValue({
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    } as never);

    const response = await listCampaignsGet({
      url: 'http://localhost/api/email-campaigns?page=1&limit=20',
    } as never);

    expect(response.status).toBe(401);
  });
});
