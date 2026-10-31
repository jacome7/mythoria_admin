/** @jest-environment node */
import { getMythoriaDb } from '@/db';
import {
  buildExport,
  escapeLike,
  exportResponsesCsv,
  getBusinessOutcomes,
  getRewardOps,
  getSurveyResults,
  summarizeOverview,
  type SurveyOverviewRow,
} from '@/db/services/survey-analytics';
import { toCsv } from '@/lib/csv';

jest.mock('@/db', () => ({ getMythoriaDb: jest.fn(), getBackofficeDb: jest.fn() }));

const mockMythoria = jest.mocked(getMythoriaDb);

/** Each `db.select()` call returns a thenable query builder that resolves the next queued result. */
function queueDb(results: unknown[]) {
  const queue = [...results];
  const select = jest.fn(() => {
    const result = queue.shift();
    const builder: Record<string, unknown> = {};
    for (const method of [
      'from',
      'innerJoin',
      'leftJoin',
      'where',
      'groupBy',
      'orderBy',
      'limit',
      'offset',
    ]) {
      builder[method] = jest.fn(() => builder);
    }
    builder.then = (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) =>
      Promise.resolve(result).then(resolve, reject);
    return builder;
  });
  return { select };
}

const day = (n: number) => new Date(Date.UTC(2026, 0, 1) + n * 86_400_000);

describe('getBusinessOutcomes', () => {
  it('never counts survey_reward generations as paid purchases or paid premium attach', async () => {
    const snapshot = { publishedStoryCount: 1, hasPaidPurchase: false, snapshotAt: '2026-01-01' };
    mockMythoria.mockReturnValue(
      queueDb([
        null, // study authors sub-select (never awaited)
        [
          {
            authorId: 'a1',
            cohortKey: 'C2',
            isHoldout: false,
            status: 'submitted',
            createdAt: day(0),
            submittedAt: day(1),
            cohortSnapshot: snapshot,
          },
        ],
        [], // no paid orders
        [{ authorId: 'a1', at: day(10) }],
        [{ authorId: 'a1', at: day(5), fundingSource: 'survey_reward' }],
      ]) as never,
    );
    const outcomes = await getBusinessOutcomes({
      studyId: '11111111-1111-4111-8111-111111111111',
      windowDays: 30,
      now: day(200),
    });
    const respondents = outcomes.groups.find((g) => g.group === 'respondent')!;
    expect(respondents.firstPaidConversion.value).toBe(0);
    expect(respondents.paidPurchase.value).toBe(0);
    expect(respondents.premiumAttachPaid.value).toBe(0);
    expect(respondents.rewardRedemptions.value).toBe(1);
    expect(respondents.repeatCreation.value).toBe(1);
  });
});

describe('getRewardOps', () => {
  it('summarizes grouped entitlement rows', async () => {
    mockMythoria.mockReturnValue(
      queueDb([
        [
          { cohortKey: 'C1', status: 'delivered', rewardType: 'pdf', count: '3' },
          { cohortKey: 'C1', status: 'failed', rewardType: 'audiobook', count: 1 },
          { cohortKey: 'C1', status: 'pending_story', rewardType: null, count: 2 },
        ],
        [
          {
            entitlementId: 'e1',
            cohortKey: 'C1',
            rewardType: 'audiobook',
            lastError: 'timeout',
            attempts: 2,
            failedAt: day(1),
          },
        ],
      ]) as never,
    );
    const result = await getRewardOps('11111111-1111-4111-8111-111111111111');
    expect(result.summary).toMatchObject({
      earned: 6,
      delivered: 3,
      failed: 1,
      pendingStory: 2,
      selectedPdf: 3,
      selectedAudiobook: 1,
      unredeemed: 2,
    });
    expect(result.failures).toHaveLength(1);
    expect(result.productionCost.available).toBe(false);
  });
});

describe('getSurveyResults', () => {
  it('returns null for an unknown survey version', async () => {
    mockMythoria.mockReturnValue(queueDb([[]]) as never);
    await expect(
      getSurveyResults({ surveyVersionId: '11111111-1111-4111-8111-111111111111' }),
    ).resolves.toBeNull();
  });

  it('combines funnel, delivery and question denominators', async () => {
    const definition = {
      questions: [
        {
          id: 'Q1',
          type: 'single_choice',
          dimension: 'primary_intent',
          required: true,
          label: { 'en-US': 'Why?' },
          options: [
            { id: 'a', label: { 'en-US': 'A' } },
            { id: 'b', label: { 'en-US': 'B' } },
          ],
        },
      ],
    };
    const versionId = '11111111-1111-4111-8111-111111111111';
    // Call order: loadVersion, then Promise.all([loadFunnel -> (counts, links), questions -> 3, scopes]).
    mockMythoria.mockReturnValue(
      queueDb([
        [
          {
            surveyVersionId: versionId,
            surveyId: 's',
            version: 1,
            schemaVersion: 1,
            definition,
            definitionHash: 'h',
            publishedAt: day(0),
            surveyTitle: 'Survey',
            surveyStatus: 'active',
            purpose: 'p',
          },
        ],
        // loadFunnel: invitation counts, campaign links
        [
          {
            eligible: 12,
            holdout: 2,
            invited: 10,
            opened: 6,
            started: 5,
            completed: 4,
            lastResponseAt: day(3),
          },
        ],
        [], // no linked campaigns
        // loadSubmittedData: responses, answers, text
        [
          {
            responseId: 'r1',
            shownQuestionIds: ['Q1'],
            cohortKey: 'C1',
            locale: 'en-US',
            durationMs: 60000,
          },
          {
            responseId: 'r2',
            shownQuestionIds: ['Q1'],
            cohortKey: 'C1',
            locale: 'en-US',
            durationMs: 120000,
          },
          {
            responseId: 'r3',
            shownQuestionIds: ['Q1'],
            cohortKey: 'C1',
            locale: 'en-US',
            durationMs: null,
          },
        ],
        [
          {
            responseId: 'r1',
            questionId: 'Q1',
            optionId: 'a',
            valueNumeric: null,
            isNotApplicable: false,
            isSkipped: false,
            hasOtherText: false,
          },
          {
            responseId: 'r2',
            questionId: 'Q1',
            optionId: 'a',
            valueNumeric: null,
            isNotApplicable: false,
            isSkipped: false,
            hasOtherText: false,
          },
          {
            responseId: 'r3',
            questionId: 'Q1',
            optionId: null,
            valueNumeric: null,
            isNotApplicable: false,
            isSkipped: true,
            hasOtherText: false,
          },
        ],
        [],
        [], // scopes
      ]) as never,
    );
    const result = await getSurveyResults({ surveyVersionId: versionId });
    expect(result?.funnel.counts).toMatchObject({
      eligible: 12,
      invited: 10,
      sent: null,
      completed: 4,
    });
    expect(result?.funnel.rates.responseRate.denominator).toBe(10);
    expect(result?.duration).toMatchObject({ measuredN: 2, medianMs: 90000 });
    const q1 = result?.questions[0];
    expect(q1).toMatchObject({ shownN: 3, answeredN: 2, skippedN: 1 });
    expect(q1?.options.find((o) => o.optionId === 'a')?.rate).toBe(1);
  });
});

describe('exportResponsesCsv', () => {
  const versionRow = {
    surveyVersionId: 'v',
    surveyId: 'paying_creator',
    version: 2,
    schemaVersion: 1,
    definition: {
      questions: [{ id: 'T1', type: 'long_text', dimension: 'open_improvement', label: {} }],
    },
    definitionHash: 'h',
    publishedAt: day(0),
    surveyTitle: 't',
    surveyStatus: 'active',
    purpose: 'p',
  };
  const answerRow = {
    responseId: 'r1',
    questionId: 'C05',
    dimension: 'quality_rating',
    optionId: 's4',
    valueNumeric: 4,
    isNotApplicable: false,
    isSkipped: false,
    cohortKey: 'C3',
    locale: 'pt-PT',
    submittedAt: day(1),
  };

  it('exports coded rows without a text column by default', async () => {
    mockMythoria.mockReturnValue(queueDb([[versionRow], [answerRow], []]) as never);
    const exported = await exportResponsesCsv({ surveyVersionId: 'v' });
    expect(exported?.header).toEqual([
      'response_id',
      'survey_id',
      'version',
      'cohort_key',
      'locale',
      'submitted_at',
      'question_id',
      'dimension',
      'option_id',
      'value_numeric',
      'is_not_applicable',
      'is_skipped',
    ]);
    expect(exported?.rowCount).toBe(1);
    expect(exported?.rows[0]).toEqual([
      'r1',
      'paying_creator',
      2,
      'C3',
      'pt-PT',
      day(1),
      'C05',
      'quality_rating',
      's4',
      4,
      false,
      false,
    ]);
  });

  it('adds text rows only when includeText is set and neutralizes formulas', async () => {
    mockMythoria.mockReturnValue(
      queueDb([
        [versionRow],
        [answerRow],
        [
          {
            responseId: 'r1',
            questionId: 'T1',
            kind: 'free_text',
            optionId: null,
            text: '=HYPERLINK("http://evil","x")',
            cohortKey: 'C3',
            locale: 'pt-PT',
            submittedAt: day(1),
          },
        ],
      ]) as never,
    );
    const exported = await exportResponsesCsv({ surveyVersionId: 'v', includeText: true });
    expect(exported?.header.slice(-2)).toEqual(['text_kind', 'text_value']);
    expect(exported?.rowCount).toBe(2);
    const csv = toCsv(exported!.header, exported!.rows);
    expect(csv).toContain(`"'=HYPERLINK(""http://evil"",""x"")"`);
    expect(csv.split('\r\n')[1].endsWith(',,')).toBe(true);
  });

  it('buildExport omits text columns when not requested', () => {
    const built = buildExport({
      surveyId: 's',
      version: 1,
      includeText: false,
      dimensionByQuestion: new Map(),
      answerRows: [],
      textRows: [
        {
          responseId: 'r',
          questionId: 'T1',
          kind: 'free_text',
          optionId: null,
          text: 'secret',
          cohortKey: 'C1',
          locale: 'en-US',
          submittedAt: null,
        },
      ],
    });
    expect(built.header).not.toContain('text_value');
    expect(built.rows).toHaveLength(0);
  });
});

describe('helpers', () => {
  it('escapes LIKE wildcards in text search', () => {
    expect(escapeLike('50%_off\\')).toBe('50\\%\\_off\\\\');
  });

  it('summarizes overview rows', () => {
    const row = (overrides: Partial<SurveyOverviewRow>): SurveyOverviewRow =>
      ({
        surveyId: 's',
        surveyVersionId: 'v1',
        invited: 10,
        started: 5,
        completed: 3,
        deliveryIssues: { failed: 2, skipped: 0 },
        rewardFailures: 1,
        ...overrides,
      }) as SurveyOverviewRow;
    expect(summarizeOverview([row({}), row({ surveyVersionId: 'v2' })])).toEqual({
      surveys: 1,
      versions: 2,
      invited: 20,
      started: 10,
      completed: 6,
      deliveryFailures: 4,
      rewardFailures: 2,
    });
  });
});
