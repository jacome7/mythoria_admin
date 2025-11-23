'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import DailyAiUsageChart, { type DailyAiUsagePoint } from '@/components/charts/DailyAiUsageChart';
import { useAdminAuth } from '@/lib/hooks/useAdminAuth';

const PERIOD_OPTIONS: { label: string; value: Period }[] = [
  { label: 'Last 7 days', value: '7d' },
  { label: 'Last 30 days', value: '30d' },
  { label: 'Last 90 days', value: '90d' },
  { label: 'Forever', value: 'forever' },
];

type Period = '7d' | '30d' | '90d' | 'forever';

interface TokenUsageStatsResponse {
  totalCost: number;
  totalTokens: number;
  totalRequests: number;
  averageCostPerRequest: number;
  modelBreakdown: ModelUsage[];
  topModels: ModelUsage[];
  actionBreakdown: ActionUsage[];
  dailyUsage: DailyAiUsagePoint[];
  granularity: 'day' | 'month';
}

interface ModelUsage {
  model: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  totalCost: number;
  requests: number;
  averageCostPerRequest: number;
}

interface ActionUsage {
  action: string;
  totalCost: number;
  requests: number;
  inputTokens: number;
  outputTokens: number;
  uniqueStories: number;
  averageCostPerRequest: number;
  averageCostPerStory: number;
}

export default function AIUsagePage() {
  const { session, loading } = useAdminAuth();
  const [stats, setStats] = useState<TokenUsageStatsResponse | null>(null);
  const [timePeriod, setTimePeriod] = useState<Period>('30d');
  const [isFetching, setIsFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      setIsFetching(true);
      setError(null);
      const response = await fetch(`/api/ai-usage/stats?period=${timePeriod}`);
      if (!response.ok) {
        throw new Error(`Failed to load AI usage (${response.status})`);
      }
      const payload: TokenUsageStatsResponse = await response.json();
      setStats(payload);
    } catch (err) {
      console.error('Error fetching AI usage data:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      setStats(null);
    } finally {
      setIsFetching(false);
    }
  }, [timePeriod]);

  useEffect(() => {
    if (!loading && session?.user) {
      fetchStats();
    }
  }, [loading, session, fetchStats]);

  const currencyFormatter = useMemo(
    () =>
      new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'EUR',
        minimumFractionDigits: 2,
      }),
    [],
  );

  const numberFormatter = useMemo(
    () =>
      new Intl.NumberFormat('en-US', {
        maximumFractionDigits: 2,
      }),
    [],
  );

  const totalCost = stats?.totalCost ?? 0;
  const totalTokens = stats?.totalTokens ?? 0;
  const totalRequests = stats?.totalRequests ?? 0;
  const averageCostPerRequest = stats?.averageCostPerRequest ?? 0;
  const dailyUsage = stats?.dailyUsage ?? [];
  const actionBreakdown = stats?.actionBreakdown ?? [];
  const topModels = stats?.topModels ?? [];
  const granularity = stats?.granularity ?? 'day';

  if (loading || isFetching) {
    return (
      <div className="min-h-screen bg-base-200">
        <main className="container mx-auto p-6">
          <div className="flex h-64 items-center justify-center">
            <span className="loading loading-spinner loading-lg" aria-label="Loading AI usage" />
          </div>
        </main>
      </div>
    );
  }

  if (!session?.user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-base-200">
      <main className="container mx-auto p-6 space-y-8">
        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-base-content mb-2">AI Usage & Costs</h1>
            <p className="text-base-content/70">
              Monitor token burn, spend, and the workflows that drive AI usage.
            </p>
          </div>
          <div className="form-control">
            <select
              className="select select-bordered"
              value={timePeriod}
              onChange={(event) => setTimePeriod(event.target.value as Period)}
            >
              {PERIOD_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {error ? (
          <div className="alert alert-error shadow-lg">
            <div>
              <h2 className="font-semibold">Failed to load AI usage</h2>
              <p className="text-sm">{error}</p>
            </div>
            <button className="btn btn-sm" onClick={fetchStats}>
              Retry
            </button>
          </div>
        ) : (
          <>
            <section className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8">
              <StatCard
                label="Total cost"
                value={currencyFormatter.format(totalCost)}
                subtitle={`${numberFormatter.format(totalRequests)} requests`}
              />
              <StatCard
                label="Total tokens"
                value={`${numberFormatter.format(totalTokens / 1_000_000)}M`}
                subtitle="Input + output"
              />
              <StatCard
                label="Avg cost / request"
                value={currencyFormatter.format(averageCostPerRequest)}
                subtitle="Across selected period"
              />
              <StatCard
                label="Tracked actions"
                value={numberFormatter.format(actionBreakdown.length)}
                subtitle="token_usage_tracking"
              />
            </section>

            <section className="grid grid-cols-1 gap-6 lg:grid-cols-3 mb-8">
              <div className="card bg-base-100 shadow-lg lg:col-span-2">
                <div className="card-body">
                  <h3 className="card-title">Daily usage trend</h3>
                  <p className="text-sm text-base-content/70">Cost (bars) vs tokens (line)</p>
                  <div className="h-72">
                    {dailyUsage.length ? (
                      <DailyAiUsageChart
                        data={dailyUsage}
                        currencyFormatter={currencyFormatter}
                        granularity={granularity}
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-base-content/70">
                        No AI usage recorded for this period.
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="card bg-base-100 shadow-lg">
                <div className="card-body">
                  <h3 className="card-title">Top models</h3>
                  <p className="text-sm text-base-content/70">Sorted by spend</p>
                  {topModels.length ? (
                    <div className="mt-6 space-y-4">
                      {topModels.map((model) => (
                        <div key={model.model} className="flex items-center justify-between">
                          <div>
                            <p className="font-semibold">{model.model}</p>
                            <p className="text-xs text-base-content/60">
                              {numberFormatter.format(model.totalTokens / 1_000_000)}M tokens
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold">
                              {currencyFormatter.format(model.totalCost)}
                            </p>
                            <p className="text-xs text-base-content/60">
                              {numberFormatter.format(model.requests)} requests
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex items-center justify-center py-6 text-sm text-base-content/70">
                      No model activity.
                    </div>
                  )}
                </div>
              </div>
            </section>

            <section className="card bg-base-100 shadow-lg">
              <div className="card-body">
                <h3 className="card-title">Cost breakdown by action</h3>
                <p className="text-sm text-base-content/70">Derived from workflow executions</p>
                {actionBreakdown.length ? (
                  <div className="mt-4 overflow-x-auto">
                    <table className="table table-zebra">
                      <thead>
                        <tr>
                          <th>Action</th>
                          <th>Requests</th>
                          <th>Stories</th>
                          <th>Input tokens</th>
                          <th>Output tokens</th>
                          <th>Total cost</th>
                          <th>Avg cost / request</th>
                          <th>Avg cost / story</th>
                        </tr>
                      </thead>
                      <tbody>
                        {actionBreakdown.map((action) => (
                          <tr key={action.action}>
                            <td className="font-semibold">{formatActionLabel(action.action)}</td>
                            <td>{numberFormatter.format(action.requests)}</td>
                            <td>{numberFormatter.format(action.uniqueStories)}</td>
                            <td>{numberFormatter.format(action.inputTokens / 1_000_000)}M</td>
                            <td>{numberFormatter.format(action.outputTokens / 1_000_000)}M</td>
                            <td className="font-semibold">
                              {currencyFormatter.format(action.totalCost)}
                            </td>
                            <td>{currencyFormatter.format(action.averageCostPerRequest)}</td>
                            <td>{currencyFormatter.format(action.averageCostPerStory)}</td>
                          </tr>
                        ))}
                        <tr className="border-t-2 border-base-300">
                          <td className="font-bold">Total</td>
                          <td>
                            {numberFormatter.format(
                              actionBreakdown.reduce((sum, action) => sum + action.requests, 0),
                            )}
                          </td>
                          <td>
                            {numberFormatter.format(
                              actionBreakdown.reduce(
                                (sum, action) => sum + action.uniqueStories,
                                0,
                              ),
                            )}
                          </td>
                          <td>
                            {numberFormatter.format(
                              actionBreakdown.reduce((sum, action) => sum + action.inputTokens, 0) /
                                1_000_000,
                            )}
                            M
                          </td>
                          <td>
                            {numberFormatter.format(
                              actionBreakdown.reduce(
                                (sum, action) => sum + action.outputTokens,
                                0,
                              ) / 1_000_000,
                            )}
                            M
                          </td>
                          <td className="font-bold">
                            {currencyFormatter.format(
                              actionBreakdown.reduce((sum, action) => sum + action.totalCost, 0),
                            )}
                          </td>
                          <td colSpan={2} className="text-right font-bold">
                            {currencyFormatter.format(
                              actionBreakdown.reduce((sum, action) => sum + action.totalCost, 0) /
                                Math.max(
                                  actionBreakdown.reduce((sum, action) => sum + action.requests, 0),
                                  1,
                                ),
                            )}{' '}
                            per request
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="flex h-full items-center justify-center py-8 text-center text-base-content/70">
                    No AI actions were executed in this range.
                  </div>
                )}
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}

function StatCard({ label, value, subtitle }: { label: string; value: string; subtitle: string }) {
  return (
    <div className="card bg-base-100 shadow">
      <div className="card-body">
        <p className="text-xs uppercase tracking-wide text-base-content/60">{label}</p>
        <p className="text-3xl font-bold mt-2">{value}</p>
        <p className="text-sm text-base-content/60">{subtitle}</p>
      </div>
    </div>
  );
}

function formatActionLabel(action: string) {
  return action
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
