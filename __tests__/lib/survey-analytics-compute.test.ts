import {
  buildDimensionComparison,
  computeBusinessOutcomes,
  computeFunnelRates,
  computeQuestionResults,
  summarizeRewardOps,
  type AnswerRow,
  type OutcomeInvitation,
  type ResponseRow,
} from '@/lib/surveys/analytics-compute';
import { describeCondition, type SurveyDefinitionView } from '@/lib/surveys/definition';

const t = (text: string) => ({ 'en-US': text, 'pt-PT': text });

const definition: SurveyDefinitionView = {
  id: 'demo',
  version: 1,
  questions: [
    { id: 'S0', type: 'static_content', label: t('Intro') },
    {
      id: 'A02',
      type: 'buttons',
      dimension: 'tried_creating',
      required: true,
      label: t('Did you try to create a story?'),
      options: [
        { id: 'started', label: t('Yes, but I did not finish') },
        { id: 'not_started', label: t('No') },
      ],
    },
    {
      id: 'A03A',
      type: 'single_choice',
      dimension: 'stop_reason',
      required: false,
      label: t('What made you stop?'),
      visibleWhen: { question: 'A02', operator: 'equals', value: 'started' },
      options: [
        { id: 'no_idea', label: t('No idea') },
        { id: 'too_many_steps', label: t('Too many steps') },
      ],
    },
    {
      id: 'C05',
      type: 'stars',
      dimension: 'quality_rating',
      required: false,
      label: t('Rate the quality'),
      options: [
        { id: 's1', label: t('1'), value: 1 },
        { id: 's2', label: t('2'), value: 2 },
        { id: 's3', label: t('3'), value: 3 },
        { id: 's4', label: t('4'), value: 4 },
        { id: 's5', label: t('5'), value: 5 },
        { id: 'not_used', label: t('Not used'), notApplicable: true },
      ],
    },
    {
      id: 'U1',
      type: 'slider',
      dimension: 'likelihood',
      required: false,
      label: t('Likelihood'),
      validation: { min: 0, max: 10, step: 1 },
      naOptions: [{ id: 'unsure', label: t('Unsure'), notApplicable: true }],
    },
    {
      id: 'T1',
      type: 'long_text',
      dimension: 'open_improvement',
      required: false,
      label: t('Text'),
    },
  ],
};

const ids = (n: number) => Array.from({ length: n }, (_, i) => `R${i + 1}`);
const answer = (
  responseId: string,
  questionId: string,
  rest: Partial<AnswerRow> = {},
): AnswerRow => ({
  responseId,
  questionId,
  optionId: null,
  valueNumeric: null,
  isNotApplicable: false,
  isSkipped: false,
  ...rest,
});

function fixture() {
  const responses: ResponseRow[] = ids(10).map((responseId, index) => {
    const startedBranch = index < 6; // R1..R6 answered "started"
    const shown = ['A02'];
    if (startedBranch) shown.push('A03A');
    if (index < 4) shown.push('C05');
    if (index < 5) shown.push('U1');
    shown.push('T1');
    return { responseId, shownQuestionIds: shown };
  });
  const answers: AnswerRow[] = [
    ...ids(6).map((id) => answer(id, 'A02', { optionId: 'started' })),
    ...['R7', 'R8', 'R9', 'R10'].map((id) => answer(id, 'A02', { optionId: 'not_started' })),
    // Branch question: R1-R3 no_idea, R4 too_many_steps, R5 skipped row, R6 no row.
    answer('R1', 'A03A', { optionId: 'no_idea' }),
    answer('R2', 'A03A', { optionId: 'no_idea' }),
    answer('R3', 'A03A', { optionId: 'no_idea' }),
    answer('R4', 'A03A', { optionId: 'too_many_steps' }),
    answer('R5', 'A03A', { isSkipped: true }),
    // Stars: R1=5, R2=3, R3 not used (NA), R4 skipped.
    answer('R1', 'C05', { optionId: 's5', valueNumeric: 5 }),
    answer('R2', 'C05', { optionId: 's3', valueNumeric: 3 }),
    answer('R3', 'C05', { optionId: 'not_used', isNotApplicable: true }),
    answer('R4', 'C05', { isSkipped: true }),
    // Slider: R1=10, R2=4, R3 unsure, R4 skipped, R5 no row.
    answer('R1', 'U1', { valueNumeric: 10 }),
    answer('R2', 'U1', { valueNumeric: 4 }),
    answer('R3', 'U1', { optionId: 'unsure', isNotApplicable: true }),
    answer('R4', 'U1', { isSkipped: true }),
  ];
  return { responses, answers };
}

describe('computeQuestionResults denominators', () => {
  const { responses, answers } = fixture();
  const results = computeQuestionResults({
    definition,
    responses,
    answers,
    textAnswers: [
      { responseId: 'R1', questionId: 'T1', kind: 'free_text' },
      { responseId: 'R2', questionId: 'T1', kind: 'free_text' },
    ],
  });
  const byId = Object.fromEntries(results.map((r) => [r.questionId, r]));

  it('skips static content blocks', () => {
    expect(results.map((r) => r.questionId)).toEqual(['A02', 'A03A', 'C05', 'U1', 'T1']);
  });

  it('counts shown vs answered for a question everyone sees', () => {
    expect(byId.A02).toMatchObject({
      submittedN: 10,
      shownN: 10,
      answeredN: 10,
      skippedN: 0,
      notShownN: 0,
      isBranch: false,
    });
    const started = byId.A02.options.find((o) => o.optionId === 'started');
    expect(started).toMatchObject({ count: 6, rate: 0.6 });
  });

  it('uses shown - not eligible - as the branch denominator and never counts hidden as skipped', () => {
    const branch = byId.A03A;
    expect(branch.isBranch).toBe(true);
    expect(branch.branchCondition).toContain('Yes, but I did not finish');
    expect(branch.submittedN).toBe(10);
    expect(branch.shownN).toBe(6);
    expect(branch.notShownN).toBe(4);
    expect(branch.answeredN).toBe(4);
    // R5 (skipped row) and R6 (shown, no row) are skipped; the 4 hidden respondents are not.
    expect(branch.skippedN).toBe(2);
    expect(branch.shownN).toBe(branch.answeredN + branch.skippedN + branch.notApplicableN);
    const noIdea = branch.options.find((o) => o.optionId === 'no_idea');
    expect(noIdea).toMatchObject({ count: 3, rate: 3 / 4 });
  });

  it('excludes not-applicable and skipped answers from rating means and rates', () => {
    const stars = byId.C05;
    expect(stars.shownN).toBe(4);
    expect(stars.answeredN).toBe(2);
    expect(stars.notApplicableN).toBe(1);
    expect(stars.skippedN).toBe(1);
    expect(stars.numeric?.mean).toBe(4); // (5 + 3) / 2, N/A excluded
    expect(stars.numeric?.n).toBe(2);
    const na = stars.options.find((o) => o.optionId === 'not_used');
    expect(na).toMatchObject({ count: 1, rate: null, notApplicable: true });
    const five = stars.options.find((o) => o.optionId === 's5');
    expect(five?.rate).toBe(0.5);
    // distribution lists every scale point and omits the N/A option
    expect(stars.numeric?.distribution.map((d) => d.value)).toEqual([1, 2, 3, 4, 5]);
  });

  it('treats slider N/A options as not applicable and skips them in the mean', () => {
    const slider = byId.U1;
    expect(slider.shownN).toBe(5);
    expect(slider.answeredN).toBe(2);
    expect(slider.notApplicableN).toBe(1);
    expect(slider.skippedN).toBe(2);
    expect(slider.numeric).toMatchObject({ n: 2, mean: 7, median: 7, min: 4, max: 10 });
  });

  it('derives text answered counts from free-text rows', () => {
    expect(byId.T1).toMatchObject({ shownN: 10, answeredN: 2, skippedN: 8, kind: 'text' });
  });

  it('falls back to answer presence when shown_question_ids is missing and flags it', () => {
    const legacy = computeQuestionResults({
      definition,
      responses: [
        { responseId: 'L1', shownQuestionIds: null },
        { responseId: 'L2', shownQuestionIds: null },
      ],
      answers: [answer('L1', 'A02', { optionId: 'started' })],
    });
    const a02 = legacy.find((r) => r.questionId === 'A02');
    expect(a02).toMatchObject({ shownN: 1, answeredN: 1, shownEstimated: true });
  });
});

describe('definition helpers', () => {
  it('describes nested conditions in words', () => {
    expect(
      describeCondition(
        {
          any: [
            { question: 'A02', operator: 'equals', value: 'started' },
            { question: 'C05', operator: 'gte', value: 4 },
          ],
        },
        definition.questions,
      ),
    ).toBe(
      'A02 "Did you try to create a story?" is "Yes, but I did not finish" (started) OR C05 "Rate the quality" >= 4',
    );
  });
});

describe('funnel rates', () => {
  it('uses sent as the response-rate denominator when campaign data exists', () => {
    const rates = computeFunnelRates({
      eligible: 120,
      holdout: 20,
      invited: 100,
      sent: 90,
      opened: 40,
      started: 30,
      completed: 18,
    });
    expect(rates.responseRate).toMatchObject({ numerator: 18, denominator: 90 });
    expect(rates.responseRateOfInvited.value).toBeCloseTo(0.18);
    expect(rates.completionRate.value).toBeCloseTo(0.6);
    expect(rates.surveyVisitRate.value).toBeCloseTo(0.4);
    expect(rates.invitationRate.value).toBeCloseTo(100 / 120);
  });

  it('falls back to invited when sends are unknown and avoids division by zero', () => {
    const rates = computeFunnelRates({
      eligible: 0,
      holdout: 0,
      invited: 10,
      sent: null,
      opened: 0,
      started: 0,
      completed: 5,
    });
    expect(rates.responseRate.denominator).toBe(10);
    expect(rates.responseRate.denominatorLabel).toMatch(/unavailable/);
    expect(rates.completionRate.value).toBeNull();
    expect(rates.invitationRate.value).toBeNull();
  });
});

describe('reward operations summary', () => {
  it('summarizes statuses, choices and unredeemed entitlements', () => {
    const summary = summarizeRewardOps([
      { cohortKey: 'C1', status: 'eligible', rewardType: null, count: 5 },
      { cohortKey: 'C1', status: 'pending_story', rewardType: null, count: 3 },
      { cohortKey: 'C2', status: 'delivered', rewardType: 'pdf', count: 4 },
      { cohortKey: 'C2', status: 'delivered', rewardType: 'audiobook', count: 2 },
      { cohortKey: 'C2', status: 'failed', rewardType: 'pdf', count: 1 },
      { cohortKey: 'C3', status: 'expired', rewardType: null, count: 2 },
    ]);
    expect(summary).toMatchObject({
      earned: 17,
      selectedPdf: 5,
      selectedAudiobook: 2,
      pendingStory: 3,
      delivered: 6,
      failed: 1,
      expired: 2,
      unredeemed: 8,
    });
    expect(summary.redemptionRate).toMatchObject({ numerator: 6, denominator: 17 });
    expect(summary.perCohort.C2).toEqual({ earned: 7, delivered: 6, failed: 1 });
  });
});

describe('cross-cohort comparison', () => {
  const entry = (cohortKey: string, signature: string) => ({
    cohortKey,
    surveyId: `s_${cohortKey}`,
    version: 1,
    questionId: 'Q',
    wording: 'w',
    optionSetSignature: signature,
    submittedN: 10,
    shownN: 10,
    answeredN: 9,
    notApplicableN: 0,
    skippedN: 1,
    options: [],
  });

  it('flags differing option sets and never merges them', () => {
    const different = buildDimensionComparison('preferred_output', [
      entry('C1', 'a|b'),
      entry('C2', 'a|b|c'),
    ]);
    expect(different.optionSetsIdentical).toBe(false);
    expect(different.note).toMatch(/not merged/);
    expect(
      buildDimensionComparison('preferred_output', [entry('C1', 'a|b'), entry('C2', 'a|b')])
        .optionSetsIdentical,
    ).toBe(true);
  });
});

describe('business outcomes (rewards are never paid)', () => {
  const now = new Date('2026-12-31T00:00:00Z');
  const day = (n: number) => new Date(Date.UTC(2026, 10, 1) + n * 86_400_000);
  const invitation = (
    authorId: string,
    overrides: Partial<OutcomeInvitation> = {},
  ): OutcomeInvitation => ({
    authorId,
    cohortKey: 'C2',
    isHoldout: false,
    status: 'submitted',
    createdAt: day(0),
    submittedAt: day(2),
    hadPaidPurchaseAtSnapshot: false,
    ...overrides,
  });

  const input = {
    windowDays: 30,
    now,
    invitations: [
      invitation('resp-paid'),
      invitation('resp-reward'),
      invitation('resp-nothing'),
      invitation('nonresp', { status: 'not_started', submittedAt: null }),
      invitation('holdout', { isHoldout: true, status: 'not_started', submittedAt: null }),
      invitation('resp-early-paid'),
      invitation('late', { createdAt: day(55), submittedAt: day(56) }), // window still open
    ],
    paidOrders: [
      { authorId: 'resp-paid', at: day(10) },
      { authorId: 'nonresp', at: day(5) },
      { authorId: 'resp-early-paid', at: day(1) }, // before submission -> not a window conversion
    ],
    publishedStories: [
      { authorId: 'resp-paid', at: day(12) },
      { authorId: 'resp-reward', at: day(8) },
    ],
    productRuns: [
      { authorId: 'resp-reward', at: day(9), fundingSource: 'survey_reward' },
      { authorId: 'resp-paid', at: day(11), fundingSource: 'credits' },
    ],
  };
  const outcomes = computeBusinessOutcomes(input);
  const group = (name: string) => outcomes.groups.find((g) => g.group === name)!;

  it('counts only credit-funded runs as paid premium attach; rewards are separate', () => {
    const respondents = group('respondent');
    expect(respondents.premiumAttachPaid.value).toBe(1); // resp-paid only
    expect(respondents.rewardRedemptions.value).toBe(1); // resp-reward, shown separately
  });

  it('never treats a reward redemption as a first paid purchase', () => {
    const respondents = group('respondent');
    // resp-paid converts; resp-reward (reward run only) does not; resp-early-paid paid before window.
    expect(respondents.firstPaidConversion.value).toBe(1);
    expect(respondents.firstPaidConversion.denominator).toBe(4);
    expect(respondents.paidPurchase.value).toBe(1);
  });

  it('measures repeat creation, excludes immature windows and splits the three groups', () => {
    const respondents = group('respondent');
    expect(respondents.n).toBe(5);
    expect(respondents.matureN).toBe(4); // "late" is still inside its window
    expect(respondents.repeatCreation.value).toBe(2);
    expect(group('invited_non_respondent').firstPaidConversion.value).toBe(1);
    expect(group('holdout')).toMatchObject({ n: 1, matureN: 1 });
    expect(group('holdout').firstPaidConversion.value).toBe(0);
  });

  it('marks GA4-only metrics unavailable instead of estimating them', () => {
    expect(outcomes.unavailable.map((u) => u.metric)).toEqual([
      'pricing_page_visits',
      'reading_depth',
    ]);
  });

  it('excludes users who were already paying at snapshot from first-paid conversion', () => {
    const result = computeBusinessOutcomes({
      ...input,
      invitations: [invitation('resp-paid', { hadPaidPurchaseAtSnapshot: true })],
    });
    expect(result.groups[0].firstPaidConversion).toMatchObject({ value: 0, denominator: 0 });
    expect(result.groups[0].paidPurchase.value).toBe(1);
  });
});
