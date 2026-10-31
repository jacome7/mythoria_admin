/** @jest-environment node */
import type { NextRequest } from 'next/server';
import { GET, PATCH } from '@/app/api/email-campaigns/[id]/route';
import { authenticateAdmin } from '@/lib/api-helpers';
import { campaignService } from '@/db/services/campaigns';
import { SurveyAssetValidationError } from '@/lib/surveys/asset-requirements';

jest.mock('@/lib/api-helpers', () => ({ authenticateAdmin: jest.fn() }));
jest.mock('@/db/services/campaigns', () => ({
  campaignService: {
    getCampaign: jest.fn(),
    getCampaignProgress: jest.fn(),
    getBatchHistory: jest.fn(),
    getCampaignSuccessMetrics: jest.fn(),
    listSurveyCampaigns: jest.fn(),
    upsertCampaignAsset: jest.fn(),
    updateCampaign: jest.fn(),
    deleteCampaignAsset: jest.fn(),
  },
}));

const service = jest.mocked(campaignService);
const params = { params: Promise.resolve({ id: 'c1' }) };

function patchRequest(body: unknown) {
  return new Request('http://localhost/api/email-campaigns/c1', {
    method: 'PATCH',
    body: JSON.stringify(body),
  }) as unknown as NextRequest;
}

const asset = { language: 'en-US', subject: 'Hi', htmlBody: '<p>x</p>', textBody: 'x' };

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
  jest.mocked(authenticateAdmin).mockResolvedValue({ email: 'admin@mythoria.pt' });
  service.getCampaign.mockResolvedValue({ id: 'c1', assets: [] } as never);
});

describe('PATCH /api/email-campaigns/[id] asset validation', () => {
  it('maps survey asset validation errors to HTTP 400 with a clear message', async () => {
    service.upsertCampaignAsset.mockRejectedValue(
      new SurveyAssetValidationError(['htmlBody: {{surveyLink}}'], 'en-US'),
    );

    const response = await PATCH(patchRequest({ assets: [asset] }), params);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain('htmlBody: {{surveyLink}}');
    expect(body.missing).toEqual(['htmlBody: {{surveyLink}}']);
    expect(body.language).toBe('en-US');
  });

  it('still maps other "Cannot" errors to 409', async () => {
    service.upsertCampaignAsset.mockRejectedValue(new Error('Cannot modify assets for paused'));

    const response = await PATCH(patchRequest({ assets: [asset] }), params);
    expect(response.status).toBe(409);
  });
});

describe('PATCH /api/email-campaigns/[id] schedule validation', () => {
  it('rejects an end date that is not after the start date', async () => {
    const response = await PATCH(
      patchRequest({ startAt: '2026-11-10T10:00:00.000Z', endAt: '2026-11-09T10:00:00.000Z' }),
      params,
    );
    expect(response.status).toBe(400);
    expect(service.updateCampaign).not.toHaveBeenCalled();
  });

  it('accepts a valid window and null (cleared) dates', async () => {
    service.updateCampaign.mockResolvedValue({ id: 'c1' } as never);
    const ok = await PATCH(
      patchRequest({ startAt: '2026-11-10T10:00:00.000Z', endAt: '2026-11-12T10:00:00.000Z' }),
      params,
    );
    expect(ok.status).toBe(200);
    const cleared = await PATCH(patchRequest({ startAt: null, endAt: null }), params);
    expect(cleared.status).toBe(200);
    expect(service.updateCampaign).toHaveBeenLastCalledWith(
      'c1',
      { startAt: null, endAt: null },
      'admin@mythoria.pt',
    );
  });
});

describe('GET /api/email-campaigns/[id] survey context', () => {
  beforeEach(() => {
    service.getCampaignProgress.mockResolvedValue({} as never);
    service.getBatchHistory.mockResolvedValue({ batches: [], total: 0 } as never);
    service.getCampaignSuccessMetrics.mockResolvedValue({} as never);
  });

  it('adds the sibling invite start for survey reminders', async () => {
    service.getCampaign.mockResolvedValue({
      id: 'c1',
      audienceSource: 'survey_invitations',
      surveyStudyId: 's1',
      surveyCohortKey: 'C1',
      surveyAudienceMode: 'reminder',
    } as never);
    service.listSurveyCampaigns.mockResolvedValue([
      {
        id: 'other',
        surveyCohortKey: 'C2',
        surveyAudienceMode: 'invite',
        status: 'draft',
        startAt: new Date('2026-01-01T00:00:00Z'),
      },
      {
        id: 'inv',
        surveyCohortKey: 'C1',
        surveyAudienceMode: 'invite',
        status: 'draft',
        startAt: new Date('2026-11-01T09:00:00Z'),
      },
    ] as never);

    const body = await (await GET({} as NextRequest, params)).json();
    expect(body.surveyContext).toEqual({ siblingInviteStartAt: '2026-11-01T09:00:00.000Z' });
  });

  it('omits the survey context for regular campaigns', async () => {
    service.getCampaign.mockResolvedValue({ id: 'c1', audienceSource: 'leads' } as never);
    const body = await (await GET({} as NextRequest, params)).json();
    expect(body.surveyContext).toBeUndefined();
    expect(service.listSurveyCampaigns).not.toHaveBeenCalled();
  });
});
