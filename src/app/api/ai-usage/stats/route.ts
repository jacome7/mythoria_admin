import { NextRequest, NextResponse } from 'next/server';
import { getWorkflowsDb } from '@/db';
import { tokenUsageTracking } from '@/db/schema/workflows/token-usage';
import { and, gte, lte, sql, desc } from 'drizzle-orm';
import { auth } from '@/auth';
import { ALLOWED_DOMAINS } from '@/config/auth';

// Types for the API responses
export interface TokenUsageStatsResponse {
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

function getDateRange(period: string): { startDate: Date; endDate: Date } | null {
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
      return null; // No date range for forever
    default:
      startDate.setDate(endDate.getDate() - 30); // Default to 30 days
  }

  return { startDate, endDate };
}

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user has access (domain validation)
    const isAllowedDomain = ALLOWED_DOMAINS.some((domain) => session.user?.email?.endsWith(domain));

    if (!isAllowedDomain) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || '30d';
    const dateRange = getDateRange(period);

    const db = getWorkflowsDb();

    // Build the base where condition
    const whereCondition = dateRange
      ? and(
          gte(tokenUsageTracking.createdAt, dateRange.startDate.toISOString()),
          lte(tokenUsageTracking.createdAt, dateRange.endDate.toISOString()),
        )
      : undefined;

    // Get overall stats
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

    // Get model breakdown
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

    // Calculate additional fields for model breakdown
    const enhancedModelBreakdown: ModelUsage[] = modelBreakdown.map((model) => ({
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

    // Get action breakdown
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

    // Calculate additional fields for action breakdown
    const enhancedActionBreakdown: ActionUsage[] = actionBreakdown.map((action) => ({
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

    // Get daily/monthly usage (aggregate by date or month)
    const isForever = period === 'forever';
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

    // Calculate total tokens for daily usage
    const enhancedDailyUsage: DailyUsage[] = dailyUsage.map((day) => ({
      ...day,
      totalCost: Number(day.totalCost) || 0,
      requests: Number(day.requests) || 0,
      inputTokens: Number(day.inputTokens) || 0,
      outputTokens: Number(day.outputTokens) || 0,
      totalTokens: (Number(day.inputTokens) || 0) + (Number(day.outputTokens) || 0),
    }));

    // Get top 5 models for quick overview
    const topModels = enhancedModelBreakdown.slice(0, 5);

    const response: TokenUsageStatsResponse = {
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

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching token usage stats:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
