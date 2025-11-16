'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type {
  NormalizedServiceUsageBucket,
  ServiceUsageEventType,
} from '@/lib/analytics/service-usage';
import { SERVICE_USAGE_EVENT_TYPES } from '@/lib/analytics/service-usage';
import type { RegistrationRange } from '@/lib/analytics/registrations';

interface ServiceUsageResponse {
  range: RegistrationRange;
  granularity: 'day' | 'month';
  startDate: string;
  endDate: string;
  generatedAt: string;
  totalActions: number;
  totalCredits: number;
  buckets: NormalizedServiceUsageBucket[];
}

type ViewMode = 'actions' | 'credits';

type ChartDatum = NormalizedServiceUsageBucket &
  Record<`${ServiceUsageEventType}-actions` | `${ServiceUsageEventType}-credits`, number>;

const RANGE_OPTIONS: { label: string; value: RegistrationRange }[] = [
  { label: 'Last 7 days', value: '7d' },
  { label: 'Last 30 days', value: '30d' },
  { label: 'Last 90 days', value: '90d' },
  { label: 'Forever', value: 'forever' },
];

const VIEW_MODE_OPTIONS: { label: string; value: ViewMode }[] = [
  { label: 'Actions', value: 'actions' },
  { label: 'Credits', value: 'credits' },
];

const EVENT_COLORS: Record<ServiceUsageEventType, string> = {
  eBookGeneration: '#2563eb',
  audioBookGeneration: '#c026d3',
  printOrder: '#f97316',
  textEdit: '#059669',
  imageEdit: '#f43f5e',
};

const formatter = new Intl.NumberFormat('en-US');

interface ServiceUsageChartProps {
  onReady?: () => void;
}

export default function ServiceUsageChart({ onReady }: ServiceUsageChartProps = {}) {
  const [range, setRange] = useState<RegistrationRange>('30d');
  const [viewMode, setViewMode] = useState<ViewMode>('actions');
  const [buckets, setBuckets] = useState<NormalizedServiceUsageBucket[]>([]);
  const [totals, setTotals] = useState({ actions: 0, credits: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    let isMounted = true;

    async function fetchUsage() {
      try {
        setIsLoading(true);
        setError(null);
        const response = await fetch(`/api/admin/usage/service?range=${range}`, {
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new Error(`Failed to load service usage (${response.status})`);
        }
        const payload: ServiceUsageResponse = await response.json();
        if (!isMounted) return;
        setBuckets(payload.buckets);
        setTotals({ actions: payload.totalActions, credits: payload.totalCredits });
      } catch (err) {
        if (!isMounted || controller.signal.aborted) {
          return;
        }
        console.error(err);
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    fetchUsage();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [range]);

  useEffect(() => {
    if (!isLoading) {
      onReady?.();
    }
  }, [isLoading, onReady]);

  const chartData: ChartDatum[] = useMemo(() => {
    return buckets.map((bucket) => {
      const flattened: ChartDatum = {
        ...bucket,
      } as ChartDatum;

      SERVICE_USAGE_EVENT_TYPES.forEach((eventType) => {
        flattened[`${eventType}-actions`] = bucket.events[eventType].actions;
        flattened[`${eventType}-credits`] = bucket.events[eventType].credits;
      });

      return flattened;
    });
  }, [buckets]);

  const tickMeta = useMemo(
    () => new Map(chartData.map((point) => [point.label, point])),
    [chartData],
  );
  const showEmptyState = !isLoading && !chartData.length;
  const lineKey = viewMode === 'actions' ? 'totalActions' : 'totalCredits';

  const averagePerBucket = useMemo(() => {
    if (!chartData.length) return 0;
    const valueKey = viewMode === 'actions' ? 'totalActions' : 'totalCredits';
    const total = chartData.reduce((sum, bucket) => sum + (bucket[valueKey] as number), 0);
    return total / chartData.length;
  }, [chartData, viewMode]);

  return (
    <section className="w-full bg-base-100 rounded-2xl shadow-sm border border-base-200 p-2 sm:p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-xl font-semibold">Service usage</h2>
          <p className="text-sm text-base-content/70">
            Monitor credit-consuming activities like story creation, narrations, and print orders.
          </p>
        </div>
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
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
          <div className="join">
            {VIEW_MODE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                className={`btn btn-sm join-item ${viewMode === option.value ? 'btn-secondary' : 'btn-outline'}`}
                onClick={() => setViewMode(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-4 text-sm md:grid-cols-3">
        <StatCard label="Total actions" value={formatter.format(totals.actions)} />
        <StatCard label="Total credits" value={formatter.format(totals.credits)} />
        <StatCard
          label={`Avg per ${viewMode === 'actions' ? 'bucket' : 'bucket (credits)'}`}
          value={formatter.format(Math.round(averagePerBucket))}
        />
      </div>

      <div className="mt-6">
        <LegendContent />
      </div>

      <div className="mt-4 h-80">
        {isLoading ? (
          <ChartAreaPlaceholder label="Loading service usage chart" />
        ) : error ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <p className="font-semibold text-error">Failed to load chart</p>
            <p className="text-sm text-base-content/70">{error}</p>
          </div>
        ) : showEmptyState ? (
          <div className="flex h-full flex-col items-center justify-center text-center text-base-content/70">
            No credit usage recorded in this window.
          </div>
        ) : (
          <div className="h-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 8, right: 0, bottom: 8, left: -12 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.3)" />
              <XAxis
                dataKey="label"
                tick={(props) => <CustomTick {...props} meta={tickMeta} />}
                interval={chartData.length > 14 ? Math.floor(chartData.length / 14) : 0}
              />
                <YAxis
                  width={32}
                  allowDecimals={false}
                  tickMargin={4}
                  tick={{ fontSize: 10 }}
                  tickFormatter={(value) => formatter.format(Number(value))}
                />
              <Tooltip
                content={<CustomTooltip viewMode={viewMode} />}
                cursor={{ fill: 'rgba(147, 197, 253, 0.08)' }}
              />
              <Legend wrapperStyle={{ display: 'none' }} />
              {SERVICE_USAGE_EVENT_TYPES.map((eventType, index) => (
                <Bar
                  key={eventType}
                  dataKey={`${eventType}-${viewMode}`}
                  stackId="usage"
                  fill={EVENT_COLORS[eventType]}
                  radius={
                    index === SERVICE_USAGE_EVENT_TYPES.length - 1 ? [6, 6, 0, 0] : [0, 0, 0, 0]
                  }
                />
              ))}
              <Line
                type="monotone"
                dataKey={lineKey}
                stroke="#0ea5e9"
                strokeWidth={2}
                dot={false}
                activeDot={false}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
        )}
      </div>
    </section>
  );
}

function LegendContent() {
  return (
    <div className="flex flex-wrap gap-4 text-xs text-base-content/70">
      {SERVICE_USAGE_EVENT_TYPES.map((eventType) => (
        <LegendPill
          key={eventType}
          color={EVENT_COLORS[eventType]}
          label={formatEventLabel(eventType)}
        />
      ))}
    </div>
  );
}

function formatEventLabel(eventType: ServiceUsageEventType) {
  const labels: Record<ServiceUsageEventType, string> = {
    eBookGeneration: 'Story creation',
    audioBookGeneration: 'Narration',
    printOrder: 'Print request',
    textEdit: 'Text edit',
    imageEdit: 'Image edit',
  };
  return labels[eventType];
}

function LegendPill({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className="inline-flex h-3 w-3 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}

interface CustomTickProps {
  x?: number;
  y?: number;
  payload?: { value: string };
  meta: Map<string, ChartDatum>;
}

function CustomTick({ x = 0, y = 0, payload, meta }: CustomTickProps) {
  const label = payload?.value ?? '';
  const point = meta.get(label);
  const color = point?.isWeekend ? '#f59e0b' : '#94a3b8';
  return (
    <text x={x} y={y + 10} fill={color} textAnchor="middle" fontSize={12}>
      {label}
    </text>
  );
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: { payload: ChartDatum }[];
  viewMode: ViewMode;
}

function CustomTooltip({ active, payload, viewMode }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  const datum = payload[0].payload;

  return (
    <div className="rounded-lg border border-base-200 bg-base-100 px-3 py-2 text-sm shadow">
      <p className="font-semibold">
        {datum.granularity === 'day' ? formatFullDate(datum.date) : formatFullMonth(datum.date)}
      </p>
      <p className="mt-1">
        Total {viewMode}:{' '}
        {formatter.format(viewMode === 'actions' ? datum.totalActions : datum.totalCredits)}
      </p>
      <div className="mt-2 space-y-1">
        {SERVICE_USAGE_EVENT_TYPES.map((eventType) => {
          const actions = datum.events[eventType].actions;
          const credits = datum.events[eventType].credits;
          if (!actions && !credits) {
            return null;
          }
          return (
            <div key={eventType} className="flex items-center justify-between gap-4 text-xs">
              <span className="flex items-center gap-2">
                <span
                  className="inline-flex h-2 w-2 rounded-full"
                  style={{ backgroundColor: EVENT_COLORS[eventType] }}
                />
                {formatEventLabel(eventType)}
              </span>
              <span className="font-semibold">
                {viewMode === 'actions'
                  ? `${formatter.format(actions)} actions`
                  : `${formatter.format(credits)} credits`}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-base-200 bg-base-100 p-4">
      <p className="text-xs uppercase tracking-wide text-base-content/60">{label}</p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
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

function ChartAreaPlaceholder({ label }: { label: string }) {
  return (
    <div
      aria-label={label}
      className="h-full rounded-2xl border border-dashed border-base-300 bg-base-200/40 p-4 shadow-inner"
    >
      <div className="flex h-full items-end gap-2 opacity-60">
        {Array.from({ length: 8 }).map((_, index) => (
          <div
            key={index}
            className="flex-1 rounded bg-base-100/70"
            style={{ height: `${30 + index * 4}%`, animation: 'pulse 1.8s ease-in-out infinite' }}
          />
        ))}
      </div>
    </div>
  );
}
