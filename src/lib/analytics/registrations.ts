const DAY_IN_MS = 24 * 60 * 60 * 1000;

export const REGISTRATION_RANGES = ['7d', '30d', '90d', 'forever'] as const;
export type RegistrationRange = (typeof REGISTRATION_RANGES)[number];
export type RegistrationGranularity = 'day' | 'month';

export interface RawRegistrationBucket {
  bucketStart: string;
  registrations: number;
}

export interface RegistrationAggregation {
  range: RegistrationRange;
  granularity: RegistrationGranularity;
  startDate: string;
  endDate: string;
  buckets: RawRegistrationBucket[];
}

export interface NormalizedRegistrationBucket {
  date: string;
  label: string;
  count: number;
  cumulativeCount: number;
  weekday: number | null;
  isWeekend: boolean;
  isSaturday: boolean;
  isSunday: boolean;
  isMonday: boolean;
  granularity: RegistrationGranularity;
}

export function isRegistrationRange(value: string | null | undefined): value is RegistrationRange {
  return REGISTRATION_RANGES.includes((value as RegistrationRange) ?? '');
}

export function normalizeRegistrationAggregation(
  aggregation: RegistrationAggregation,
): NormalizedRegistrationBucket[] {
  return aggregation.granularity === 'day'
    ? normalizeDailyAggregation(aggregation)
    : normalizeMonthlyAggregation(aggregation);
}

function normalizeDailyAggregation(
  aggregation: RegistrationAggregation,
): NormalizedRegistrationBucket[] {
  const start = startOfUtcDay(new Date(aggregation.startDate));
  const end = startOfUtcDay(new Date(aggregation.endDate));
  const bucketMap = new Map(
    aggregation.buckets.map((bucket) => [
      formatDateKey(bucket.bucketStart, 'day'),
      bucket.registrations,
    ]),
  );
  const totalDays = Math.max(0, Math.round((end.getTime() - start.getTime()) / DAY_IN_MS));

  const points: NormalizedRegistrationBucket[] = [];
  let cursor = new Date(start);
  let cumulative = 0;

  for (let index = 0; index <= totalDays; index++) {
    const key = formatDateKey(cursor.toISOString(), 'day');
    const count = bucketMap.get(key) ?? 0;
    cumulative += count;
    const weekday = cursor.getUTCDay();
    const label = formatDailyLabel(cursor);

    points.push({
      date: cursor.toISOString(),
      label,
      count,
      cumulativeCount: cumulative,
      weekday,
      isWeekend: weekday === 0 || weekday === 6,
      isSaturday: weekday === 6,
      isSunday: weekday === 0,
      isMonday: weekday === 1,
      granularity: 'day',
    });

    cursor = new Date(cursor.getTime() + DAY_IN_MS);
  }

  return points;
}

function normalizeMonthlyAggregation(
  aggregation: RegistrationAggregation,
): NormalizedRegistrationBucket[] {
  const start = startOfUtcMonth(new Date(aggregation.startDate));
  const end = startOfUtcMonth(new Date(aggregation.endDate));
  const bucketMap = new Map(
    aggregation.buckets.map((bucket) => [
      formatDateKey(bucket.bucketStart, 'month'),
      bucket.registrations,
    ]),
  );
  const totalMonths = Math.max(0, diffInMonths(start, end));

  const points: NormalizedRegistrationBucket[] = [];
  let cursor = new Date(start);
  let cumulative = 0;

  for (let index = 0; index <= totalMonths; index++) {
    const key = formatDateKey(cursor.toISOString(), 'month');
    const count = bucketMap.get(key) ?? 0;
    cumulative += count;

    points.push({
      date: cursor.toISOString(),
      label: formatMonthlyLabel(cursor),
      count,
      cumulativeCount: cumulative,
      weekday: null,
      isWeekend: false,
      isSaturday: false,
      isSunday: false,
      isMonday: false,
      granularity: 'month',
    });

    cursor = incrementMonth(cursor);
  }

  return points;
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
