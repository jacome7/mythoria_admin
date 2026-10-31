/**
 * Survey / customer-research analytics (read-only).
 *
 * Reads survey tables from `mythoria_db` (synced schema, never written here) and joins backoffice
 * campaign data from `backoffice_db` at application level (cross-database, so no SQL joins).
 * Pure aggregation rules live in `src/lib/surveys/analytics-compute.ts`.
 */
import {
  and,
  desc,
  eq,
  gt,
  gte,
  ilike,
  inArray,
  isNull,
  lte,
  max,
  sql,
  type SQL,
} from 'drizzle-orm';
import { getBackofficeDb, getMythoriaDb } from '@/db';
import { marketingCampaignRecipients, marketingCampaigns } from '@/db/schema/campaigns';
import { paymentOrders } from '@/db/schema/payments';
import { stories } from '@/db/schema/stories';
import { productGenerationRequests } from '@/db/schema/analytics';
import {
  surveyAnswers,
  surveyInvitations,
  surveyResponses,
  surveyRewardEntitlements,
  surveyStudies,
  surveyStudyCohorts,
  surveyTextAnswers,
  surveyVersions,
  surveys,
} from '@/db/schema/surveys';
import type { CsvCell } from '@/lib/csv';
import {
  asDefinition,
  isAnswerableQuestion,
  localize,
  optionSetSignature,
  questionKind,
  type SurveyDefinitionView,
} from '@/lib/surveys/definition';
import {
  PAID_RUN_FUNDING,
  REWARD_RUN_FUNDING,
  SHARED_DIMENSIONS,
  buildDimensionComparison,
  computeBusinessOutcomes,
  computeFunnelRates,
  computeQuestionResults,
  median,
  mean,
  summarizeRewardOps,
  type AnswerRow,
  type ComparisonCohortEntry,
  type FunnelCounts,
  type QuestionResult,
  type ResponseRow,
  type TextAnswerRow,
} from '@/lib/surveys/analytics-compute';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const countAll = sql<number>`(count(*))::int`;
const countWhere = (condition: SQL) => sql<number>`(count(*) filter (where ${condition}))::int`;

const NOT_HOLDOUT = sql`${surveyInvitations.isHoldout} = false`;
const OPENED = sql`${NOT_HOLDOUT} and (${surveyInvitations.openedAt} is not null or ${surveyInvitations.status} in ('opened','started','submitted'))`;
const STARTED = sql`${NOT_HOLDOUT} and (${surveyInvitations.startedAt} is not null or ${surveyInvitations.status} in ('started','submitted'))`;
const COMPLETED = sql`${NOT_HOLDOUT} and ${surveyInvitations.status} = 'submitted'`;

function toNumber(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function validUuids(values: (string | null | undefined)[]): string[] {
  return [...new Set(values.filter((v): v is string => !!v && UUID_RE.test(v)))];
}

// -----------------------------------------------------------------------------
// Shared scope + funnel loading
// -----------------------------------------------------------------------------

export interface SurveyScope {
  surveyVersionId?: string;
  studyId?: string;
  cohortKey?: string;
  /** Filters invitations by `created_at` (audience snapshot date). */
  from?: Date;
  to?: Date;
}

function invitationConditions(scope: SurveyScope): SQL[] {
  const conditions: SQL[] = [];
  if (scope.surveyVersionId) {
    conditions.push(eq(surveyInvitations.surveyVersionId, scope.surveyVersionId));
  }
  if (scope.studyId) conditions.push(eq(surveyInvitations.studyId, scope.studyId));
  if (scope.cohortKey) conditions.push(eq(surveyInvitations.cohortKey, scope.cohortKey));
  if (scope.from) conditions.push(gte(surveyInvitations.createdAt, scope.from));
  if (scope.to) conditions.push(lte(surveyInvitations.createdAt, scope.to));
  return conditions;
}

export interface DeliveryStats {
  /** False when no linked invite campaign exists (send data unavailable). */
  hasInviteCampaign: boolean;
  inviteCampaignIds: string[];
  reminderCampaignIds: string[];
  sent: number;
  failed: number;
  skipped: number;
  queued: number;
  reminderSent: number;
}

async function loadCampaignLinks(scope: SurveyScope) {
  const conditions: SQL[] = [];
  if (scope.surveyVersionId) {
    conditions.push(eq(surveyStudyCohorts.surveyVersionId, scope.surveyVersionId));
  }
  if (scope.studyId) conditions.push(eq(surveyStudyCohorts.studyId, scope.studyId));
  if (scope.cohortKey) conditions.push(eq(surveyStudyCohorts.cohortKey, scope.cohortKey));
  const rows = await getMythoriaDb()
    .select({
      studyId: surveyStudyCohorts.studyId,
      cohortKey: surveyStudyCohorts.cohortKey,
      surveyVersionId: surveyStudyCohorts.surveyVersionId,
      inviteCampaignId: surveyStudyCohorts.inviteCampaignId,
      reminderCampaignId: surveyStudyCohorts.reminderCampaignId,
    })
    .from(surveyStudyCohorts)
    .where(conditions.length ? and(...conditions) : undefined);
  return rows;
}

async function loadRecipientStats(campaignIds: string[]) {
  const byCampaign = new Map<string, Record<string, number>>();
  if (campaignIds.length === 0) return byCampaign;
  const rows = await getBackofficeDb()
    .select({
      campaignId: marketingCampaignRecipients.campaignId,
      status: marketingCampaignRecipients.status,
      count: countAll,
    })
    .from(marketingCampaignRecipients)
    .where(inArray(marketingCampaignRecipients.campaignId, campaignIds))
    .groupBy(marketingCampaignRecipients.campaignId, marketingCampaignRecipients.status);
  for (const row of rows) {
    const entry = byCampaign.get(row.campaignId) ?? {};
    entry[row.status] = toNumber(row.count);
    byCampaign.set(row.campaignId, entry);
  }
  return byCampaign;
}

async function loadDelivery(scope: SurveyScope): Promise<DeliveryStats> {
  const links = await loadCampaignLinks(scope);
  const inviteCampaignIds = validUuids(links.map((l) => l.inviteCampaignId));
  const reminderCampaignIds = validUuids(links.map((l) => l.reminderCampaignId));
  const stats = await loadRecipientStats([...inviteCampaignIds, ...reminderCampaignIds]);
  const sum = (ids: string[], status: string) =>
    ids.reduce((total, id) => total + (stats.get(id)?.[status] ?? 0), 0);
  return {
    hasInviteCampaign: inviteCampaignIds.length > 0,
    inviteCampaignIds,
    reminderCampaignIds,
    sent: sum(inviteCampaignIds, 'sent'),
    failed: sum(inviteCampaignIds, 'failed'),
    skipped: sum(inviteCampaignIds, 'skipped'),
    queued: sum(inviteCampaignIds, 'queued'),
    reminderSent: sum(reminderCampaignIds, 'sent'),
  };
}

async function loadInvitationCounts(scope: SurveyScope) {
  const conditions = invitationConditions(scope);
  const [row] = await getMythoriaDb()
    .select({
      eligible: countAll,
      holdout: countWhere(sql`${surveyInvitations.isHoldout} = true`),
      invited: countWhere(NOT_HOLDOUT),
      opened: countWhere(OPENED),
      started: countWhere(STARTED),
      completed: countWhere(COMPLETED),
      lastResponseAt: max(surveyInvitations.submittedAt),
    })
    .from(surveyInvitations)
    .where(conditions.length ? and(...conditions) : undefined);
  return {
    eligible: toNumber(row?.eligible),
    holdout: toNumber(row?.holdout),
    invited: toNumber(row?.invited),
    opened: toNumber(row?.opened),
    started: toNumber(row?.started),
    completed: toNumber(row?.completed),
    lastResponseAt: row?.lastResponseAt ?? null,
  };
}

export async function loadFunnel(scope: SurveyScope) {
  const [counts, delivery] = await Promise.all([loadInvitationCounts(scope), loadDelivery(scope)]);
  const funnelCounts: FunnelCounts = {
    eligible: counts.eligible,
    holdout: counts.holdout,
    invited: counts.invited,
    sent: delivery.hasInviteCampaign ? delivery.sent : null,
    opened: counts.opened,
    started: counts.started,
    completed: counts.completed,
  };
  return {
    counts: funnelCounts,
    lastResponseAt: counts.lastResponseAt,
    rates: computeFunnelRates(funnelCounts),
    delivery,
    /** Delivery (inbox placement) is not tracked; only provider-accepted sends are known. */
    deliveredTracked: false as const,
    missingData: {
      campaignLinked: delivery.hasInviteCampaign,
      delivered: 'not tracked',
    },
  };
}

// -----------------------------------------------------------------------------
// ADM-001/002 overview
// -----------------------------------------------------------------------------

export interface OverviewFilters {
  surveyId?: string;
  studyId?: string;
  campaignId?: string;
  /** Study status when the row belongs to a study, otherwise survey status. */
  status?: string;
  cohortKey?: string;
  from?: Date;
  to?: Date;
}

export interface OverviewCampaign {
  id: string;
  title: string | null;
  status: string | null;
  role: 'invite' | 'reminder';
}

export interface SurveyOverviewRow {
  key: string;
  surveyId: string;
  surveyTitle: string;
  surveyStatus: string;
  surveyVersionId: string;
  version: number;
  publishedAt: Date;
  studyId: string | null;
  studyKey: string | null;
  studyTitle: string | null;
  studyStatus: string | null;
  cohortKey: string | null;
  campaigns: OverviewCampaign[];
  eligible: number;
  holdout: number;
  invited: number;
  opened: number;
  started: number;
  completed: number;
  lastResponseAt: Date | null;
  /** Invitation delivery problems (campaign recipients), kept apart from response metrics. */
  deliveryIssues: { failed: number; skipped: number };
  /** Reward fulfilment failures, kept apart from response metrics. */
  rewardFailures: number;
}

export async function listSurveysOverview(filters: OverviewFilters = {}) {
  const mythoriaDb = getMythoriaDb();

  const surveyRows = await mythoriaDb
    .select({
      surveyId: surveys.surveyId,
      title: surveys.title,
      status: surveys.status,
      internalOnly: surveys.internalOnly,
    })
    .from(surveys)
    .where(filters.surveyId ? eq(surveys.surveyId, filters.surveyId) : undefined);
  const surveyById = new Map(surveyRows.map((s) => [s.surveyId, s]));
  if (surveyRows.length === 0) return { rows: [] as SurveyOverviewRow[], totals: emptyTotals() };

  const [versionRows, cohortRows, invitationAgg, rewardFailureRows] = await Promise.all([
    mythoriaDb
      .select({
        surveyVersionId: surveyVersions.surveyVersionId,
        surveyId: surveyVersions.surveyId,
        version: surveyVersions.version,
        publishedAt: surveyVersions.publishedAt,
      })
      .from(surveyVersions)
      .where(inArray(surveyVersions.surveyId, [...surveyById.keys()]))
      .orderBy(desc(surveyVersions.publishedAt)),
    mythoriaDb
      .select({
        studyId: surveyStudyCohorts.studyId,
        cohortKey: surveyStudyCohorts.cohortKey,
        surveyVersionId: surveyStudyCohorts.surveyVersionId,
        inviteCampaignId: surveyStudyCohorts.inviteCampaignId,
        reminderCampaignId: surveyStudyCohorts.reminderCampaignId,
        studyKey: surveyStudies.studyKey,
        studyTitle: surveyStudies.title,
        studyStatus: surveyStudies.status,
      })
      .from(surveyStudyCohorts)
      .innerJoin(surveyStudies, eq(surveyStudies.studyId, surveyStudyCohorts.studyId))
      .where(
        and(
          filters.studyId ? eq(surveyStudyCohorts.studyId, filters.studyId) : undefined,
          filters.cohortKey ? eq(surveyStudyCohorts.cohortKey, filters.cohortKey) : undefined,
        ),
      ),
    mythoriaDb
      .select({
        studyId: surveyInvitations.studyId,
        cohortKey: surveyInvitations.cohortKey,
        surveyVersionId: surveyInvitations.surveyVersionId,
        eligible: countAll,
        holdout: countWhere(sql`${surveyInvitations.isHoldout} = true`),
        invited: countWhere(NOT_HOLDOUT),
        opened: countWhere(OPENED),
        started: countWhere(STARTED),
        completed: countWhere(COMPLETED),
        lastResponseAt: max(surveyInvitations.submittedAt),
      })
      .from(surveyInvitations)
      .where(
        and(
          filters.from ? gte(surveyInvitations.createdAt, filters.from) : undefined,
          filters.to ? lte(surveyInvitations.createdAt, filters.to) : undefined,
        ),
      )
      .groupBy(
        surveyInvitations.studyId,
        surveyInvitations.cohortKey,
        surveyInvitations.surveyVersionId,
      ),
    mythoriaDb
      .select({
        studyId: surveyInvitations.studyId,
        cohortKey: surveyInvitations.cohortKey,
        count: countAll,
      })
      .from(surveyRewardEntitlements)
      .innerJoin(
        surveyInvitations,
        eq(surveyInvitations.invitationId, surveyRewardEntitlements.invitationId),
      )
      .where(eq(surveyRewardEntitlements.status, 'failed'))
      .groupBy(surveyInvitations.studyId, surveyInvitations.cohortKey),
  ]);

  const campaignIds = validUuids(
    cohortRows.flatMap((c) => [c.inviteCampaignId, c.reminderCampaignId]),
  );
  const backoffice = getBackofficeDb();
  const [campaignRows, recipientStats] = await Promise.all([
    campaignIds.length
      ? backoffice
          .select({
            id: marketingCampaigns.id,
            title: marketingCampaigns.title,
            status: marketingCampaigns.status,
          })
          .from(marketingCampaigns)
          .where(inArray(marketingCampaigns.id, campaignIds))
      : Promise.resolve([]),
    loadRecipientStats(campaignIds),
  ]);
  const campaignById = new Map(campaignRows.map((c) => [c.id, c]));

  const aggByKey = new Map(
    invitationAgg.map((a) => [`${a.surveyVersionId}|${a.studyId}|${a.cohortKey}`, a]),
  );
  const rewardFailuresByKey = new Map(
    rewardFailureRows.map((r) => [`${r.studyId}|${r.cohortKey}`, toNumber(r.count)]),
  );
  const dateFiltered = Boolean(filters.from || filters.to);

  const rows: SurveyOverviewRow[] = [];
  for (const version of versionRows) {
    const survey = surveyById.get(version.surveyId);
    if (!survey) continue;
    const linked = cohortRows.filter((c) => c.surveyVersionId === version.surveyVersionId);
    const base = {
      surveyId: survey.surveyId,
      surveyTitle: survey.title,
      surveyStatus: survey.status,
      surveyVersionId: version.surveyVersionId,
      version: version.version,
      publishedAt: version.publishedAt,
    };
    if (linked.length === 0) {
      if (filters.studyId || filters.cohortKey || filters.campaignId || dateFiltered) continue;
      rows.push({
        ...base,
        key: `${version.surveyVersionId}|none`,
        studyId: null,
        studyKey: null,
        studyTitle: null,
        studyStatus: null,
        cohortKey: null,
        campaigns: [],
        eligible: 0,
        holdout: 0,
        invited: 0,
        opened: 0,
        started: 0,
        completed: 0,
        lastResponseAt: null,
        deliveryIssues: { failed: 0, skipped: 0 },
        rewardFailures: 0,
      });
      continue;
    }
    for (const cohort of linked) {
      const agg = aggByKey.get(`${version.surveyVersionId}|${cohort.studyId}|${cohort.cohortKey}`);
      if (dateFiltered && !agg) continue;
      const campaigns: OverviewCampaign[] = [];
      let failed = 0;
      let skipped = 0;
      for (const [id, role] of [
        [cohort.inviteCampaignId, 'invite'],
        [cohort.reminderCampaignId, 'reminder'],
      ] as const) {
        if (!id) continue;
        const campaign = campaignById.get(id);
        campaigns.push({
          id,
          title: campaign?.title ?? null,
          status: campaign?.status ?? null,
          role,
        });
        const stats = recipientStats.get(id);
        failed += stats?.failed ?? 0;
        skipped += stats?.skipped ?? 0;
      }
      rows.push({
        ...base,
        key: `${version.surveyVersionId}|${cohort.studyId}|${cohort.cohortKey}`,
        studyId: cohort.studyId,
        studyKey: cohort.studyKey,
        studyTitle: cohort.studyTitle,
        studyStatus: cohort.studyStatus,
        cohortKey: cohort.cohortKey,
        campaigns,
        eligible: toNumber(agg?.eligible),
        holdout: toNumber(agg?.holdout),
        invited: toNumber(agg?.invited),
        opened: toNumber(agg?.opened),
        started: toNumber(agg?.started),
        completed: toNumber(agg?.completed),
        lastResponseAt: agg?.lastResponseAt ?? null,
        deliveryIssues: { failed, skipped },
        rewardFailures: rewardFailuresByKey.get(`${cohort.studyId}|${cohort.cohortKey}`) ?? 0,
      });
    }
  }

  const filtered = rows.filter((row) => {
    if (filters.status && (row.studyStatus ?? row.surveyStatus) !== filters.status) return false;
    if (filters.campaignId && !row.campaigns.some((c) => c.id === filters.campaignId)) return false;
    return true;
  });

  return { rows: filtered, totals: summarizeOverview(filtered) };
}

function emptyTotals() {
  return {
    surveys: 0,
    versions: 0,
    invited: 0,
    started: 0,
    completed: 0,
    deliveryFailures: 0,
    rewardFailures: 0,
  };
}

export function summarizeOverview(rows: readonly SurveyOverviewRow[]) {
  const totals = emptyTotals();
  totals.surveys = new Set(rows.map((r) => r.surveyId)).size;
  totals.versions = new Set(rows.map((r) => r.surveyVersionId)).size;
  for (const row of rows) {
    totals.invited += row.invited;
    totals.started += row.started;
    totals.completed += row.completed;
    totals.deliveryFailures += row.deliveryIssues.failed;
    totals.rewardFailures += row.rewardFailures;
  }
  return totals;
}

// -----------------------------------------------------------------------------
// ADM-005..009 survey results
// -----------------------------------------------------------------------------

export interface SurveyResultsParams extends SurveyScope {
  surveyVersionId: string;
  locale?: string;
  /** Optional respondent locale filter (cross-filter, ADM-012). */
  respondentLocale?: string;
}

async function loadVersion(surveyVersionId: string) {
  const [row] = await getMythoriaDb()
    .select({
      surveyVersionId: surveyVersions.surveyVersionId,
      surveyId: surveyVersions.surveyId,
      version: surveyVersions.version,
      schemaVersion: surveyVersions.schemaVersion,
      definition: surveyVersions.definition,
      definitionHash: surveyVersions.definitionHash,
      publishedAt: surveyVersions.publishedAt,
      surveyTitle: surveys.title,
      surveyStatus: surveys.status,
      purpose: surveys.purpose,
    })
    .from(surveyVersions)
    .innerJoin(surveys, eq(surveys.surveyId, surveyVersions.surveyId))
    .where(eq(surveyVersions.surveyVersionId, surveyVersionId))
    .limit(1);
  return row ?? null;
}

function responseConditions(params: SurveyResultsParams): SQL[] {
  const conditions = [
    eq(surveyResponses.surveyVersionId, params.surveyVersionId),
    eq(surveyResponses.status, 'submitted'),
    ...invitationConditions({ ...params, surveyVersionId: undefined }),
  ];
  if (params.respondentLocale) conditions.push(eq(surveyResponses.locale, params.respondentLocale));
  return conditions;
}

interface LoadedResponses {
  responses: ResponseRow[];
  answers: AnswerRow[];
  textAnswers: TextAnswerRow[];
}

async function loadSubmittedData(params: SurveyResultsParams): Promise<LoadedResponses> {
  const db = getMythoriaDb();
  const where = and(...responseConditions(params));
  const [responseRows, answerRows, textRows] = await Promise.all([
    db
      .select({
        responseId: surveyResponses.responseId,
        shownQuestionIds: surveyResponses.shownQuestionIds,
        cohortKey: surveyInvitations.cohortKey,
        locale: surveyResponses.locale,
        durationMs: surveyResponses.durationMs,
      })
      .from(surveyResponses)
      .innerJoin(
        surveyInvitations,
        eq(surveyInvitations.invitationId, surveyResponses.invitationId),
      )
      .where(where),
    db
      .select({
        responseId: surveyAnswers.responseId,
        questionId: surveyAnswers.questionId,
        optionId: surveyAnswers.optionId,
        valueNumeric: surveyAnswers.valueNumeric,
        isNotApplicable: surveyAnswers.isNotApplicable,
        isSkipped: surveyAnswers.isSkipped,
        hasOtherText: surveyAnswers.hasOtherText,
      })
      .from(surveyAnswers)
      .innerJoin(surveyResponses, eq(surveyResponses.responseId, surveyAnswers.responseId))
      .innerJoin(
        surveyInvitations,
        eq(surveyInvitations.invitationId, surveyResponses.invitationId),
      )
      .where(where),
    // Text is intentionally NOT selected here: only presence is needed for denominators.
    db
      .select({
        responseId: surveyTextAnswers.responseId,
        questionId: surveyTextAnswers.questionId,
        kind: surveyTextAnswers.kind,
        optionId: surveyTextAnswers.optionId,
      })
      .from(surveyTextAnswers)
      .innerJoin(surveyResponses, eq(surveyResponses.responseId, surveyTextAnswers.responseId))
      .innerJoin(
        surveyInvitations,
        eq(surveyInvitations.invitationId, surveyResponses.invitationId),
      )
      .where(where),
  ]);
  return {
    responses: responseRows,
    answers: answerRows,
    textAnswers: textRows,
  };
}

export async function loadQuestionResults(
  params: SurveyResultsParams,
  definition: SurveyDefinitionView,
) {
  const data = await loadSubmittedData(params);
  const questions = computeQuestionResults({
    definition,
    locale: params.locale,
    responses: data.responses,
    answers: data.answers,
    textAnswers: data.textAnswers,
  });
  return { questions, responses: data.responses };
}

export async function getSurveyResults(params: SurveyResultsParams) {
  const version = await loadVersion(params.surveyVersionId);
  if (!version) return null;
  const definition = asDefinition(version.definition);
  const scope: SurveyScope = {
    surveyVersionId: params.surveyVersionId,
    studyId: params.studyId,
    cohortKey: params.cohortKey,
    from: params.from,
    to: params.to,
  };
  const [funnel, loaded, studyRows] = await Promise.all([
    loadFunnel(scope),
    loadQuestionResults(params, definition),
    getMythoriaDb()
      .select({
        studyId: surveyStudyCohorts.studyId,
        cohortKey: surveyStudyCohorts.cohortKey,
        studyTitle: surveyStudies.title,
      })
      .from(surveyStudyCohorts)
      .innerJoin(surveyStudies, eq(surveyStudies.studyId, surveyStudyCohorts.studyId))
      .where(eq(surveyStudyCohorts.surveyVersionId, params.surveyVersionId)),
  ]);

  const durations = loaded.responses
    .map((r) => r.durationMs)
    .filter((d): d is number => typeof d === 'number' && d >= 0);
  const submittedN = loaded.responses.length;

  return {
    version: {
      surveyVersionId: version.surveyVersionId,
      surveyId: version.surveyId,
      surveyTitle: version.surveyTitle,
      surveyStatus: version.surveyStatus,
      purpose: version.purpose,
      version: version.version,
      schemaVersion: version.schemaVersion,
      definitionHash: version.definitionHash,
      publishedAt: version.publishedAt,
    },
    filters: {
      studyId: params.studyId ?? null,
      cohortKey: params.cohortKey ?? null,
      from: params.from ?? null,
      to: params.to ?? null,
      respondentLocale: params.respondentLocale ?? null,
    },
    scopes: studyRows,
    funnel,
    sampleSize: {
      submittedN,
      note: 'Survey respondents are a self-selected sample; do not generalize to the whole user base.',
    },
    duration: {
      measuredN: durations.length,
      medianMs: median(durations),
      meanMs: mean(durations),
      note: durations.length === 0 ? 'Completion duration not measured' : null,
    },
    questions: loaded.questions,
    definition,
  };
}

// -----------------------------------------------------------------------------
// ADM-010 free text (requires survey:analyze at the API layer)
// -----------------------------------------------------------------------------

export interface OpenTextParams {
  surveyVersionId: string;
  questionId?: string;
  cohortKey?: string;
  studyId?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`);
}

export async function getOpenTextAnswers(params: OpenTextParams) {
  const version = await loadVersion(params.surveyVersionId);
  if (!version) return null;
  const definition = asDefinition(version.definition);
  const pageSize = Math.min(Math.max(params.pageSize ?? 25, 1), 100);
  const page = Math.max(params.page ?? 1, 1);
  const conditions: SQL[] = [
    eq(surveyTextAnswers.surveyVersionId, params.surveyVersionId),
    isNull(surveyTextAnswers.redactedAt),
  ];
  if (params.questionId) conditions.push(eq(surveyTextAnswers.questionId, params.questionId));
  if (params.cohortKey) conditions.push(eq(surveyInvitations.cohortKey, params.cohortKey));
  if (params.studyId) conditions.push(eq(surveyInvitations.studyId, params.studyId));
  const search = params.search?.trim();
  if (search) conditions.push(ilike(surveyTextAnswers.textValue, `%${escapeLike(search)}%`));
  const where = and(...conditions);
  const db = getMythoriaDb();

  const [items, [totalRow]] = await Promise.all([
    db
      .select({
        textAnswerId: surveyTextAnswers.textAnswerId,
        responseId: surveyTextAnswers.responseId,
        questionId: surveyTextAnswers.questionId,
        kind: surveyTextAnswers.kind,
        optionId: surveyTextAnswers.optionId,
        text: surveyTextAnswers.textValue,
        cohortKey: surveyInvitations.cohortKey,
        locale: surveyResponses.locale,
        createdAt: surveyTextAnswers.createdAt,
      })
      .from(surveyTextAnswers)
      .innerJoin(surveyResponses, eq(surveyResponses.responseId, surveyTextAnswers.responseId))
      .innerJoin(
        surveyInvitations,
        eq(surveyInvitations.invitationId, surveyResponses.invitationId),
      )
      .where(where)
      .orderBy(desc(surveyTextAnswers.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db
      .select({ total: countAll })
      .from(surveyTextAnswers)
      .innerJoin(surveyResponses, eq(surveyResponses.responseId, surveyTextAnswers.responseId))
      .innerJoin(
        surveyInvitations,
        eq(surveyInvitations.invitationId, surveyResponses.invitationId),
      )
      .where(where),
  ]);

  const labelById = new Map(definition.questions.map((q) => [q.id, localize(q.label)]));
  const textQuestions = definition.questions
    .filter(
      (q) =>
        questionKind(q) === 'text' || (q.options ?? []).some((option) => option.allowOtherText),
    )
    .map((q) => ({ questionId: q.id, label: localize(q.label) }));

  return {
    items: items.map((item) => ({
      ...item,
      questionLabel: labelById.get(item.questionId) ?? null,
    })),
    total: toNumber(totalRow?.total),
    page,
    pageSize,
    questions: textQuestions,
  };
}

// -----------------------------------------------------------------------------
// ADM-014 reward operations
// -----------------------------------------------------------------------------

export async function getRewardOps(studyId: string) {
  const db = getMythoriaDb();
  const [groups, failures] = await Promise.all([
    db
      .select({
        cohortKey: surveyInvitations.cohortKey,
        status: surveyRewardEntitlements.status,
        rewardType: surveyRewardEntitlements.rewardType,
        count: countAll,
      })
      .from(surveyRewardEntitlements)
      .innerJoin(
        surveyInvitations,
        eq(surveyInvitations.invitationId, surveyRewardEntitlements.invitationId),
      )
      .where(eq(surveyInvitations.studyId, studyId))
      .groupBy(
        surveyInvitations.cohortKey,
        surveyRewardEntitlements.status,
        surveyRewardEntitlements.rewardType,
      ),
    db
      .select({
        entitlementId: surveyRewardEntitlements.entitlementId,
        cohortKey: surveyInvitations.cohortKey,
        rewardType: surveyRewardEntitlements.rewardType,
        lastError: surveyRewardEntitlements.lastError,
        attempts: surveyRewardEntitlements.attempts,
        failedAt: surveyRewardEntitlements.failedAt,
      })
      .from(surveyRewardEntitlements)
      .innerJoin(
        surveyInvitations,
        eq(surveyInvitations.invitationId, surveyRewardEntitlements.invitationId),
      )
      .where(
        and(eq(surveyInvitations.studyId, studyId), eq(surveyRewardEntitlements.status, 'failed')),
      )
      .orderBy(desc(surveyRewardEntitlements.failedAt))
      .limit(25),
  ]);

  return {
    studyId,
    summary: summarizeRewardOps(
      groups.map((g) => ({
        cohortKey: g.cohortKey,
        status: g.status,
        rewardType: g.rewardType,
        count: toNumber(g.count),
      })),
    ),
    failures,
    productionCost: {
      available: false as const,
      reason: 'Per-reward production cost is not tracked.',
    },
  };
}

// -----------------------------------------------------------------------------
// ADM-013 business outcomes
// -----------------------------------------------------------------------------

export interface BusinessOutcomeParams {
  studyId: string;
  windowDays: 7 | 30;
  now?: Date;
}

export async function getBusinessOutcomes(params: BusinessOutcomeParams) {
  const db = getMythoriaDb();
  const studyAuthors = db
    .select({ authorId: surveyInvitations.authorId })
    .from(surveyInvitations)
    .where(eq(surveyInvitations.studyId, params.studyId));

  const [invitationRows, orderRows, storyRows, runRows] = await Promise.all([
    db
      .select({
        authorId: surveyInvitations.authorId,
        cohortKey: surveyInvitations.cohortKey,
        isHoldout: surveyInvitations.isHoldout,
        status: surveyInvitations.status,
        createdAt: surveyInvitations.createdAt,
        submittedAt: surveyInvitations.submittedAt,
        cohortSnapshot: surveyInvitations.cohortSnapshot,
      })
      .from(surveyInvitations)
      .where(eq(surveyInvitations.studyId, params.studyId)),
    // First paid purchase = completed order with amount > 0 (vouchers/free credits never count).
    db
      .select({
        authorId: paymentOrders.authorId,
        at: sql<Date>`coalesce(${paymentOrders.completedAt}, ${paymentOrders.createdAt})`,
      })
      .from(paymentOrders)
      .where(
        and(
          eq(paymentOrders.status, 'completed'),
          gt(paymentOrders.amount, 0),
          inArray(paymentOrders.authorId, studyAuthors),
        ),
      ),
    db
      .select({
        authorId: stories.authorId,
        at: sql<Date>`coalesce(${stories.publishedAt}, ${stories.createdAt})`,
      })
      .from(stories)
      .where(and(eq(stories.status, 'published'), inArray(stories.authorId, studyAuthors))),
    db
      .select({
        authorId: productGenerationRequests.authorId,
        at: productGenerationRequests.createdAt,
        fundingSource: productGenerationRequests.fundingSource,
      })
      .from(productGenerationRequests)
      .where(
        and(
          eq(productGenerationRequests.status, 'completed'),
          inArray(productGenerationRequests.fundingSource, [PAID_RUN_FUNDING, REWARD_RUN_FUNDING]),
          inArray(productGenerationRequests.authorId, studyAuthors),
        ),
      ),
  ]);

  const outcomes = computeBusinessOutcomes({
    windowDays: params.windowDays,
    now: params.now ?? new Date(),
    invitations: invitationRows.map((row) => ({
      authorId: row.authorId,
      cohortKey: row.cohortKey,
      isHoldout: row.isHoldout,
      status: row.status,
      createdAt: new Date(row.createdAt),
      submittedAt: row.submittedAt ? new Date(row.submittedAt) : null,
      hadPaidPurchaseAtSnapshot: row.cohortSnapshot?.hasPaidPurchase === true,
    })),
    paidOrders: orderRows.map((row) => ({ authorId: row.authorId, at: new Date(row.at) })),
    publishedStories: storyRows.map((row) => ({ authorId: row.authorId, at: new Date(row.at) })),
    productRuns: runRows.map((row) => ({
      authorId: row.authorId,
      at: new Date(row.at),
      fundingSource: row.fundingSource,
    })),
  });
  return { studyId: params.studyId, ...outcomes };
}

// -----------------------------------------------------------------------------
// Study overview + cross-cohort comparison
// -----------------------------------------------------------------------------

async function loadStudyCohorts(studyId: string) {
  return getMythoriaDb()
    .select({
      studyId: surveyStudyCohorts.studyId,
      cohortKey: surveyStudyCohorts.cohortKey,
      surveyVersionId: surveyStudyCohorts.surveyVersionId,
      surveyId: surveyVersions.surveyId,
      version: surveyVersions.version,
      definition: surveyVersions.definition,
      surveyTitle: surveys.title,
    })
    .from(surveyStudyCohorts)
    .innerJoin(
      surveyVersions,
      eq(surveyVersions.surveyVersionId, surveyStudyCohorts.surveyVersionId),
    )
    .innerJoin(surveys, eq(surveys.surveyId, surveyVersions.surveyId))
    .where(eq(surveyStudyCohorts.studyId, studyId))
    .orderBy(surveyStudyCohorts.cohortKey);
}

export async function getStudyOverview(studyId: string) {
  const [studyRows, cohorts] = await Promise.all([
    getMythoriaDb()
      .select({
        studyId: surveyStudies.studyId,
        studyKey: surveyStudies.studyKey,
        title: surveyStudies.title,
        status: surveyStudies.status,
        opensAt: surveyStudies.opensAt,
        closesAt: surveyStudies.closesAt,
        holdoutPercent: surveyStudies.holdoutPercent,
        snapshotAt: surveyStudies.snapshotAt,
      })
      .from(surveyStudies)
      .where(eq(surveyStudies.studyId, studyId))
      .limit(1),
    loadStudyCohorts(studyId),
  ]);
  const study = studyRows[0];
  if (!study) return null;
  const cohortOverviews = await Promise.all(
    cohorts.map(async (cohort) => {
      const funnel = await loadFunnel({
        studyId,
        cohortKey: cohort.cohortKey,
        surveyVersionId: cohort.surveyVersionId,
      });
      return {
        cohortKey: cohort.cohortKey,
        surveyVersionId: cohort.surveyVersionId,
        surveyId: cohort.surveyId,
        surveyTitle: cohort.surveyTitle,
        version: cohort.version,
        funnel,
      };
    }),
  );
  return { study, cohorts: cohortOverviews };
}

export async function getCrossCohortComparison(studyId: string, locale = 'en-US') {
  const cohorts = await loadStudyCohorts(studyId);
  const perCohort = await Promise.all(
    cohorts.map(async (cohort) => {
      const definition = asDefinition(cohort.definition);
      const loaded = await loadQuestionResults(
        { surveyVersionId: cohort.surveyVersionId, studyId, cohortKey: cohort.cohortKey, locale },
        definition,
      );
      return { cohort, definition, results: loaded.questions, submittedN: loaded.responses.length };
    }),
  );

  const dimensions = SHARED_DIMENSIONS.map((dimension) => {
    const entries: ComparisonCohortEntry[] = [];
    for (const { cohort, definition, results, submittedN } of perCohort) {
      for (const result of results.filter((r: QuestionResult) => r.dimension === dimension)) {
        const question = definition.questions.find((q) => q.id === result.questionId);
        if (!question || !isAnswerableQuestion(question)) continue;
        entries.push({
          cohortKey: cohort.cohortKey,
          surveyId: cohort.surveyId,
          version: cohort.version,
          questionId: result.questionId,
          wording: result.label,
          optionSetSignature: optionSetSignature(question),
          submittedN,
          shownN: result.shownN,
          answeredN: result.answeredN,
          notApplicableN: result.notApplicableN,
          skippedN: result.skippedN,
          options: result.options,
        });
      }
    }
    return buildDimensionComparison(dimension, entries);
  }).filter((d) => d.cohorts.length > 0);

  return {
    studyId,
    cohorts: perCohort.map(({ cohort, submittedN }) => ({
      cohortKey: cohort.cohortKey,
      surveyId: cohort.surveyId,
      version: cohort.version,
      submittedN,
    })),
    excludedDimensions: ['open_improvement'],
    dimensions,
    caveat:
      'Cohorts answer different surveys with their own wording and option sets. Rates use each question’s own valid denominator and are never merged across cohorts.',
  };
}

// -----------------------------------------------------------------------------
// ADM-011 CSV export
// -----------------------------------------------------------------------------

export const EXPORT_HEADER = [
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
] as const;

export interface ExportParams extends SurveyScope {
  surveyVersionId: string;
  /** Adds `text_kind` + `text_value` columns. Callers must hold survey:analyze. */
  includeText?: boolean;
}

export async function exportResponsesCsv(params: ExportParams) {
  const version = await loadVersion(params.surveyVersionId);
  if (!version) return null;
  const definition = asDefinition(version.definition);
  const dimensionByQuestion = new Map(
    definition.questions.map((q) => [q.id, q.dimension ?? ''] as const),
  );
  const resultParams: SurveyResultsParams = { ...params };
  const db = getMythoriaDb();
  const where = and(...responseConditions(resultParams));

  const [answerRows, textRows] = await Promise.all([
    db
      .select({
        responseId: surveyAnswers.responseId,
        questionId: surveyAnswers.questionId,
        dimension: surveyAnswers.dimension,
        optionId: surveyAnswers.optionId,
        valueNumeric: surveyAnswers.valueNumeric,
        isNotApplicable: surveyAnswers.isNotApplicable,
        isSkipped: surveyAnswers.isSkipped,
        cohortKey: surveyInvitations.cohortKey,
        locale: surveyResponses.locale,
        submittedAt: surveyResponses.submittedAt,
      })
      .from(surveyAnswers)
      .innerJoin(surveyResponses, eq(surveyResponses.responseId, surveyAnswers.responseId))
      .innerJoin(
        surveyInvitations,
        eq(surveyInvitations.invitationId, surveyResponses.invitationId),
      )
      .where(where)
      .orderBy(surveyResponses.submittedAt, surveyAnswers.responseId, surveyAnswers.questionId),
    params.includeText
      ? db
          .select({
            responseId: surveyTextAnswers.responseId,
            questionId: surveyTextAnswers.questionId,
            kind: surveyTextAnswers.kind,
            optionId: surveyTextAnswers.optionId,
            text: surveyTextAnswers.textValue,
            cohortKey: surveyInvitations.cohortKey,
            locale: surveyResponses.locale,
            submittedAt: surveyResponses.submittedAt,
          })
          .from(surveyTextAnswers)
          .innerJoin(surveyResponses, eq(surveyResponses.responseId, surveyTextAnswers.responseId))
          .innerJoin(
            surveyInvitations,
            eq(surveyInvitations.invitationId, surveyResponses.invitationId),
          )
          .where(and(where, isNull(surveyTextAnswers.redactedAt)))
          .orderBy(surveyResponses.submittedAt, surveyTextAnswers.responseId)
      : Promise.resolve([]),
  ]);

  return buildExport({
    surveyId: version.surveyId,
    version: version.version,
    includeText: params.includeText === true,
    dimensionByQuestion,
    answerRows,
    textRows,
  });
}

export function buildExport(input: {
  surveyId: string;
  version: number;
  includeText: boolean;
  dimensionByQuestion: Map<string, string>;
  answerRows: {
    responseId: string;
    questionId: string;
    dimension: string;
    optionId: string | null;
    valueNumeric: number | null;
    isNotApplicable: boolean;
    isSkipped: boolean;
    cohortKey: string;
    locale: string;
    submittedAt: Date | null;
  }[];
  textRows: {
    responseId: string;
    questionId: string;
    kind: string;
    optionId: string | null;
    text: string;
    cohortKey: string;
    locale: string;
    submittedAt: Date | null;
  }[];
}) {
  const header: string[] = [
    ...EXPORT_HEADER,
    ...(input.includeText ? ['text_kind', 'text_value'] : []),
  ];
  const rows: CsvCell[][] = [];
  for (const row of input.answerRows) {
    const cells: CsvCell[] = [
      row.responseId,
      input.surveyId,
      input.version,
      row.cohortKey,
      row.locale,
      row.submittedAt,
      row.questionId,
      row.dimension,
      row.optionId,
      row.valueNumeric,
      row.isNotApplicable,
      row.isSkipped,
    ];
    if (input.includeText) cells.push('', '');
    rows.push(cells);
  }
  if (input.includeText) {
    for (const row of input.textRows) {
      rows.push([
        row.responseId,
        input.surveyId,
        input.version,
        row.cohortKey,
        row.locale,
        row.submittedAt,
        row.questionId,
        input.dimensionByQuestion.get(row.questionId) ?? '',
        row.optionId,
        null,
        false,
        false,
        row.kind,
        row.text,
      ]);
    }
  }
  return { header, rows, rowCount: rows.length };
}
