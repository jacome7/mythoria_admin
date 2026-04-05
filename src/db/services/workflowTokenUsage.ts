import { getWorkflowsDb } from '@/db';
import { tokenUsageTracking } from '@/db/schema/workflows/token-usage';
import { and, gte, lte, sql, desc } from 'drizzle-orm';
import {
  endOfUtcDayInclusive,
  type ResolvedStatisticsWindow,
} from '@/lib/analytics/statisticsWindow';

export interface ModelUsage {
  model: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  totalCost: number;
  requests: number;
  averageCostPerRequest: number;
}

export interface ActionUsage {
  action: string;
  totalCost: number;
  requests: number;
  inputTokens: number;
  outputTokens: number;
  uniqueStories: number;
  averageCostPerRequest: number;
  averageCostPerStory: number;
}

export interface DailyUsage {
  date: string;
  totalCost: number;
  requests: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export interface TokenUsageStatsResult {
  totalCost: number;
  totalTokens: number;
  totalRequests: number;
  averageCostPerRequest: number;
  modelBreakdown: ModelUsage[];
  actionBreakdown: ActionUsage[];
  dailyUsage: DailyUsage[];
  topModels: ModelUsage[];
  granularity: 'day' | 'month';
}

function whereForWindow(window: ResolvedStatisticsWindow) {
  if (window.kind === 'forever') {
    return undefined;
  }
  const endBound = endOfUtcDayInclusive(window.end);
  return and(
    gte(tokenUsageTracking.createdAt, window.start.toISOString()),
    lte(tokenUsageTracking.createdAt, endBound.toISOString()),
  );
}

/**
 * AI token usage and cost aggregates for a resolved statistics window (matches `/api/ai-usage/stats` logic).
 */
export async function getTokenUsageStatsForWindow(
  window: ResolvedStatisticsWindow,
  options: { includeBreakdowns: boolean },
): Promise<TokenUsageStatsResult> {
  const db = getWorkflowsDb();
  const whereCondition = whereForWindow(window);
  const isForever = window.kind === 'forever';

  const [overallStats] = await db
    .select({
      totalCost: sql<number>`COALESCE(SUM(CAST(${tokenUsageTracking.estimatedCostInEuros} AS DECIMAL)), 0)`,
      totalInputTokens: sql<number>`COALESCE(SUM(${tokenUsageTracking.inputTokens}), 0)`,
      totalOutputTokens: sql<number>`COALESCE(SUM(${tokenUsageTracking.outputTokens}), 0)`,
      totalRequests: sql<number>`COUNT(*)`,
    })
    .from(tokenUsageTracking)
    .where(whereCondition);

  const totalTokens =
    (Number(overallStats.totalInputTokens) || 0) + (Number(overallStats.totalOutputTokens) || 0);
  const totalCost = Number(overallStats.totalCost) || 0;
  const totalRequests = Number(overallStats.totalRequests) || 0;
  const averageCostPerRequest = totalRequests > 0 ? totalCost / totalRequests : 0;

  let enhancedModelBreakdown: ModelUsage[] = [];
  let enhancedActionBreakdown: ActionUsage[] = [];

  if (options.includeBreakdowns) {
    const modelBreakdown = await db
      .select({
        model: tokenUsageTracking.aiModel,
        inputTokens: sql<number>`SUM(${tokenUsageTracking.inputTokens})`,
        outputTokens: sql<number>`SUM(${tokenUsageTracking.outputTokens})`,
        totalCost: sql<number>`SUM(CAST(${tokenUsageTracking.estimatedCostInEuros} AS DECIMAL))`,
        requests: sql<number>`COUNT(*)`,
      })
      .from(tokenUsageTracking)
      .where(whereCondition)
      .groupBy(tokenUsageTracking.aiModel)
      .orderBy(desc(sql`SUM(CAST(${tokenUsageTracking.estimatedCostInEuros} AS DECIMAL))`));

    enhancedModelBreakdown = modelBreakdown.map((model) => ({
      ...model,
      inputTokens: Number(model.inputTokens) || 0,
      outputTokens: Number(model.outputTokens) || 0,
      totalCost: Number(model.totalCost) || 0,
      requests: Number(model.requests) || 0,
      totalTokens: (Number(model.inputTokens) || 0) + (Number(model.outputTokens) || 0),
      averageCostPerRequest:
        (Number(model.requests) || 0) > 0
          ? (Number(model.totalCost) || 0) / (Number(model.requests) || 0)
          : 0,
    }));

    const actionBreakdown = await db
      .select({
        action: tokenUsageTracking.action,
        totalCost: sql<number>`SUM(CAST(${tokenUsageTracking.estimatedCostInEuros} AS DECIMAL))`,
        requests: sql<number>`COUNT(*)`,
        inputTokens: sql<number>`SUM(${tokenUsageTracking.inputTokens})`,
        outputTokens: sql<number>`SUM(${tokenUsageTracking.outputTokens})`,
        uniqueStories: sql<number>`COUNT(DISTINCT ${tokenUsageTracking.storyId})`,
      })
      .from(tokenUsageTracking)
      .where(whereCondition)
      .groupBy(tokenUsageTracking.action)
      .orderBy(desc(sql`SUM(CAST(${tokenUsageTracking.estimatedCostInEuros} AS DECIMAL))`));

    enhancedActionBreakdown = actionBreakdown.map((action) => ({
      ...action,
      totalCost: Number(action.totalCost) || 0,
      requests: Number(action.requests) || 0,
      inputTokens: Number(action.inputTokens) || 0,
      outputTokens: Number(action.outputTokens) || 0,
      uniqueStories: Number(action.uniqueStories) || 0,
      averageCostPerRequest:
        (Number(action.requests) || 0) > 0
          ? (Number(action.totalCost) || 0) / (Number(action.requests) || 0)
          : 0,
      averageCostPerStory:
        (Number(action.uniqueStories) || 0) > 0
          ? (Number(action.totalCost) || 0) / (Number(action.uniqueStories) || 0)
          : 0,
    }));
  }

  const dateGrouping = isForever
    ? sql`date_trunc('month', ${tokenUsageTracking.createdAt})`
    : sql`DATE(${tokenUsageTracking.createdAt})`;

  const dailyUsage = await db
    .select({
      date: sql<string>`${dateGrouping}`,
      totalCost: sql<number>`SUM(CAST(${tokenUsageTracking.estimatedCostInEuros} AS DECIMAL))`,
      requests: sql<number>`COUNT(*)`,
      inputTokens: sql<number>`SUM(${tokenUsageTracking.inputTokens})`,
      outputTokens: sql<number>`SUM(${tokenUsageTracking.outputTokens})`,
    })
    .from(tokenUsageTracking)
    .where(whereCondition)
    .groupBy(dateGrouping)
    .orderBy(dateGrouping);

  const enhancedDailyUsage: DailyUsage[] = dailyUsage.map((day) => ({
    ...day,
    totalCost: Number(day.totalCost) || 0,
    requests: Number(day.requests) || 0,
    inputTokens: Number(day.inputTokens) || 0,
    outputTokens: Number(day.outputTokens) || 0,
    totalTokens: (Number(day.inputTokens) || 0) + (Number(day.outputTokens) || 0),
  }));

  const topModels = options.includeBreakdowns ? enhancedModelBreakdown.slice(0, 5) : [];

  return {
    totalCost,
    totalTokens,
    totalRequests,
    averageCostPerRequest,
    modelBreakdown: enhancedModelBreakdown,
    actionBreakdown: enhancedActionBreakdown,
    dailyUsage: enhancedDailyUsage,
    topModels,
    granularity: isForever ? 'month' : 'day',
  };
}

/** Map preset period query param to a window (local-date sliding window, same as legacy route). */
export function windowFromAiUsagePeriod(period: string): ResolvedStatisticsWindow {
  const endDate = new Date();
  const startDate = new Date();

  switch (period) {
    case '7d':
      startDate.setDate(endDate.getDate() - 7);
      break;
    case '30d':
      startDate.setDate(endDate.getDate() - 30);
      break;
    case '90d':
      startDate.setDate(endDate.getDate() - 90);
      break;
    case 'forever':
      return { kind: 'forever', granularity: 'month' };
    default:
      startDate.setDate(endDate.getDate() - 30);
  }

  return {
    kind: 'bounded',
    start: startDate,
    end: endDate,
    granularity: 'day',
  };
}
