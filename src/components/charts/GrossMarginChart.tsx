'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { NormalizedRevenueBucket } from '@/lib/analytics/revenue';
import type { RegistrationRange, RegistrationGranularity } from '@/lib/analytics/registrations';
import MeasuredChartFrame from './MeasuredChartFrame';

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

interface PrintingCostsResponse {
  granularity: RegistrationGranularity;
  currency: string;
  buckets: DailyUsagePoint[];
  pendingConversionCount: number;
  pendingPriceCount: number;
}

type ChartDatum = {
  label: string;
  revenue: number;
  aiCost: number;
  printingCost: number;
  margin: number;
  date: Date;
};

const RANGE_OPTIONS: { label: string; value: RegistrationRange }[] = [
  { label: 'Last 7 days', value: '7d' },
  { label: 'Last 30 days', value: '30d' },
  { label: 'Last 90 days', value: '90d' },
  { label: 'Forever', value: 'forever' },
];

const COLORS = {
  revenue: '#2563eb',
  aiCost: '#ef4444',
  printingCost: '#f97316',
  margin: '#10b981',
  grid: 'rgba(148, 163, 184, 0.3)',
};

interface GrossMarginChartProps {
  onReady?: () => void;
  range: RegistrationRange;
  onRangeChange: (nextRange: RegistrationRange) => void;
}

export default function GrossMarginChart({ onReady, range, onRangeChange }: GrossMarginChartProps) {
  const [currencyCode, setCurrencyCode] = useState('EUR');
  const [chartData, setChartData] = useState<ChartDatum[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [granularity, setGranularity] = useState<RegistrationGranularity>('day');
  const [pendingConversionCount, setPendingConversionCount] = useState(0);
  const [pendingPriceCount, setPendingPriceCount] = useState(0);

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
  const preciseCurrencyFormatter = useMemo(
    () =>
      new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currencyCode,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
    [currencyCode],
  );

  useEffect(() => {
    const controller = new AbortController();
    const fetchData = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const options = { signal: controller.signal, cache: 'no-store' as RequestCache };
        const [revenueResponse, aiUsageResponse, printingResponse] = await Promise.all([
          fetch(`/api/admin/revenue/snapshot?range=${range}`, options),
          fetch(`/api/ai-usage/stats?period=${range}`, options),
          fetch(`/api/admin/printing-costs?range=${range}`, options),
        ]);

        if (!revenueResponse.ok)
          throw new Error(`Failed to load revenue (${revenueResponse.status})`);
        if (!aiUsageResponse.ok)
          throw new Error(`Failed to load AI usage (${aiUsageResponse.status})`);
        if (!printingResponse.ok) {
          throw new Error(`Failed to load printing costs (${printingResponse.status})`);
        }

        const [revenue, aiUsage, printing] = await Promise.all([
          revenueResponse.json() as Promise<RevenueSnapshotResponse>,
          aiUsageResponse.json() as Promise<AiUsageStatsResponse>,
          printingResponse.json() as Promise<PrintingCostsResponse>,
        ]);
        if (controller.signal.aborted) return;

        setChartData(mergeData(revenue, aiUsage, printing));
        setCurrencyCode((revenue.currency || 'EUR').toUpperCase());
        setGranularity(revenue.granularity ?? 'day');
        setPendingConversionCount(printing.pendingConversionCount ?? 0);
        setPendingPriceCount(printing.pendingPriceCount ?? 0);
      } catch (err) {
        if (controller.signal.aborted) return;
        console.error(err);
        setError(err instanceof Error ? err.message : 'Unknown error');
        setChartData([]);
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
          onReady?.();
        }
      }
    };

    void fetchData();
    return () => controller.abort();
  }, [onReady, range]);

  const showEmptyState = !isLoading && chartData.length === 0;
  const incompleteCostCount = pendingConversionCount + pendingPriceCount;

  return (
    <section className="w-full rounded-2xl border border-base-200 bg-base-100 p-2 shadow-sm sm:p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-xl font-semibold">Revenue vs costs</h2>
          <p className="text-sm text-base-content/70">
            AI and printing costs stack below zero. The margin line subtracts both from revenue.
            Printing costs exclude tax and use verified production job dates in UTC.
          </p>
        </div>
        <div className="join">
          {RANGE_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              className={`btn btn-sm join-item ${range === option.value ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => onRangeChange(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6 h-80 min-h-80 min-w-0">
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
          <MeasuredChartFrame minHeight={320}>
            {({ width, height }) => (
              <ResponsiveContainer width={width} height={height}>
                <ComposedChart data={chartData} margin={{ top: 8, right: 8, left: -12, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11 }}
                    interval={chartData.length > 14 ? Math.floor(chartData.length / 14) : 0}
                  />
                  <YAxis
                    tickFormatter={(value: number) => currencyFormatter.format(Number(value))}
                    tickMargin={4}
                    tick={{ fontSize: 10 }}
                    width={48}
                  />
                  <Tooltip
                    content={
                      <CustomTooltip
                        currencyFormatter={preciseCurrencyFormatter}
                        granularity={granularity}
                      />
                    }
                  />
                  <Legend />
                  <Bar dataKey="revenue" name="Revenue" fill={COLORS.revenue} />
                  <Bar dataKey="aiCost" name="AI cost" stackId="costs" fill={COLORS.aiCost} />
                  <Bar
                    dataKey="printingCost"
                    name="Printing cost"
                    stackId="costs"
                    fill={COLORS.printingCost}
                  />
                  <Line
                    type="monotone"
                    dataKey="margin"
                    name="Gross margin"
                    stroke={COLORS.margin}
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </MeasuredChartFrame>
        )}
      </div>
      {incompleteCostCount > 0 && (
        <p className="mt-3 text-sm text-warning" role="status">
          EUR printing costs are incomplete: {pendingConversionCount.toLocaleString()} orders await
          currency conversion and {pendingPriceCount.toLocaleString()} await a price.
        </p>
      )}
    </section>
  );
}

function mergeData(
  revenue: RevenueSnapshotResponse,
  aiUsage: AiUsageStatsResponse,
  printing: PrintingCostsResponse,
): ChartDatum[] {
  const revenueMap = new Map<string, NormalizedRevenueBucket>();
  const aiCostMap = new Map<string, DailyUsagePoint>();
  const printingCostMap = new Map<string, DailyUsagePoint>();
  const dateLookup = new Map<string, Date>();

  revenue.buckets.forEach((bucket) => {
    const key = formatDateKey(bucket.date, revenue.granularity);
    revenueMap.set(key, bucket);
    dateLookup.set(key, new Date(bucket.date));
  });
  aiUsage.dailyUsage.forEach((bucket) => {
    const key = formatDateKey(bucket.date, aiUsage.granularity);
    aiCostMap.set(key, bucket);
    if (!dateLookup.has(key)) dateLookup.set(key, new Date(bucket.date));
  });
  printing.buckets.forEach((bucket) => {
    const key = formatDateKey(bucket.date, printing.granularity);
    printingCostMap.set(key, bucket);
    if (!dateLookup.has(key)) dateLookup.set(key, new Date(bucket.date));
  });

  const keys = Array.from(
    new Set([...revenueMap.keys(), ...aiCostMap.keys(), ...printingCostMap.keys()]),
  );
  keys.sort((a, b) => (dateLookup.get(a)?.getTime() ?? 0) - (dateLookup.get(b)?.getTime() ?? 0));

  return keys.map((key) => {
    const revenueBucket = revenueMap.get(key);
    const revenueValue = revenueBucket?.revenue ?? 0;
    const aiCostValue = aiCostMap.get(key)?.totalCost ?? 0;
    const printingCostValue = printingCostMap.get(key)?.totalCost ?? 0;
    const date = dateLookup.get(key) ?? new Date();
    return {
      label: revenueBucket?.label ?? formatFallbackLabel(date, revenue.granularity),
      revenue: revenueValue,
      aiCost: -aiCostValue,
      printingCost: -printingCostValue,
      margin: revenueValue - aiCostValue - printingCostValue,
      date,
    };
  });
}

function formatDateKey(value: string, granularity: RegistrationGranularity) {
  const date = new Date(value);
  const year = date.getUTCFullYear();
  const month = `${date.getUTCMonth() + 1}`.padStart(2, '0');
  if (granularity === 'month') return `${year}-${month}`;
  return `${year}-${month}-${`${date.getUTCDate()}`.padStart(2, '0')}`;
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
      <p>Printing cost: {currencyFormatter.format(Math.abs(point.printingCost))}</p>
      <p className="font-semibold">Gross margin: {currencyFormatter.format(point.margin)}</p>
    </div>
  );
}
