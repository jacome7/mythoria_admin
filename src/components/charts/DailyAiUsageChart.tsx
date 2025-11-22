'use client';

import { useMemo } from 'react';
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

export interface DailyAiUsagePoint {
  date: string;
  totalCost: number;
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  requests: number;
}

interface DailyAiUsageChartProps {
  data: DailyAiUsagePoint[];
  currencyFormatter: Intl.NumberFormat;
  granularity?: 'day' | 'month';
}

type ChartDatum = DailyAiUsagePoint & {
  label: string;
  tokensInMillions: number;
};

const COLORS = {
  cost: '#2563eb',
  tokens: '#a855f7',
  grid: 'rgba(148, 163, 184, 0.3)',
};

export default function DailyAiUsageChart({ data, currencyFormatter, granularity = 'day' }: DailyAiUsageChartProps) {
  const chartData: ChartDatum[] = useMemo(
    () =>
      data.map((point) => ({
        ...point,
        label: formatLabel(point.date, granularity),
        tokensInMillions: Number(point.totalTokens ?? 0) / 1_000_000,
      })),
    [data, granularity],
  );

  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={chartData} margin={{ top: 8, right: 0, bottom: 8, left: -12 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} />
        <XAxis dataKey="label" interval={0} tick={{ fontSize: 11 }} />
        <YAxis
          yAxisId="cost"
          tickFormatter={(value: number) => currencyFormatter.format(Number(value))}
          width={72}
        />
        <YAxis
          yAxisId="tokens"
          orientation="right"
          tickFormatter={(value: number) => `${Number(value).toFixed(1)}M`}
          width={48}
        />
        <Tooltip content={<CustomTooltip currencyFormatter={currencyFormatter} />} cursor={{ fill: 'rgba(59,130,246,0.08)' }} />
        <Bar
          dataKey="totalCost"
          yAxisId="cost"
          name="Cost"
          fill={COLORS.cost}
          radius={[6, 6, 0, 0]}
        />
        <Line
          type="monotone"
          dataKey="tokensInMillions"
          yAxisId="tokens"
          stroke={COLORS.tokens}
          strokeWidth={2}
          dot={false}
          name="Tokens"
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

function CustomTooltip({
  active,
  payload,
  currencyFormatter,
}: {
  active?: boolean;
  payload?: { payload: ChartDatum }[];
  currencyFormatter: Intl.NumberFormat;
}) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  return (
    <div className="rounded-lg border border-base-200 bg-base-100 px-3 py-2 text-sm shadow">
      <p className="font-semibold">{formatFullDate(point.date)}</p>
      <p>Cost: {currencyFormatter.format(point.totalCost)}</p>
      <p>Tokens: {point.tokensInMillions.toFixed(2)}M</p>
      <p>Requests: {point.requests.toLocaleString()}</p>
    </div>
  );
}

function formatLabel(value: string, granularity: 'day' | 'month') {
  const date = new Date(value);
  if (granularity === 'month') {
    return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
  }
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatFullDate(value: string) {
  const date = new Date(value);
  const hasDay = value.includes('T') || value.split('-').length === 3;
  if (hasDay && value.split('-')[2] !== '01') {
    return date.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      weekday: 'short',
      timeZone: 'UTC',
    });
  }
  return date.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}
