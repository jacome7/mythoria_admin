/**
 * Pure survey analytics computations (no I/O). The DB service in
 * `src/db/services/survey-analytics.ts` fetches rows and delegates here so the denominator rules
 * can be unit tested without databases.
 *
 * Denominator rules (PRD 9.5, 12.4, ADM-008/009):
 * - `submittedN`  : submitted responses in scope (the "eligible" base for every question).
 * - `shownN`      : submitted responses whose `shown_question_ids` contains the question.
 *                   Branch questions that were not shown are NEVER counted as skipped.
 * - `answeredN`   : shown and answered with a valid (non-N/A) answer. This is the selection-rate
 *                   and mean denominator ("valid respondents shown").
 * - `notApplicableN`: shown and answered "not applicable / not used / don't know".
 * - `skippedN`    : shown, optional and left empty.
 * - shownN = answeredN + notApplicableN + skippedN.
 */
import {
  describeCondition,
  isAnswerableQuestion,
  localize,
  optionSetSignature,
  questionKind,
  type DefinitionOption,
  type DefinitionQuestion,
  type QuestionKind,
  type SurveyDefinitionView,
} from './definition';

export interface ResponseRow {
  responseId: string;
  shownQuestionIds: string[] | null;
  cohortKey?: string | null;
  locale?: string | null;
  durationMs?: number | null;
}

export interface AnswerRow {
  responseId: string;
  questionId: string;
  optionId: string | null;
  valueNumeric: number | null;
  isNotApplicable: boolean;
  isSkipped: boolean;
  hasOtherText?: boolean;
}

export interface TextAnswerRow {
  responseId: string;
  questionId: string;
  kind: 'free_text' | 'other_text';
  optionId?: string | null;
}

export interface OptionResult {
  optionId: string;
  label: string;
  count: number;
  /** count / answeredN; null for not-applicable options (reported separately). */
  rate: number | null;
  notApplicable: boolean;
  value: number | null;
}

export interface NumericSummary {
  n: number;
  mean: number | null;
  median: number | null;
  min: number | null;
  max: number | null;
  distribution: { label: string; value: number | null; count: number }[];
}

export interface QuestionResult {
  questionId: string;
  type: string;
  kind: QuestionKind;
  dimension: string | null;
  label: string;
  required: boolean;
  isBranch: boolean;
  branchCondition: string | null;
  submittedN: number;
  shownN: number;
  /** Submitted responses that never saw the question (only meaningful for branch questions). */
  notShownN: number;
  answeredN: number;
  skippedN: number;
  notApplicableN: number;
  otherTextN: number;
  options: OptionResult[];
  numeric: NumericSummary | null;
  denominator: { selectionRate: string; mean: string };
  /** True when shown_question_ids was missing for some responses and presence of answers was used. */
  shownEstimated: boolean;
}

export const SELECTION_RATE_DENOMINATOR =
  'valid respondents shown the question (answered, excluding not-applicable and skipped)';
export const MEAN_DENOMINATOR =
  'valid numeric answers (not-applicable, skipped and hidden excluded)';

function groupBy<T>(rows: readonly T[], key: (row: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const row of rows) {
    const k = key(row);
    const list = map.get(k);
    if (list) list.push(row);
    else map.set(k, [row]);
  }
  return map;
}

export function mean(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

export function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function round(value: number | null, digits = 2): number | null {
  if (value === null) return null;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function numericDistribution(values: readonly number[]): NumericSummary['distribution'] {
  if (values.length === 0) return [];
  const counts = new Map<number, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  const distinct = [...counts.keys()].sort((a, b) => a - b);
  if (distinct.length <= 12) {
    return distinct.map((v) => ({ label: String(v), value: v, count: counts.get(v) ?? 0 }));
  }
  const min = distinct[0];
  const max = distinct[distinct.length - 1];
  const bins = 10;
  const width = (max - min) / bins || 1;
  const buckets = Array.from({ length: bins }, (_, i) => ({
    label: `${round(min + i * width, 2)}-${round(min + (i + 1) * width, 2)}`,
    value: null as number | null,
    count: 0,
  }));
  for (const v of values) {
    const index = Math.min(bins - 1, Math.floor((v - min) / width));
    buckets[index].count += 1;
  }
  return buckets;
}

function summarizeNumeric(values: readonly number[]): NumericSummary {
  return {
    n: values.length,
    mean: round(mean(values)),
    median: round(median(values)),
    min: values.length ? Math.min(...values) : null,
    max: values.length ? Math.max(...values) : null,
    distribution: numericDistribution(values),
  };
}

type Outcome = 'answered' | 'not_applicable' | 'skipped';

/**
 * Computes per-question results for one survey version from submitted responses.
 * Static content blocks are skipped.
 */
export function computeQuestionResults(input: {
  definition: SurveyDefinitionView;
  locale?: string;
  responses: readonly ResponseRow[];
  answers: readonly AnswerRow[];
  textAnswers?: readonly TextAnswerRow[];
}): QuestionResult[] {
  const { definition, responses, answers } = input;
  const textAnswers = input.textAnswers ?? [];
  const locale = input.locale ?? 'en-US';
  const submittedN = responses.length;
  const answersByQuestion = groupBy(answers, (a) => a.questionId);
  const textByQuestion = groupBy(textAnswers, (a) => a.questionId);
  const results: QuestionResult[] = [];

  for (const question of definition.questions) {
    if (!isAnswerableQuestion(question)) continue;
    const kind = questionKind(question);
    if (!kind) continue;

    const rowsByResponse = groupBy(answersByQuestion.get(question.id) ?? [], (a) => a.responseId);
    const textByResponse = groupBy(textByQuestion.get(question.id) ?? [], (a) => a.responseId);

    let shownEstimated = false;
    const shownResponses = responses.filter((response) => {
      if (response.shownQuestionIds) return response.shownQuestionIds.includes(question.id);
      shownEstimated = true;
      return rowsByResponse.has(response.responseId) || textByResponse.has(response.responseId);
    });

    const optionDefs: DefinitionOption[] = [
      ...(question.options ?? []),
      ...(question.naOptions ?? []),
    ];
    const optionById = new Map(optionDefs.map((o) => [o.id, o]));
    const optionCounts = new Map<string, number>();
    const numericValues: number[] = [];
    let answeredN = 0;
    let skippedN = 0;
    let notApplicableN = 0;
    let otherTextN = 0;

    for (const response of shownResponses) {
      const rows = rowsByResponse.get(response.responseId) ?? [];
      const texts = textByResponse.get(response.responseId) ?? [];
      const real = rows.filter((r) => !r.isSkipped && !r.isNotApplicable);
      const naRows = rows.filter((r) => r.isNotApplicable && !r.isSkipped);
      const freeText = texts.some((t) => t.kind === 'free_text');
      let outcome: Outcome;
      if (real.length > 0 || (kind === 'text' && freeText)) outcome = 'answered';
      else if (naRows.length > 0) outcome = 'not_applicable';
      else outcome = 'skipped';

      if (outcome === 'answered') answeredN += 1;
      else if (outcome === 'not_applicable') notApplicableN += 1;
      else skippedN += 1;

      const countedOptions = new Set<string>();
      if (outcome !== 'skipped') {
        for (const row of outcome === 'answered' ? real : naRows) {
          if (row.optionId && !countedOptions.has(row.optionId)) {
            countedOptions.add(row.optionId);
            optionCounts.set(row.optionId, (optionCounts.get(row.optionId) ?? 0) + 1);
          }
        }
      }
      if (rows.some((r) => r.hasOtherText) || texts.some((t) => t.kind === 'other_text')) {
        otherTextN += 1;
      }

      if (outcome === 'answered' && (kind === 'rating' || kind === 'numeric')) {
        const row = real[0];
        const option = row.optionId ? optionById.get(row.optionId) : undefined;
        const value = option?.value ?? row.valueNumeric;
        if (typeof value === 'number' && Number.isFinite(value) && !option?.notApplicable) {
          numericValues.push(value);
        }
      }
    }

    const options: OptionResult[] = optionDefs.map((option) => {
      const count = optionCounts.get(option.id) ?? 0;
      const notApplicable =
        option.notApplicable === true || (question.naOptions ?? []).includes(option);
      return {
        optionId: option.id,
        label: localize(option.label, locale),
        count,
        rate: notApplicable || answeredN === 0 ? null : count / answeredN,
        notApplicable,
        value: typeof option.value === 'number' ? option.value : null,
      };
    });

    const numeric =
      kind === 'rating' || kind === 'numeric' ? summarizeNumeric(numericValues) : null;
    if (kind === 'rating' && numeric) {
      // Rating distributions come from the option definitions so empty scale points are shown.
      numeric.distribution = options
        .filter((o) => !o.notApplicable && o.value !== null)
        .sort((a, b) => (a.value ?? 0) - (b.value ?? 0))
        .map((o) => ({ label: o.label, value: o.value, count: o.count }));
    }

    results.push({
      questionId: question.id,
      type: question.type,
      kind,
      dimension: question.dimension ?? null,
      label: localize(question.label, locale),
      required: question.required === true,
      isBranch: question.visibleWhen !== undefined,
      branchCondition: question.visibleWhen
        ? describeCondition(question.visibleWhen, definition.questions, locale)
        : null,
      submittedN,
      shownN: shownResponses.length,
      notShownN: submittedN - shownResponses.length,
      answeredN,
      skippedN,
      notApplicableN,
      otherTextN,
      options,
      numeric,
      denominator: { selectionRate: SELECTION_RATE_DENOMINATOR, mean: MEAN_DENOMINATOR },
      shownEstimated,
    });
  }
  return results;
}

// -----------------------------------------------------------------------------
// Funnel
// -----------------------------------------------------------------------------

export interface FunnelCounts {
  eligible: number; // all snapshot invitations (incl. holdout)
  holdout: number;
  invited: number; // eligible minus holdout
  sent: number | null; // from campaign recipients; null when no linked campaign
  opened: number;
  started: number;
  completed: number;
}

export interface Rate {
  value: number | null;
  numerator: number;
  denominator: number;
  denominatorLabel: string;
}

function rate(numerator: number, denominator: number, label: string): Rate {
  return {
    value: denominator > 0 ? numerator / denominator : null,
    numerator,
    denominator,
    denominatorLabel: label,
  };
}

export function computeFunnelRates(counts: FunnelCounts) {
  const sentKnown = counts.sent !== null && counts.sent > 0;
  return {
    invitationRate: rate(
      counts.invited,
      counts.eligible,
      'eligible users in the audience snapshot',
    ),
    surveyVisitRate: rate(counts.opened, counts.invited, 'invited users (excl. holdout)'),
    responseRate: sentKnown
      ? rate(counts.completed, counts.sent as number, 'emails sent to the invited audience')
      : rate(counts.completed, counts.invited, 'invited users (send data unavailable)'),
    responseRateOfInvited: rate(counts.completed, counts.invited, 'invited users (excl. holdout)'),
    completionRate: rate(counts.completed, counts.started, 'surveys started'),
  };
}

// -----------------------------------------------------------------------------
// Reward operations
// -----------------------------------------------------------------------------

export interface RewardGroupRow {
  cohortKey: string;
  status: string;
  rewardType: string | null;
  count: number;
}

export interface RewardOpsSummary {
  earned: number;
  byStatus: Record<string, number>;
  selectedPdf: number;
  selectedAudiobook: number;
  pendingStory: number;
  processing: number;
  delivered: number;
  failed: number;
  expired: number;
  /** Earned but not yet chosen/redeemed (eligible + pending_story), excluding expired. */
  unredeemed: number;
  redemptionRate: Rate;
  perCohort: Record<string, { earned: number; delivered: number; failed: number }>;
}

const REWARD_STATUSES = [
  'eligible',
  'pending_story',
  'selected',
  'processing',
  'delivered',
  'failed',
  'expired',
] as const;
const CHOSEN_STATUSES = new Set(['selected', 'processing', 'delivered', 'failed']);

export function summarizeRewardOps(rows: readonly RewardGroupRow[]): RewardOpsSummary {
  const byStatus: Record<string, number> = Object.fromEntries(REWARD_STATUSES.map((s) => [s, 0]));
  const perCohort: RewardOpsSummary['perCohort'] = {};
  let earned = 0;
  let selectedPdf = 0;
  let selectedAudiobook = 0;
  for (const row of rows) {
    earned += row.count;
    byStatus[row.status] = (byStatus[row.status] ?? 0) + row.count;
    if (CHOSEN_STATUSES.has(row.status) || row.rewardType) {
      if (row.rewardType === 'pdf') selectedPdf += row.count;
      if (row.rewardType === 'audiobook') selectedAudiobook += row.count;
    }
    const cohort = (perCohort[row.cohortKey] ??= { earned: 0, delivered: 0, failed: 0 });
    cohort.earned += row.count;
    if (row.status === 'delivered') cohort.delivered += row.count;
    if (row.status === 'failed') cohort.failed += row.count;
  }
  return {
    earned,
    byStatus,
    selectedPdf,
    selectedAudiobook,
    pendingStory: byStatus.pending_story,
    processing: byStatus.processing,
    delivered: byStatus.delivered,
    failed: byStatus.failed,
    expired: byStatus.expired,
    unredeemed: byStatus.eligible + byStatus.pending_story,
    redemptionRate: rate(byStatus.delivered, earned, 'reward entitlements granted'),
    perCohort,
  };
}

// -----------------------------------------------------------------------------
// Business outcomes
// -----------------------------------------------------------------------------

export type OutcomeGroup = 'respondent' | 'invited_non_respondent' | 'holdout';

export interface OutcomeInvitation {
  authorId: string;
  cohortKey: string;
  isHoldout: boolean;
  status: string;
  createdAt: Date;
  submittedAt: Date | null;
  hadPaidPurchaseAtSnapshot: boolean;
}
export interface OutcomeOrder {
  authorId: string;
  at: Date;
}
export interface OutcomeStory {
  authorId: string;
  at: Date;
}
export interface OutcomeProductRun {
  authorId: string;
  at: Date;
  fundingSource: string;
}

export interface OutcomeMetric {
  value: number;
  denominator: number;
  rate: number | null;
}

export interface OutcomeGroupResult {
  cohortKey: string;
  group: OutcomeGroup;
  n: number;
  /** Users whose full observation window has elapsed; every rate uses this base. */
  matureN: number;
  firstPaidConversion: OutcomeMetric;
  paidPurchase: OutcomeMetric;
  repeatCreation: OutcomeMetric;
  /** Credit-funded (paid) PDF / audiobook generations only. */
  premiumAttachPaid: OutcomeMetric;
  /** Survey-reward generations. Shown for transparency; NEVER part of paid metrics. */
  rewardRedemptions: OutcomeMetric;
}

export interface BusinessOutcomes {
  windowDays: number;
  anchors: { respondent: string; invited_non_respondent: string; holdout: string };
  groups: OutcomeGroupResult[];
  unavailable: { metric: string; reason: string }[];
  caveats: string[];
}

function metric(value: number, denominator: number): OutcomeMetric {
  return { value, denominator, rate: denominator > 0 ? value / denominator : null };
}

function groupOf(inv: OutcomeInvitation): OutcomeGroup {
  if (inv.isHoldout) return 'holdout';
  return inv.status === 'submitted' ? 'respondent' : 'invited_non_respondent';
}

export const PAID_RUN_FUNDING = 'credits';
export const REWARD_RUN_FUNDING = 'survey_reward';

export function computeBusinessOutcomes(input: {
  windowDays: number;
  now: Date;
  invitations: readonly OutcomeInvitation[];
  paidOrders: readonly OutcomeOrder[];
  publishedStories: readonly OutcomeStory[];
  productRuns: readonly OutcomeProductRun[];
}): BusinessOutcomes {
  const windowMs = input.windowDays * 86_400_000;
  const ordersByAuthor = groupBy(input.paidOrders, (o) => o.authorId);
  const storiesByAuthor = groupBy(input.publishedStories, (o) => o.authorId);
  const runsByAuthor = groupBy(input.productRuns, (o) => o.authorId);

  const buckets = new Map<
    string,
    {
      cohortKey: string;
      group: OutcomeGroup;
      n: number;
      matureN: number;
      firstPaidEligible: number;
      firstPaid: number;
      paid: number;
      repeat: number;
      premiumPaid: number;
      reward: number;
    }
  >();

  for (const inv of input.invitations) {
    const group = groupOf(inv);
    const key = `${inv.cohortKey}|${group}`;
    const bucket = buckets.get(key) ?? {
      cohortKey: inv.cohortKey,
      group,
      n: 0,
      matureN: 0,
      firstPaidEligible: 0,
      firstPaid: 0,
      paid: 0,
      repeat: 0,
      premiumPaid: 0,
      reward: 0,
    };
    buckets.set(key, bucket);
    bucket.n += 1;

    const anchor = group === 'respondent' ? (inv.submittedAt ?? inv.createdAt) : inv.createdAt;
    const end = new Date(anchor.getTime() + windowMs);
    if (end.getTime() > input.now.getTime()) continue; // window still open
    bucket.matureN += 1;

    const inWindow = (at: Date) =>
      at.getTime() >= anchor.getTime() && at.getTime() <= end.getTime();
    const orders = ordersByAuthor.get(inv.authorId) ?? [];
    if (orders.some((o) => inWindow(o.at))) bucket.paid += 1;

    if (!inv.hadPaidPurchaseAtSnapshot) {
      bucket.firstPaidEligible += 1;
      const firstEver = orders.reduce<Date | null>(
        (min, o) => (min === null || o.at < min ? o.at : min),
        null,
      );
      if (firstEver && inWindow(firstEver)) bucket.firstPaid += 1;
    }

    const stories = storiesByAuthor.get(inv.authorId) ?? [];
    if (stories.some((s) => inWindow(s.at))) bucket.repeat += 1;

    const runs = runsByAuthor.get(inv.authorId) ?? [];
    if (runs.some((r) => r.fundingSource === PAID_RUN_FUNDING && inWindow(r.at))) {
      bucket.premiumPaid += 1;
    }
    if (runs.some((r) => r.fundingSource === REWARD_RUN_FUNDING && inWindow(r.at))) {
      bucket.reward += 1;
    }
  }

  const groups: OutcomeGroupResult[] = [...buckets.values()]
    .sort((a, b) => a.cohortKey.localeCompare(b.cohortKey) || a.group.localeCompare(b.group))
    .map((b) => ({
      cohortKey: b.cohortKey,
      group: b.group,
      n: b.n,
      matureN: b.matureN,
      firstPaidConversion: metric(b.firstPaid, b.firstPaidEligible),
      paidPurchase: metric(b.paid, b.matureN),
      repeatCreation: metric(b.repeat, b.matureN),
      premiumAttachPaid: metric(b.premiumPaid, b.matureN),
      rewardRedemptions: metric(b.reward, b.matureN),
    }));

  return {
    windowDays: input.windowDays,
    anchors: {
      respondent: 'survey submitted_at',
      invited_non_respondent: 'invitation created_at (audience snapshot)',
      holdout: 'invitation created_at (audience snapshot)',
    },
    groups,
    unavailable: [
      { metric: 'pricing_page_visits', reason: 'GA4 only; not stored in mythoria_db' },
      { metric: 'reading_depth', reason: 'GA4 only; not stored in mythoria_db' },
    ],
    caveats: [
      'Survey respondents are a self-selected sample; differences versus non-respondents are not causal.',
      'Respondents are measured from submission time, other groups from invitation time, so windows are not identical.',
      'Only users whose full observation window has elapsed are counted (matureN).',
      'Survey-reward generations (funding_source = survey_reward) are never counted as paid purchases or paid premium attach.',
    ],
  };
}

// -----------------------------------------------------------------------------
// Cross-cohort comparison
// -----------------------------------------------------------------------------

export const SHARED_DIMENSIONS = [
  'primary_intent',
  'preferred_output',
  'payment_model_preference',
  'repeat_trigger',
] as const;

export interface ComparisonCohortEntry {
  cohortKey: string;
  surveyId: string;
  version: number;
  questionId: string;
  wording: string;
  optionSetSignature: string;
  submittedN: number;
  shownN: number;
  answeredN: number;
  notApplicableN: number;
  skippedN: number;
  options: OptionResult[];
}

export interface DimensionComparison {
  dimension: string;
  cohorts: ComparisonCohortEntry[];
  /** True only when every cohort exposes exactly the same option ids. Never merged otherwise. */
  optionSetsIdentical: boolean;
  note: string;
}

export function buildDimensionComparison(
  dimension: string,
  entries: ComparisonCohortEntry[],
): DimensionComparison {
  const signatures = new Set(entries.map((e) => e.optionSetSignature));
  const identical = entries.length > 1 && signatures.size === 1;
  return {
    dimension,
    cohorts: entries,
    optionSetsIdentical: identical,
    note:
      entries.length < 2
        ? 'Only one cohort asks this dimension; nothing to compare.'
        : identical
          ? 'Same option set in every cohort; compare rates using each cohort’s own denominator.'
          : 'Option sets or wording differ between cohorts; results are shown side by side and are not merged.',
  };
}

export { optionSetSignature };
export type { DefinitionQuestion };
