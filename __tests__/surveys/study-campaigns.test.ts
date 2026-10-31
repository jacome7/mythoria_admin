/** @jest-environment node */
import {
  createSurveyStudyCampaigns,
  SURVEY_REMINDER_DELAY_DAYS,
} from '@/lib/surveys/study-campaigns';
import { campaignService } from '@/db/services/campaigns';
import { callSurveyDomain } from '@/services/surveys';

jest.mock('@/db/services/campaigns', () => ({
  campaignService: {
    listSurveyCampaigns: jest.fn(),
    createCampaign: jest.fn(),
    upsertCampaignAsset: jest.fn(),
  },
}));
jest.mock('@/services/surveys', () => ({ callSurveyDomain: jest.fn() }));

const studyId = '11111111-1111-4111-8111-111111111111';
const service = jest.mocked(campaignService);
const callDomain = jest.mocked(callSurveyDomain);

const study = {
  studyId,
  studyKey: 'research-q4',
  title: 'Research Q4',
  status: 'draft',
  opensAt: '2026-11-01T00:00:00.000Z',
  closesAt: '2026-12-01T00:00:00.000Z',
};

let counter = 0;
beforeEach(() => {
  jest.clearAllMocks();
  counter = 0;
  service.listSurveyCampaigns.mockResolvedValue([]);
  service.createCampaign.mockImplementation(async () => ({ id: `campaign-${++counter}` }) as never);
  service.upsertCampaignAsset.mockResolvedValue({} as never);
});

function mockStudy(cohorts: Array<Record<string, unknown>>) {
  callDomain.mockImplementation((async (operation: string) =>
    operation === 'getStudy' ? { study, cohorts } : {}) as never);
}

describe('createSurveyStudyCampaigns', () => {
  it('creates invite + reminder drafts per cohort with 5 locale assets and links them', async () => {
    mockStudy([{ cohortKey: 'C1' }, { cohortKey: 'C2' }, { cohortKey: 'C3' }]);

    const result = await createSurveyStudyCampaigns({ studyId, actorEmail: 'a@mythoria.pt' });

    expect(service.createCampaign).toHaveBeenCalledTimes(6);
    expect(service.upsertCampaignAsset).toHaveBeenCalledTimes(6 * 5);
    const firstCall = service.createCampaign.mock.calls[0];
    expect(firstCall[0]).toMatchObject({
      audienceSource: 'survey_invitations',
      userNotificationPreferences: ['news', 'inspiration'],
      startAt: '2026-11-01T00:00:00.000Z',
      endAt: '2026-12-01T00:00:00.000Z',
      surveyStudyId: studyId,
      surveyCohortKey: 'C1',
      surveyAudienceMode: 'invite',
    });
    expect(firstCall[1]).toBe('a@mythoria.pt');
    const languages = service.upsertCampaignAsset.mock.calls
      .filter(([id]) => id === 'campaign-1')
      .map(([, asset]) => asset.language);
    expect(languages).toEqual(['en-US', 'pt-PT', 'es-ES', 'fr-FR', 'de-DE']);

    const links = callDomain.mock.calls.filter(([op]) => op === 'linkCampaigns');
    expect(links).toHaveLength(3);
    expect(links[0][1]).toEqual({
      studyId,
      cohortKey: 'C1',
      inviteCampaignId: 'campaign-1',
      reminderCampaignId: 'campaign-2',
    });
    expect(result.map((cohort) => cohort.cohortKey)).toEqual(['C1', 'C2', 'C3']);
  });

  it('starts reminder campaigns 7 days after the study opens and keeps the same end date', async () => {
    mockStudy([{ cohortKey: 'C1' }]);

    await createSurveyStudyCampaigns({ studyId, actorEmail: 'a@mythoria.pt' });

    expect(SURVEY_REMINDER_DELAY_DAYS).toBe(7);
    const [invite, reminder] = service.createCampaign.mock.calls.map(([input]) => input);
    expect(invite).toMatchObject({
      surveyAudienceMode: 'invite',
      startAt: '2026-11-01T00:00:00.000Z',
      endAt: '2026-12-01T00:00:00.000Z',
    });
    expect(reminder).toMatchObject({
      surveyAudienceMode: 'reminder',
      startAt: '2026-11-08T00:00:00.000Z',
      endAt: '2026-12-01T00:00:00.000Z',
    });
  });

  it('is idempotent when campaigns are already linked', async () => {
    mockStudy([{ cohortKey: 'C1', inviteCampaignId: 'inv-1', reminderCampaignId: 'rem-1' }]);

    const result = await createSurveyStudyCampaigns({ studyId, actorEmail: 'a@mythoria.pt' });

    expect(service.createCampaign).not.toHaveBeenCalled();
    expect(callDomain.mock.calls.some(([op]) => op === 'linkCampaigns')).toBe(false);
    expect(result[0].invite).toEqual({ campaignId: 'inv-1', created: false, linked: false });
  });

  it('reuses an existing unlinked backoffice campaign instead of duplicating it', async () => {
    mockStudy([{ cohortKey: 'C1' }]);
    service.listSurveyCampaigns.mockResolvedValue([
      {
        id: 'existing-invite',
        status: 'draft',
        surveyCohortKey: 'C1',
        surveyAudienceMode: 'invite',
      } as never,
      // A cancelled campaign must not block creating a fresh one.
      {
        id: 'cancelled-reminder',
        status: 'cancelled',
        surveyCohortKey: 'C1',
        surveyAudienceMode: 'reminder',
      } as never,
    ]);

    await createSurveyStudyCampaigns({ studyId, actorEmail: 'a@mythoria.pt' });

    expect(service.createCampaign).toHaveBeenCalledTimes(1);
    expect(service.createCampaign.mock.calls[0][0]).toMatchObject({
      surveyAudienceMode: 'reminder',
    });
    expect(callDomain).toHaveBeenCalledWith(
      'linkCampaigns',
      {
        studyId,
        cohortKey: 'C1',
        inviteCampaignId: 'existing-invite',
        reminderCampaignId: 'campaign-1',
      },
      { email: 'a@mythoria.pt' },
    );
  });

  it('only processes requested cohorts and ignores unclassified keys', async () => {
    mockStudy([{ cohortKey: 'C1' }, { cohortKey: 'C2' }, { cohortKey: 'U1' }]);

    const result = await createSurveyStudyCampaigns({
      studyId,
      cohortKeys: ['C2', 'U1'],
      actorEmail: 'a@mythoria.pt',
    });

    expect(result.map((cohort) => cohort.cohortKey)).toEqual(['C2']);
    expect(service.createCampaign).toHaveBeenCalledTimes(2);
  });

  it('fails when no cohort matches', async () => {
    mockStudy([{ cohortKey: 'C1' }]);
    await expect(
      createSurveyStudyCampaigns({ studyId, cohortKeys: ['C3'], actorEmail: 'a@mythoria.pt' }),
    ).rejects.toThrow(/no matching cohorts/);
  });
});
