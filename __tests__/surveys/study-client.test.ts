/** @jest-environment node */
import {
  describeSurveyError,
  REWARD_POLICY_REQUIRED_HINT,
  surveyStudyClient,
  SurveyClientError,
} from '@/lib/surveys/study-client';
import {
  emailableCount,
  normalizeStudyDetail,
  normalizeStudyList,
} from '@/lib/surveys/study-types';
import { updateStudySchema } from '@/lib/surveys/study-schemas';

const fetchMock = jest.fn();
beforeEach(() => {
  fetchMock.mockReset();
  global.fetch = fetchMock as unknown as typeof fetch;
});

function respond(status: number, body: unknown) {
  fetchMock.mockResolvedValueOnce({ ok: status < 400, status, json: async () => body });
}

describe('survey study client', () => {
  it('maps list items { study, cohorts } into flat UI studies', async () => {
    respond(200, {
      data: {
        studies: [
          {
            study: { studyId: 's1', studyKey: 'k1', title: 'One', status: 'draft' },
            cohorts: [{ cohortKey: 'C1' }, { cohortKey: 'C2' }],
          },
        ],
      },
    });
    const studies = await surveyStudyClient.list();
    expect(studies).toHaveLength(1);
    expect(studies[0]).toMatchObject({ studyId: 's1', title: 'One', status: 'draft' });
    expect(studies[0].cohorts?.map((cohort) => cohort.cohortKey)).toEqual(['C1', 'C2']);
  });

  it('returns the created study in the detail shape', async () => {
    respond(201, { data: { study: { studyId: 's2' }, cohorts: [], holdoutCounts: { C1: 2 } } });
    const detail = await surveyStudyClient.create({} as never);
    expect(detail.study.studyId).toBe('s2');
  });

  it('surfaces the real message and code from the API error', async () => {
    respond(409, { error: 'Study is not a draft', code: 'study_not_draft' });
    await expect(surveyStudyClient.setStatus('s1', 'active')).rejects.toMatchObject({
      message: 'Study is not a draft',
      status: 409,
      code: 'study_not_draft',
    });
  });

  it('maps 409 reward_policy_required to a clear hint', async () => {
    respond(409, { error: 'Missing deadline', code: 'reward_policy_required' });
    const error = await surveyStudyClient.setStatus('s1', 'active').catch((err) => err);
    expect(error).toBeInstanceOf(SurveyClientError);
    expect(error.message).toContain(REWARD_POLICY_REQUIRED_HINT);
    expect(REWARD_POLICY_REQUIRED_HINT).toBe('Set a redemption deadline before activating');
  });

  it('falls back to a status message when the body has no error', () => {
    expect(describeSurveyError(500, undefined, undefined)).toBe('Request failed with status 500');
  });
});

describe('study types helpers', () => {
  it('normalizeStudyList tolerates arrays and missing payloads', () => {
    expect(normalizeStudyList(undefined)).toEqual([]);
    expect(normalizeStudyList([{ study: { studyId: 'a' }, cohorts: [] }])[0].studyId).toBe('a');
  });

  it('normalizeStudyDetail keeps invitation and holdout counts', () => {
    const detail = normalizeStudyDetail({
      study: { studyId: 'a' },
      cohorts: [],
      invitationCounts: { C1: { pending: 3 } },
      holdoutCounts: { C1: 1 },
    });
    expect(detail.holdoutCounts).toEqual({ C1: 1 });
    expect(detail.invitationCounts).toEqual({ C1: { pending: 3 } });
  });

  it('emailable = inserted - holdout', () => {
    const result = { inserted: { C1: 10, C2: 4 }, holdout: { C1: 2 }, skippedExisting: 0 };
    expect(emailableCount(result, 'C1')).toBe(8);
    expect(emailableCount(result, 'C2')).toBe(4);
    expect(emailableCount(result, 'C3')).toBe(0);
  });
});

describe('updateStudySchema', () => {
  it('rejects studyKey (the WebApp does not accept it) and allows a null deadline', () => {
    expect(updateStudySchema.parse({ studyKey: 'abc', title: 'x' })).toEqual({ title: 'x' });
    expect(updateStudySchema.safeParse({ studyKey: 'abc' }).success).toBe(false);
    expect(
      updateStudySchema.safeParse({
        rewardPolicy: { rewardTypes: ['pdf'], redemptionDeadline: null },
      }).success,
    ).toBe(true);
  });
});
