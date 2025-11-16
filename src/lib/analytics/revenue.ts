import type { RegistrationGranularity, RegistrationRange } from './registrations';

const DAY_IN_MS = 24 * 60 * 60 * 1000;
const CENTS_IN_UNIT = 100;

export interface RawRevenueBucket {
  bucketStart: string;
  revenueCents: number;
  transactions: number;
}

export interface RevenueAggregation {
  range: RegistrationRange;
  granularity: RegistrationGranularity;
  startDate: string;
  endDate: string;
  buckets: RawRevenueBucket[];
}

export interface NormalizedRevenueBucket {
  date: string;
  label: string;
  revenue: number;
  revenueCents: number;
  transactions: number;
  averageOrderValue: number;
  weekday: number | null;
  isWeekend: boolean;
  granularity: RegistrationGranularity;
}

export function normalizeRevenueAggregation(
  aggregation: RevenueAggregation,
): NormalizedRevenueBucket[] {
  return aggregation.granularity === 'day'
    ? normalizeDailyAggregation(aggregation)
    : normalizeMonthlyAggregation(aggregation);
}

function normalizeDailyAggregation(aggregation: RevenueAggregation): NormalizedRevenueBucket[] {
  const start = startOfUtcDay(new Date(aggregation.startDate));
  const end = startOfUtcDay(new Date(aggregation.endDate));
  const totalDays = Math.max(0, Math.round((end.getTime() - start.getTime()) / DAY_IN_MS));
  const bucketMap = new Map(
    aggregation.buckets.map((bucket) => [formatDateKey(bucket.bucketStart, 'day'), bucket]),
  );

  const buckets: NormalizedRevenueBucket[] = [];
  let cursor = new Date(start);

  for (let index = 0; index <= totalDays; index++) {
    buckets.push(buildBucket(cursor, 'day', bucketMap));
    cursor = new Date(cursor.getTime() + DAY_IN_MS);
  }

  return buckets;
}

function normalizeMonthlyAggregation(aggregation: RevenueAggregation): NormalizedRevenueBucket[] {
  const start = startOfUtcMonth(new Date(aggregation.startDate));
  const end = startOfUtcMonth(new Date(aggregation.endDate));
  const totalMonths = Math.max(0, diffInMonths(start, end));
  const bucketMap = new Map(
    aggregation.buckets.map((bucket) => [formatDateKey(bucket.bucketStart, 'month'), bucket]),
  );

  const buckets: NormalizedRevenueBucket[] = [];
  let cursor = new Date(start);

  for (let index = 0; index <= totalMonths; index++) {
    buckets.push(buildBucket(cursor, 'month', bucketMap));
    cursor = incrementMonth(cursor);
  }

  return buckets;
}

function buildBucket(
  cursor: Date,
  granularity: RegistrationGranularity,
  bucketMap: Map<string, RawRevenueBucket>,
): NormalizedRevenueBucket {
  const key = formatDateKey(cursor.toISOString(), granularity);
  const raw = bucketMap.get(key);
  const revenueCents = raw?.revenueCents ?? 0;
  const transactions = raw?.transactions ?? 0;
  const revenue = revenueCents / CENTS_IN_UNIT;
  const averageOrderValue = transactions ? revenue / transactions : 0;
  const weekday = granularity === 'day' ? cursor.getUTCDay() : null;

  return {
    date: cursor.toISOString(),
    label: granularity === 'day' ? formatDailyLabel(cursor) : formatMonthlyLabel(cursor),
    revenue,
    revenueCents,
    transactions,
    averageOrderValue,
    weekday,
    isWeekend: weekday != null ? weekday === 0 || weekday === 6 : false,
    granularity,
  };
}

function startOfUtcDay(input: Date): Date {
  const date = new Date(input);
  date.setUTCHours(0, 0, 0, 0);
  return date;
}

function startOfUtcMonth(input: Date): Date {
  const date = startOfUtcDay(input);
  date.setUTCDate(1);
  return date;
}

function diffInMonths(start: Date, end: Date): number {
  return (
    (end.getUTCFullYear() - start.getUTCFullYear()) * 12 + (end.getUTCMonth() - start.getUTCMonth())
  );
}

function incrementMonth(input: Date): Date {
  const date = startOfUtcMonth(input);
  date.setUTCMonth(date.getUTCMonth() + 1);
  return date;
}

function formatDateKey(value: string | Date, granularity: RegistrationGranularity): string {
  const date = new Date(value);
  if (granularity === 'day') {
    const month = `${date.getUTCMonth() + 1}`.padStart(2, '0');
    const day = `${date.getUTCDate()}`.padStart(2, '0');
    return `${date.getUTCFullYear()}-${month}-${day}`;
  }

  return `${date.getUTCFullYear()}-${`${date.getUTCMonth() + 1}`.padStart(2, '0')}`;
}

function formatDailyLabel(date: Date): string {
  const day = `${date.getUTCDate()}`.padStart(2, '0');
  const month = date.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' }).toLowerCase();
  return `${day}-${month}`;
}

function formatMonthlyLabel(date: Date): string {
  const month = date.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' }).toLowerCase();
  const year = `${date.getUTCFullYear()}`.slice(-2);
  return `${month}-${year}`;
}
