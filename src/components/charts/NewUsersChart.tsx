'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Bar,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  ComposedChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type {
  NormalizedRegistrationBucket,
  RegistrationRange,
} from '@/lib/analytics/registrations';

interface RegistrationsResponse {
  range: RegistrationRange;
  granularity: 'day' | 'month';
  startDate: string;
  endDate: string;
  generatedAt: string;
  totalRegistrations: number;
  buckets: NormalizedRegistrationBucket[];
}

type ForeverMode = 'monthly' | 'cumulative';

const RANGE_OPTIONS: { label: string; value: RegistrationRange }[] = [
  { label: 'Last 7 days', value: '7d' },
  { label: 'Last 30 days', value: '30d' },
  { label: 'Last 90 days', value: '90d' },
  { label: 'Forever', value: 'forever' },
];

const FOREVER_MODE_OPTIONS: { label: string; value: ForeverMode }[] = [
  { label: 'Monthly', value: 'monthly' },
  { label: 'Cumulative', value: 'cumulative' },
];

const COLORS = {
  weekday: '#3b82f6', // DaisyUI blue-500
  weekend: '#f59e0b', // DaisyUI amber-500
  cumulative: '#a855f7', // DaisyUI purple-500
  trend: '#ec4899', // DaisyUI pink-500 for trend line
};

interface ChartDatum extends NormalizedRegistrationBucket {
  value: number;
}

const formatter = new Intl.NumberFormat('en-US');

interface NewUsersChartProps {
  onReady?: () => void;
  range: RegistrationRange;
  onRangeChange: (nextRange: RegistrationRange) => void;
}

export default function NewUsersChart({ onReady, range, onRangeChange }: NewUsersChartProps) {
  const [mode, setMode] = useState<ForeverMode>('monthly');
  const [data, setData] = useState<NormalizedRegistrationBucket[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (range !== 'forever') {
      setMode('monthly');
    }
  }, [range]);

  useEffect(() => {
    if (!isLoading) {
      onReady?.();
    }
  }, [isLoading, onReady]);

  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();

    async function fetchRegistrations() {
      try {
        setIsLoading(true);
        setError(null);
        const response = await fetch(`/api/admin/users/registrations?range=${range}`, {
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new Error(`Failed to load registrations (${response.status})`);
        }
        const payload: RegistrationsResponse = await response.json();
        if (!isMounted) return;
        setData(payload.buckets);
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

    fetchRegistrations();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [range]);

  const metricKey = range === 'forever' && mode === 'cumulative' ? 'cumulativeCount' : 'count';

  const chartData: ChartDatum[] = useMemo(
    () =>
      data.map((bucket) => ({
        ...bucket,
        value: metricKey === 'cumulativeCount' ? bucket.cumulativeCount : bucket.count,
      })),
    [data, metricKey],
  );

  const trendLineData = useMemo(() => {
    if (chartData.length < 2) return [];
    // Calculate linear regression for trend line
    const n = chartData.length;
    const sumX = chartData.reduce((sum, _, i) => sum + i, 0);
    const sumY = chartData.reduce((sum, d) => sum + d.value, 0);
    const sumXY = chartData.reduce((sum, d, i) => sum + i * d.value, 0);
    const sumX2 = chartData.reduce((sum, _, i) => sum + i * i, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    return chartData.map((d, i) => ({
      ...d,
      trend: Math.max(0, slope * i + intercept),
    }));
  }, [chartData]);

  const tickMeta = useMemo(
    () => new Map(chartData.map((point) => [point.label, point])),
    [chartData],
  );

  const renderLegend = () => (
    <div className="flex flex-wrap gap-4 text-xs text-base-content/70">
      <LegendPill color={COLORS.weekday} label="Weekday" />
      <LegendPill color={COLORS.weekend} label="Weekend" />
      {range === 'forever' && mode === 'cumulative' ? (
        <LegendPill color={COLORS.cumulative} label="Cumulative" />
      ) : null}
      <LegendPill color={COLORS.trend} label="Trend" dashed />
    </div>
  );

  const showEmptyState = !isLoading && !chartData.length;

  return (
    <section className="w-full bg-base-100 rounded-2xl shadow-sm border border-base-200 p-2 sm:p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-xl font-semibold">New users</h2>
          <p className="text-sm text-base-content/70">
            Track fresh author registrations over the selected window.
          </p>
        </div>
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
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
          {range === 'forever' ? (
            <div className="join">
              {FOREVER_MODE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={`btn btn-sm join-item ${mode === option.value ? 'btn-secondary' : 'btn-outline'}`}
                  onClick={() => setMode(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <div className="mt-6">{renderLegend()}</div>

      <div className="mt-4 h-80">
        {isLoading ? (
          <ChartAreaPlaceholder label="Loading new users timeline" />
        ) : error ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <p className="font-semibold text-error">Failed to load chart</p>
            <p className="text-sm text-base-content/70">{error}</p>
          </div>
        ) : showEmptyState ? (
          <div className="flex h-full flex-col items-center justify-center text-center text-base-content/70">
            No registrations in this window.
          </div>
        ) : (
          <div className="h-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={trendLineData}
                margin={{ top: 8, left: -12, right: 0, bottom: 8 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.3)" />
                <XAxis
                  dataKey="label"
                  tick={(props) => <CustomTick {...props} meta={tickMeta} />}
                  interval={chartData.length > 14 ? Math.floor(chartData.length / 14) : 0}
                />
                <YAxis
                  width={30}
                  allowDecimals={false}
                  tickMargin={4}
                  tick={{ fontSize: 10 }}
                  tickFormatter={(value) => formatter.format(value)}
                />
                <Tooltip
                  content={<CustomTooltip mode={mode} range={range} />}
                  cursor={{ fill: 'rgba(147, 197, 253, 0.08)' }}
                />
                <Legend wrapperStyle={{ display: 'none' }} />
                <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                  {chartData.map((entry) => (
                    <Cell
                      key={entry.date}
                      fill={getBarFill(entry, range === 'forever' && mode === 'cumulative')}
                    />
                  ))}
                </Bar>
                <Line
                  type="monotone"
                  dataKey="trend"
                  stroke={COLORS.trend}
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={false}
                  activeDot={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </section>
  );
}

interface CustomTickProps {
  x?: number | string;
  y?: number | string;
  payload?: {
    value: string;
  };
  meta: Map<string, ChartDatum>;
}

function CustomTick({ x = 0, y = 0, payload, meta }: CustomTickProps) {
  const label = payload?.value ?? '';
  const point: ChartDatum | undefined = meta.get(label);
  const color = point?.isWeekend ? COLORS.weekend : COLORS.weekday;
  const resolvedY = typeof y === 'number' ? y : Number(y ?? 0);
  const resolvedX = typeof x === 'number' || typeof x === 'string' ? x : 0;
  return (
    <text x={resolvedX} y={resolvedY + 10} fill={color} textAnchor="middle" fontSize={12}>
      {label}
    </text>
  );
}

interface TooltipPayloadEntry {
  payload: ChartDatum;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadEntry[];
  mode: ForeverMode;
  range: RegistrationRange;
}

function CustomTooltip({ active, payload, mode, range }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  const datum: ChartDatum = payload[0].payload;
  return (
    <div className="rounded-lg border border-base-200 bg-base-100 px-3 py-2 text-sm shadow">
      <p className="font-semibold">
        {datum.granularity === 'day' ? formatFullDate(datum.date) : formatFullMonth(datum.date)}
      </p>
      <p>Registrations: {formatter.format(datum.count)}</p>
      {range === 'forever' && mode === 'cumulative' ? (
        <p>Cumulative: {formatter.format(datum.cumulativeCount)}</p>
      ) : null}
    </div>
  );
}

function LegendPill({ color, label, dashed }: { color: string; label: string; dashed?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2">
      {dashed ? (
        <span
          className="inline-flex h-0.5 w-4"
          style={{
            backgroundImage: `repeating-linear-gradient(to right, ${color} 0, ${color} 3px, transparent 3px, transparent 6px)`,
          }}
        />
      ) : (
        <span className="inline-flex h-3 w-3 rounded-full" style={{ backgroundColor: color }} />
      )}
      {label}
    </span>
  );
}

function getBarFill(entry: NormalizedRegistrationBucket, isCumulative: boolean) {
  if (isCumulative) {
    return COLORS.cumulative;
  }
  if (entry.isWeekend) {
    return COLORS.weekend;
  }
  return COLORS.weekday;
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
        {Array.from({ length: 10 }).map((_, index) => (
          <div
            key={index}
            className="flex-1 rounded bg-base-100/70"
            style={{ height: `${20 + index * 5}%`, animation: 'pulse 1.8s ease-in-out infinite' }}
          />
        ))}
      </div>
    </div>
  );
}
