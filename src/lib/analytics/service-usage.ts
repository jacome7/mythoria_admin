import type { RegistrationGranularity, RegistrationRange } from './registrations';

const DAY_IN_MS = 24 * 60 * 60 * 1000;

export const SERVICE_USAGE_EVENT_TYPES = [
  'eBookGeneration',
  'audioBookGeneration',
  'printOrder',
  'selfPrinting',
  'textEdit',
  'imageEdit',
] as const;

export type ServiceUsageEventType = (typeof SERVICE_USAGE_EVENT_TYPES)[number];

export interface RawServiceUsageRow {
  bucketStart: string;
  eventType: ServiceUsageEventType;
  actionCount: number;
  creditsSpent: number; // Always positive (absolute value)
}

export interface ServiceUsageAggregation {
  range: RegistrationRange;
  granularity: RegistrationGranularity;
  startDate: string;
  endDate: string;
  rows: RawServiceUsageRow[];
}

export interface NormalizedServiceUsageBucket {
  date: string;
  label: string;
  weekday: number | null;
  isWeekend: boolean;
  isSaturday: boolean;
  isSunday: boolean;
  granularity: RegistrationGranularity;
  events: Record<ServiceUsageEventType, { actions: number; credits: number }>;
  totalActions: number;
  totalCredits: number;
}

export function normalizeServiceUsageAggregation(
  aggregation: ServiceUsageAggregation,
): NormalizedServiceUsageBucket[] {
  return aggregation.granularity === 'day'
    ? normalizeDailyAggregation(aggregation)
    : normalizeMonthlyAggregation(aggregation);
}

function normalizeDailyAggregation(
  aggregation: ServiceUsageAggregation,
): NormalizedServiceUsageBucket[] {
  const start = startOfUtcDay(new Date(aggregation.startDate));
  const end = startOfUtcDay(new Date(aggregation.endDate));
  const totalDays = Math.max(0, Math.round((end.getTime() - start.getTime()) / DAY_IN_MS));

  const dataMap = aggregateRows(aggregation.rows, 'day');

  const buckets: NormalizedServiceUsageBucket[] = [];
  let cursor = new Date(start);

  for (let index = 0; index <= totalDays; index++) {
    buckets.push(buildBucket(cursor, 'day', dataMap));
    cursor = new Date(cursor.getTime() + DAY_IN_MS);
  }

  return buckets;
}

function normalizeMonthlyAggregation(
  aggregation: ServiceUsageAggregation,
): NormalizedServiceUsageBucket[] {
  const start = startOfUtcMonth(new Date(aggregation.startDate));
  const end = startOfUtcMonth(new Date(aggregation.endDate));
  const totalMonths = Math.max(0, diffInMonths(start, end));

  const dataMap = aggregateRows(aggregation.rows, 'month');

  const buckets: NormalizedServiceUsageBucket[] = [];
  let cursor = new Date(start);

  for (let index = 0; index <= totalMonths; index++) {
    buckets.push(buildBucket(cursor, 'month', dataMap));
    cursor = incrementMonth(cursor);
  }

  return buckets;
}

function aggregateRows(
  rows: RawServiceUsageRow[],
  granularity: RegistrationGranularity,
): Map<string, Map<ServiceUsageEventType, { actions: number; credits: number }>> {
  const map = new Map<string, Map<ServiceUsageEventType, { actions: number; credits: number }>>();

  rows.forEach((row) => {
    const key = formatDateKey(row.bucketStart, granularity);
    const eventMap = map.get(key) ?? new Map();
    eventMap.set(row.eventType, {
      actions: row.actionCount,
      credits: row.creditsSpent,
    });
    map.set(key, eventMap);
  });

  return map;
}

function buildBucket(
  cursor: Date,
  granularity: RegistrationGranularity,
  dataMap: Map<string, Map<ServiceUsageEventType, { actions: number; credits: number }>>,
): NormalizedServiceUsageBucket {
  const key = formatDateKey(cursor.toISOString(), granularity);
  const eventMap = dataMap.get(key);

  const events: Record<ServiceUsageEventType, { actions: number; credits: number }> =
    Object.fromEntries(
      SERVICE_USAGE_EVENT_TYPES.map((eventType) => {
        const payload = eventMap?.get(eventType);
        return [
          eventType,
          {
            actions: payload?.actions ?? 0,
            credits: payload?.credits ?? 0,
          },
        ];
      }),
    ) as Record<ServiceUsageEventType, { actions: number; credits: number }>;

  const totalActions = SERVICE_USAGE_EVENT_TYPES.reduce(
    (sum, eventType) => sum + events[eventType].actions,
    0,
  );
  const totalCredits = SERVICE_USAGE_EVENT_TYPES.reduce(
    (sum, eventType) => sum + events[eventType].credits,
    0,
  );

  const weekday = granularity === 'day' ? cursor.getUTCDay() : null;

  return {
    date: cursor.toISOString(),
    label: granularity === 'day' ? formatDailyLabel(cursor) : formatMonthlyLabel(cursor),
    weekday,
    isWeekend: weekday != null ? weekday === 0 || weekday === 6 : false,
    isSaturday: weekday === 6,
    isSunday: weekday === 0,
    granularity,
    events,
    totalActions,
    totalCredits,
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
