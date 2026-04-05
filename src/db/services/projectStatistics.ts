import {
  normalizeRegistrationAggregation,
  type AnalyticsAggregationRange,
  type RegistrationAggregation,
  type RegistrationRange,
} from '@/lib/analytics/registrations';
import { normalizeRevenueAggregation } from '@/lib/analytics/revenue';
import { normalizeServiceUsageAggregation } from '@/lib/analytics/service-usage';
import {
  mergeProjectStatisticsDailySeries,
  type ProjectStatisticsDailyBucket,
} from '@/lib/analytics/projectStatisticsMerge';
import { resolveStatisticsWindow, StatisticsWindowError } from '@/lib/analytics/statisticsWindow';
import type { ActionUsage, ModelUsage } from '@/db/services/workflowTokenUsage';
import { getTokenUsageStatsForWindow } from '@/db/services/workflowTokenUsage';

export interface ProjectStatisticsParams {
  range?: RegistrationRange | null;
  startDate?: string | null;
  endDate?: string | null;
  includeDaily?: boolean;
  includeAiBreakdowns?: boolean;
}

export type LegacyProjectStatistics = {
  users: number;
  stories: number;
  openTickets: number;
};

export type { ProjectStatisticsDailyBucket } from '@/lib/analytics/projectStatisticsMerge';

export type ExtendedProjectStatistics = LegacyProjectStatistics & {
  generatedAt: string;
  range: RegistrationRange | 'custom';
  startDate: string;
  endDate: string;
  granularity: 'day' | 'month';
  summary: {
    newRegistrations: number;
    revenue: number;
    transactions: number;
    creditsConsumed: number;
    creditsGranted: number;
    aiCostEUR: number;
    aiTokens: number;
    aiRequests: number;
    newStories: number;
    newTickets: number;
    totalServiceActions: number;
  };
  daily?: ProjectStatisticsDailyBucket[];
  warnings: string[];
  modelBreakdown?: ModelUsage[];
  actionBreakdown?: ActionUsage[];
};

export type ProjectStatisticsResult = LegacyProjectStatistics | ExtendedProjectStatistics;

export function isExtendedProjectStatistics(
  r: ProjectStatisticsResult,
): r is ExtendedProjectStatistics {
  return 'generatedAt' in r && r.generatedAt !== undefined;
}

function asRegistrationAggregation(
  range: AnalyticsAggregationRange,
  granularity: 'day' | 'month',
  startDate: string,
  endDate: string,
  buckets: { bucketStart: string; count: number }[],
): RegistrationAggregation {
  return {
    range,
    granularity,
    startDate,
    endDate,
    buckets: buckets.map((b) => ({
      bucketStart: b.bucketStart,
      registrations: b.count,
    })),
  };
}

export async function getProjectStatisticsReport(
  params: ProjectStatisticsParams,
): Promise<ProjectStatisticsResult> {
  const includeDaily = params.includeDaily === true;
  const includeAiBreakdowns = params.includeAiBreakdowns === true;

  const hasRange = params.range != null;
  const hasCustom =
    params.startDate != null &&
    params.startDate !== '' &&
    params.endDate != null &&
    params.endDate !== '';
  const hasWindow = hasRange || hasCustom;

  if (hasRange && hasCustom) {
    throw new StatisticsWindowError('Provide either range or startDate/endDate, not both');
  }

  if (!hasWindow) {
    if (includeDaily || includeAiBreakdowns) {
      throw new StatisticsWindowError(
        'range or startDate/endDate is required when includeDaily or includeAiBreakdowns is true',
      );
    }
    const { adminService } = await import('@/db/services');
    const { TicketService } = await import('@/lib/ticketing/service');
    const [users, stories, ticketMetrics] = await Promise.all([
      adminService.getTotalAuthorsCount(),
      adminService.getTotalStoriesCount(),
      TicketService.getMetrics(),
    ]);
    return {
      users,
      stories,
      openTickets: ticketMetrics.openTickets + ticketMetrics.inProgressTickets,
    };
  }

  const window = resolveStatisticsWindow({
    range: hasRange ? (params.range as RegistrationRange) : undefined,
    startDate: hasCustom ? params.startDate : undefined,
    endDate: hasCustom ? params.endDate : undefined,
  });

  const rangeLabel: AnalyticsAggregationRange = hasCustom
    ? 'custom'
    : (params.range as RegistrationRange);

  const { adminService } = await import('@/db/services');
  const { TicketService } = await import('@/lib/ticketing/service');

  const [users, storiesCount, ticketMetrics] = await Promise.all([
    adminService.getTotalAuthorsCount(),
    adminService.getTotalStoriesCount(),
    TicketService.getMetrics(),
  ]);

  const legacy: LegacyProjectStatistics = {
    users,
    stories: storiesCount,
    openTickets: ticketMetrics.openTickets + ticketMetrics.inProgressTickets,
  };

  const warnings: string[] = [];

  const [regAgg, usageAgg, revAgg, storiesAgg, grantsAgg, ticketsAgg] = await Promise.all([
    adminService.getAuthorRegistrationsForWindow(window, rangeLabel),
    adminService.getServiceUsageForWindow(window, rangeLabel),
    adminService.getRevenueSnapshotForWindow(window, rangeLabel),
    adminService.getStoriesCreatedForWindow(window, rangeLabel),
    adminService.getCreditGrantsForWindow(window, rangeLabel),
    TicketService.getTicketsCreatedForWindow(window, rangeLabel),
  ]);

  let aiResult: Awaited<ReturnType<typeof getTokenUsageStatsForWindow>> | null = null;
  try {
    aiResult = await getTokenUsageStatsForWindow(window, {
      includeBreakdowns: includeAiBreakdowns,
    });
  } catch (e) {
    console.error('[projectStatistics] workflows_db AI usage failed:', e);
    warnings.push('AI usage (workflows_db) could not be loaded for this window.');
  }

  const granularity = window.kind === 'forever' ? 'month' : window.granularity;

  const normReg = normalizeRegistrationAggregation(regAgg);
  const normSu = normalizeServiceUsageAggregation(usageAgg);
  const normRev = normalizeRevenueAggregation(revAgg);
  const normStories = normalizeRegistrationAggregation(
    asRegistrationAggregation(
      rangeLabel,
      granularity,
      storiesAgg.startDate,
      storiesAgg.endDate,
      storiesAgg.buckets.map((b) => ({
        bucketStart: b.bucketStart,
        count: b.storiesCreated,
      })),
    ),
  );
  const normGrants = normalizeRegistrationAggregation(
    asRegistrationAggregation(
      rangeLabel,
      granularity,
      grantsAgg.startDate,
      grantsAgg.endDate,
      grantsAgg.buckets.map((b) => ({
        bucketStart: b.bucketStart,
        count: b.creditsGranted,
      })),
    ),
  );
  const normTickets = normalizeRegistrationAggregation(
    asRegistrationAggregation(
      rangeLabel,
      granularity,
      ticketsAgg.startDate,
      ticketsAgg.endDate,
      ticketsAgg.buckets.map((b) => ({
        bucketStart: b.bucketStart,
        count: b.ticketsCreated,
      })),
    ),
  );

  const aiDaily = aiResult?.dailyUsage ?? [];

  const daily = includeDaily
    ? mergeProjectStatisticsDailySeries(
        granularity,
        normReg,
        normRev,
        normSu,
        normStories,
        normGrants,
        normTickets,
        aiDaily,
      )
    : undefined;

  const sumDaily = (pick: (b: ProjectStatisticsDailyBucket) => number) =>
    daily?.reduce((s, b) => s + pick(b), 0) ?? 0;

  const summary = {
    newRegistrations: includeDaily
      ? sumDaily((b) => b.newRegistrations)
      : normReg.reduce((s, b) => s + b.count, 0),
    revenue: includeDaily ? sumDaily((b) => b.revenue) : normRev.reduce((s, b) => s + b.revenue, 0),
    transactions: includeDaily
      ? sumDaily((b) => b.transactions)
      : normRev.reduce((s, b) => s + b.transactions, 0),
    creditsConsumed: includeDaily
      ? sumDaily((b) => b.totalServiceCredits)
      : normSu.reduce((s, b) => s + b.totalCredits, 0),
    creditsGranted: includeDaily
      ? sumDaily((b) => b.creditsGranted)
      : normGrants.reduce((s, b) => s + b.count, 0),
    aiCostEUR: aiResult?.totalCost ?? 0,
    aiTokens: aiResult?.totalTokens ?? 0,
    aiRequests: aiResult?.totalRequests ?? 0,
    newStories: includeDaily
      ? sumDaily((b) => b.newStories)
      : normStories.reduce((s, b) => s + b.count, 0),
    newTickets: includeDaily
      ? sumDaily((b) => b.newTickets)
      : normTickets.reduce((s, b) => s + b.count, 0),
    totalServiceActions: includeDaily
      ? sumDaily((b) => b.totalServiceActions)
      : normSu.reduce((s, b) => s + b.totalActions, 0),
  };

  const extended: ExtendedProjectStatistics = {
    ...legacy,
    generatedAt: new Date().toISOString(),
    range: rangeLabel,
    startDate: window.kind === 'bounded' ? window.start.toISOString() : regAgg.startDate,
    endDate: window.kind === 'bounded' ? window.end.toISOString() : regAgg.endDate,
    granularity,
    summary,
    daily,
    warnings,
  };

  if (includeAiBreakdowns && aiResult) {
    extended.modelBreakdown = aiResult.modelBreakdown;
    extended.actionBreakdown = aiResult.actionBreakdown;
  }

  return extended;
}
