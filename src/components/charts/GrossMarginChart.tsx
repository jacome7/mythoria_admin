'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { NormalizedRevenueBucket } from '@/lib/analytics/revenue';
import type { RegistrationRange, RegistrationGranularity } from '@/lib/analytics/registrations';

interface RevenueSnapshotResponse {
  currency: string;
  granularity: RegistrationGranularity;
  buckets: NormalizedRevenueBucket[];
}

interface DailyUsagePoint {
  date: string;
  totalCost: number;
}

interface AiUsageStatsResponse {
  granularity: RegistrationGranularity;
  dailyUsage: DailyUsagePoint[];
}

type ChartDatum = {
  label: string;
  revenue: number;
  aiCost: number;
  margin: number;
  date: Date;
};

const RANGE_OPTIONS: { label: string; value: RegistrationRange }[] = [
  { label: 'Last 7 days', value: '7d' },
  { label: 'Last 30 days', value: '30d' },
  { label: 'Last 90 days', value: '90d' },
];

const COLORS = {
  revenue: '#2563eb',
  aiCost: '#ef4444',
  margin: '#10b981',
  grid: 'rgba(148, 163, 184, 0.3)',
};

export default function GrossMarginChart({ onReady }: { onReady?: () => void }) {
  const [range, setRange] = useState<RegistrationRange>('7d');
  const [currencyCode, setCurrencyCode] = useState('EUR');
  const [chartData, setChartData] = useState<ChartDatum[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [granularity, setGranularity] = useState<RegistrationGranularity>('day');

  const currencyFormatter = useMemo(
    () =>
      new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currencyCode,
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }),
    [currencyCode],
  );

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const [revenueResponse, aiUsageResponse] = await Promise.all([
        fetch(`/api/admin/revenue/snapshot?range=${range}`),
        fetch(`/api/ai-usage/stats?period=${range}`),
      ]);

      if (!revenueResponse.ok) {
        throw new Error(`Failed to load revenue (${revenueResponse.status})`);
      }

      if (!aiUsageResponse.ok) {
        throw new Error(`Failed to load AI usage (${aiUsageResponse.status})`);
      }

      const revenuePayload: RevenueSnapshotResponse = await revenueResponse.json();
      const aiUsagePayload: AiUsageStatsResponse = await aiUsageResponse.json();

      const mergedData = mergeData(revenuePayload, aiUsagePayload);
      setChartData(mergedData);
      setCurrencyCode((revenuePayload.currency ?? 'EUR').toUpperCase());
      setGranularity(revenuePayload.granularity ?? 'day');
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      setChartData([]);
    } finally {
      setIsLoading(false);
      onReady?.();
    }
  }, [onReady, range]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const showEmptyState = !isLoading && chartData.length === 0;

  return (
    <section className="w-full rounded-2xl border border-base-200 bg-base-100 p-2 sm:p-6 shadow-sm">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-xl font-semibold">Revenue vs AI costs</h2>
          <p className="text-sm text-base-content/70">
            Revenue bars stay positive, AI spend is plotted below the axis, and the margin line shows gross profit.
          </p>
        </div>
        <div className="join">
          {RANGE_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              className={`btn btn-sm join-item ${range === option.value ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setRange(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6 h-80">
        {isLoading ? (
          <ChartPlaceholder label="Loading margin chart" />
        ) : error ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <p className="font-semibold text-error">Failed to load chart</p>
            <p className="text-sm text-base-content/70">{error}</p>
          </div>
        ) : showEmptyState ? (
          <div className="flex h-full items-center justify-center text-base-content/70">
            No data available for this window.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} interval={chartData.length > 14 ? Math.floor(chartData.length / 14) : 0} />
              <YAxis
                tickFormatter={(value: number) => currencyFormatter.format(Number(value))}
                tickMargin={6}
                width={96}
              />
              <Tooltip
                content={<CustomTooltip currencyFormatter={currencyFormatter} granularity={granularity} />}
                cursor={{ fill: 'rgba(59,130,246,0.08)' }}
              />
              <Bar dataKey="revenue" name="Revenue" fill={COLORS.revenue} radius={[6, 6, 0, 0]} />
              <Bar dataKey="aiCost" name="AI usage" fill={COLORS.aiCost} radius={[0, 0, 6, 6]} />
              <Line
                type="monotone"
                dataKey="margin"
                name="Margin"
                stroke={COLORS.margin}
                strokeWidth={2}
                dot={false}
                activeDot={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>
    </section>
  );
}

function mergeData(
  revenue: RevenueSnapshotResponse,
  aiUsage: AiUsageStatsResponse,
): ChartDatum[] {
  const revenueMap = new Map<string, NormalizedRevenueBucket>();
  const aiCostMap = new Map<string, DailyUsagePoint>();
  const dateLookup = new Map<string, Date>();

  revenue.buckets.forEach((bucket) => {
    const key = formatDateKey(bucket.date, revenue.granularity);
    revenueMap.set(key, bucket);
    dateLookup.set(key, new Date(bucket.date));
  });

  aiUsage.dailyUsage.forEach((usage) => {
    const key = formatDateKey(usage.date, aiUsage.granularity);
    aiCostMap.set(key, usage);
    if (!dateLookup.has(key)) {
      dateLookup.set(key, new Date(usage.date));
    }
  });

  const keys = Array.from(new Set([...revenueMap.keys(), ...aiCostMap.keys()]));
  keys.sort((a, b) => {
    const dateA = dateLookup.get(a)?.getTime() ?? 0;
    const dateB = dateLookup.get(b)?.getTime() ?? 0;
    return dateA - dateB;
  });

  return keys.map((key) => {
    const revenueBucket = revenueMap.get(key);
    const aiUsageBucket = aiCostMap.get(key);
    const revenueValue = revenueBucket?.revenue ?? 0;
    const aiCostValue = aiUsageBucket?.totalCost ?? 0;
    const date = dateLookup.get(key) ?? new Date();

    return {
      label: revenueBucket?.label ?? formatFallbackLabel(date, revenue.granularity),
      revenue: revenueValue,
      aiCost: -aiCostValue,
      margin: revenueValue - aiCostValue,
      date,
    };
  });
}

function formatDateKey(value: string, granularity: RegistrationGranularity) {
  const date = new Date(value);
  const year = date.getUTCFullYear();
  const month = `${date.getUTCMonth() + 1}`.padStart(2, '0');
  if (granularity === 'month') {
    return `${year}-${month}`;
  }
  const day = `${date.getUTCDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatFallbackLabel(date: Date, granularity: RegistrationGranularity) {
  if (granularity === 'month') {
    return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit', timeZone: 'UTC' });
  }
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

function formatFullDate(value: string, granularity: RegistrationGranularity) {
  const date = new Date(value);
  if (granularity === 'month') {
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  }
  return date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    weekday: 'short',
    timeZone: 'UTC',
  });
}

function ChartPlaceholder({ label }: { label: string }) {
  return (
    <div className="h-full rounded-2xl border border-dashed border-base-300 bg-base-200/40 p-4 shadow-inner">
      <div className="flex h-full items-end gap-2 opacity-60" aria-label={label}>
        {Array.from({ length: 10 }).map((_, index) => (
          <div
            key={index}
            className="flex-1 rounded bg-base-100/70"
            style={{ height: `${25 + index * 5}%`, animation: 'pulse 1.6s ease-in-out infinite' }}
          />
        ))}
      </div>
    </div>
  );
}

function CustomTooltip({
  active,
  payload,
  currencyFormatter,
  granularity,
}: {
  active?: boolean;
  payload?: { payload: ChartDatum }[];
  currencyFormatter: Intl.NumberFormat;
  granularity: RegistrationGranularity;
}) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  return (
    <div className="rounded-lg border border-base-200 bg-base-100 px-3 py-2 text-sm shadow">
      <p className="font-semibold">{formatFullDate(point.date.toISOString(), granularity)}</p>
      <p>Revenue: {currencyFormatter.format(point.revenue)}</p>
      <p>AI cost: {currencyFormatter.format(Math.abs(point.aiCost))}</p>
      <p className="font-semibold">Margin: {currencyFormatter.format(point.margin)}</p>
    </div>
  );
}
