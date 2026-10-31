/** @jest-environment node */
import { getBackofficeDb } from '@/db';
import { campaignService } from '@/db/services/campaigns';
import { SurveyAssetValidationError } from '@/lib/surveys/asset-requirements';

jest.mock('@/db', () => ({
  getBackofficeDb: jest.fn(),
  getMythoriaDb: jest.fn(),
}));

const validAsset = {
  language: 'en-US',
  subject: 'Hello',
  htmlBody: '<a href="{{surveyLink}}">Go</a> {{unsubscribeLink}} {{physicalAddress}}',
  textBody: 'Go {{{surveyLink}}} Stop {{{unsubscribeLink}}}',
};

/** Minimal drizzle stub: each select() consumes the next queued result set. */
function mockDb(selectResults: unknown[][]) {
  const queue = [...selectResults];
  const inserted: unknown[] = [];
  const db = {
    select: () => ({
      from: () => ({
        where: () => ({ limit: () => Promise.resolve(queue.shift() ?? []) }),
      }),
    }),
    insert: () => ({
      values: (values: unknown) => {
        inserted.push(values);
        return { returning: () => Promise.resolve([{ id: 'asset-1', ...(values as object) }]) };
      },
    }),
  };
  jest.mocked(getBackofficeDb).mockReturnValue(db as never);
  return { inserted };
}

describe('campaignService.upsertCampaignAsset', () => {
  beforeEach(() => jest.clearAllMocks());

  it('rejects survey campaign assets missing required variables', async () => {
    const { inserted } = mockDb([[{ status: 'draft', audienceSource: 'survey_invitations' }]]);

    const attempt = campaignService.upsertCampaignAsset('c1', {
      ...validAsset,
      htmlBody: '<p>No link here</p> {{unsubscribeLink}}',
      textBody: 'No link',
    });

    await expect(attempt).rejects.toBeInstanceOf(SurveyAssetValidationError);
    await expect(attempt).rejects.toMatchObject({
      missing: [
        'htmlBody: {{surveyLink}}',
        'htmlBody: {{physicalAddress}}',
        'textBody: {{surveyLink}}',
        'textBody: {{unsubscribeLink}}',
      ],
    });
    expect(inserted).toHaveLength(0);
  });

  it('saves a compliant survey campaign asset', async () => {
    const { inserted } = mockDb([[{ status: 'draft', audienceSource: 'survey_invitations' }], []]);

    await expect(campaignService.upsertCampaignAsset('c1', validAsset)).resolves.toMatchObject({
      id: 'asset-1',
    });
    expect(inserted).toHaveLength(1);
  });

  it('does not enforce survey variables on regular campaigns', async () => {
    const { inserted } = mockDb([[{ status: 'draft', audienceSource: 'leads' }], []]);

    await campaignService.upsertCampaignAsset('c1', {
      ...validAsset,
      htmlBody: '<p>Plain</p>',
      textBody: 'Plain',
    });
    expect(inserted).toHaveLength(1);
  });

  it('keeps the status guard ahead of survey validation', async () => {
    mockDb([[{ status: 'completed', audienceSource: 'survey_invitations' }]]);

    await expect(
      campaignService.upsertCampaignAsset('c1', { ...validAsset, htmlBody: 'x', textBody: 'y' }),
    ).rejects.toThrow(/Cannot modify assets/);
  });
});
