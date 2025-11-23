'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useAdminAuth } from '@/lib/hooks/useAdminAuth';
import type { RegistrationRange } from '@/lib/analytics/registrations';

interface RevenueBucket {
  date: string;
  label: string;
  revenue: number;
  transactions: number;
  averageOrderValue: number;
  weekday?: number | null;
  isWeekend?: boolean;
  granularity: 'day' | 'month';
}

interface RevenueSnapshot {
  range: RegistrationRange;
  granularity: 'day' | 'month';
  currency: string;
  totals: {
    revenue: number;
    transactions: number;
    averageOrderValue: number;
  };
  buckets: RevenueBucket[];
  usageSummary: {
    totalActions: number;
    totalCredits: number;
  };
}

const RANGE_OPTIONS: { label: string; value: RegistrationRange }[] = [
  { label: 'Last 7 days', value: '7d' },
  { label: 'Last 30 days', value: '30d' },
  { label: 'Last 90 days', value: '90d' },
  { label: 'Forever', value: 'forever' },
];

export default function RevenuePage() {
  const { session, loading } = useAdminAuth();
  const [snapshot, setSnapshot] = useState<RevenueSnapshot | null>(null);
  const [timePeriod, setTimePeriod] = useState<RegistrationRange>('30d');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (loading || !session?.user) {
      return;
    }

    const controller = new AbortController();
    async function fetchSnapshot() {
      try {
        setIsLoading(true);
        setError(null);
        const response = await fetch(`/api/admin/revenue/snapshot?range=${timePeriod}`, {
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new Error(`Failed to load revenue data (${response.status})`);
        }
        const payload: RevenueSnapshot = await response.json();
        setSnapshot(payload);
      } catch (err) {
        if (controller.signal.aborted) {
          return;
        }
        console.error(err);
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setIsLoading(false);
      }
    }

    fetchSnapshot();
    return () => controller.abort();
  }, [loading, session, timePeriod]);

  const currencyCode = (snapshot?.currency ?? 'EUR').toUpperCase();
  const currencyFormatter = useMemo(
    () =>
      new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currencyCode,
        minimumFractionDigits: 2,
      }),
    [currencyCode],
  );

  const totals = snapshot?.totals ?? { revenue: 0, transactions: 0, averageOrderValue: 0 };
  const usageSummary = snapshot?.usageSummary ?? { totalActions: 0, totalCredits: 0 };
  const chartData = snapshot?.buckets ?? [];
  const showEmptyState = !isLoading && chartData.length === 0;

  if (loading || isLoading) {
    return (
      <div className="min-h-screen bg-base-200">
        <main className="container mx-auto p-6">
          <div className="flex justify-center items-center h-64">
            <span className="loading loading-spinner loading-lg"></span>
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
      <main className="container mx-auto p-6">
        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-base-content mb-2">Revenue Analytics</h1>
            <p className="text-base-content/70">Live view of credit sales and service usage.</p>
          </div>
          <div className="form-control">
            <select
              className="select select-bordered"
              value={timePeriod}
              onChange={(event) => setTimePeriod(event.target.value as RegistrationRange)}
            >
              {RANGE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8">
          <StatCard
            label="Revenue"
            value={currencyFormatter.format(totals.revenue)}
            subtitle="Completed orders"
          />
          <StatCard
            label="Transactions"
            value={totals.transactions.toLocaleString()}
            subtitle="Orders in range"
          />
          <StatCard
            label="Avg order value"
            value={currencyFormatter.format(totals.averageOrderValue)}
            subtitle="Revenue / orders"
          />
          <StatCard
            label="Credits consumed"
            value={usageSummary.totalCredits.toLocaleString()}
            subtitle={`${usageSummary.totalActions.toLocaleString()} actions`}
          />
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 mb-8">
          <div className="card bg-base-100 shadow-lg lg:col-span-2">
            <div className="card-body">
              <h3 className="card-title">Revenue trend</h3>
              <div className="h-72">
                {error ? (
                  <div className="flex h-full items-center justify-center text-center">
                    <div>
                      <p className="font-semibold text-error">Failed to load chart</p>
                      <p className="text-sm text-base-content/70">{error}</p>
                    </div>
                  </div>
                ) : showEmptyState ? (
                  <div className="flex h-full items-center justify-center text-base-content/70">
                    No revenue recorded for this range.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart
                      data={chartData}
                      margin={{ top: 8, right: 16, left: 0, bottom: 8 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.4)" />
                      <XAxis
                        dataKey="label"
                        tick={(props) => <CustomTick {...props} />}
                        interval={chartData.length > 14 ? Math.floor(chartData.length / 14) : 0}
                      />
                      <YAxis
                        yAxisId="revenue"
                        tickFormatter={(value) => currencyFormatter.format(Number(value))}
                      />
                      <YAxis
                        yAxisId="orders"
                        orientation="right"
                        allowDecimals={false}
                        tickFormatter={(value) => Number(value).toLocaleString()}
                      />
                      <Tooltip content={<CustomTooltip currencyFormatter={currencyFormatter} />} />
                      <Legend />
                      <Bar
                        dataKey="revenue"
                        yAxisId="revenue"
                        fill="#2563eb"
                        name="Revenue"
                        radius={[6, 6, 0, 0]}
                      />
                      <Line
                        type="monotone"
                        dataKey="transactions"
                        yAxisId="orders"
                        stroke="#f97316"
                        strokeWidth={2}
                        dot={false}
                        name="Orders"
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>

          <div className="card bg-base-100 shadow-lg">
            <div className="card-body">
              <h3 className="card-title">Usage snapshot</h3>
              <p className="text-sm text-base-content/70">
                Credits deducted by story creation, narrations, print jobs, and edits during the
                selected window.
              </p>
              <div className="mt-6 space-y-4">
                <UsageStat label="Credits burned" value={usageSummary.totalCredits} />
                <UsageStat label="Total actions" value={usageSummary.totalActions} />
              </div>
            </div>
          </div>
        </div>
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

function UsageStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-base-content/70">{label}</span>
      <span className="text-lg font-semibold">{value.toLocaleString()}</span>
    </div>
  );
}

function CustomTick({
  x = 0,
  y = 0,
  payload,
}: {
  x?: number;
  y?: number;
  payload?: { value: string };
}) {
  return (
    <text x={x} y={y + 10} fill="#64748b" textAnchor="middle" fontSize={12}>
      {payload?.value ?? ''}
    </text>
  );
}

function CustomTooltip({
  active,
  payload,
  currencyFormatter,
}: {
  active?: boolean;
  payload?: { payload: RevenueBucket }[];
  currencyFormatter: Intl.NumberFormat;
}) {
  if (!active || !payload?.length) return null;
  const datum = payload[0].payload;
  return (
    <div className="rounded-lg border border-base-200 bg-base-100 px-3 py-2 text-sm shadow">
      <p className="font-semibold">
        {datum.granularity === 'day' ? formatFullDate(datum.date) : formatFullMonth(datum.date)}
      </p>
      <p>Revenue: {currencyFormatter.format(datum.revenue)}</p>
      <p>Orders: {datum.transactions.toLocaleString()}</p>
      <p>AOV: {currencyFormatter.format(datum.averageOrderValue)}</p>
    </div>
  );
}

function formatFullDate(value: string) {
  const date = new Date(value);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    weekday: 'short',
    timeZone: 'UTC',
  });
}

function formatFullMonth(value: string) {
  const date = new Date(value);
  return date.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}
