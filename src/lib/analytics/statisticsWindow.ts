import {
  isRegistrationRange,
  type RegistrationGranularity,
  type RegistrationRange,
  startOfUtcDay,
} from './registrations';

/** Max inclusive day span for custom or preset daily windows (inclusive of both ends). */
export const MAX_STATISTICS_DAY_SPAN = 366;

export type ResolvedStatisticsWindow =
  | {
      kind: 'bounded';
      start: Date;
      end: Date;
      granularity: RegistrationGranularity;
      /** Preset that produced this window, when applicable */
      presetRange?: Exclude<RegistrationRange, 'forever'>;
    }
  | {
      kind: 'forever';
      granularity: 'month';
    };

export class StatisticsWindowError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StatisticsWindowError';
  }
}

const PRESET_DAYS: Record<Exclude<RegistrationRange, 'forever'>, number> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
};

function parseIsoDateToUtcDay(iso: string): Date {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    throw new StatisticsWindowError(`Invalid date: ${iso}`);
  }
  return startOfUtcDay(d);
}

function inclusiveDayCount(start: Date, end: Date): number {
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)));
}

export interface ResolveStatisticsWindowInput {
  range?: RegistrationRange | null;
  startDate?: string | null;
  endDate?: string | null;
}

/**
 * Resolve analytics window: either preset `range`, custom ISO `startDate`/`endDate` (UTC day boundaries), or `forever` (monthly, unbounded).
 * `range` and (`startDate`/`endDate`) must not be combined.
 */
export function resolveStatisticsWindow(
  input: ResolveStatisticsWindowInput,
): ResolvedStatisticsWindow {
  const hasPreset = input.range != null;
  const hasCustom = input.startDate != null || input.endDate != null;

  if (hasPreset && hasCustom) {
    throw new StatisticsWindowError('Provide either range or startDate/endDate, not both');
  }

  if (hasPreset) {
    const range = input.range as string;
    if (!isRegistrationRange(range)) {
      throw new StatisticsWindowError(`Invalid range: ${range}`);
    }
    if (range === 'forever') {
      return { kind: 'forever', granularity: 'month' };
    }
    const days = PRESET_DAYS[range];
    const today = startOfUtcDay(new Date());
    const start = new Date(today);
    start.setUTCDate(start.getUTCDate() - (days - 1));
    return {
      kind: 'bounded',
      start,
      end: today,
      granularity: 'day',
      presetRange: range,
    };
  }

  if (hasCustom) {
    if (!input.startDate || !input.endDate) {
      throw new StatisticsWindowError(
        'Both startDate and endDate are required for a custom window',
      );
    }
    const start = parseIsoDateToUtcDay(input.startDate);
    const end = parseIsoDateToUtcDay(input.endDate);
    if (start.getTime() > end.getTime()) {
      throw new StatisticsWindowError('startDate must be on or before endDate');
    }
    const span = inclusiveDayCount(start, end) + 1;
    if (span > MAX_STATISTICS_DAY_SPAN) {
      throw new StatisticsWindowError(
        `Date window spans ${span} days; maximum is ${MAX_STATISTICS_DAY_SPAN} for daily statistics`,
      );
    }
    return {
      kind: 'bounded',
      start,
      end,
      granularity: 'day',
    };
  }

  throw new StatisticsWindowError('Provide range or both startDate and endDate');
}

/** Last millisecond of the UTC calendar day for `input` (after normalizing to UTC midnight). */
export function endOfUtcDayInclusive(input: Date): Date {
  const d = startOfUtcDay(input);
  d.setUTCHours(23, 59, 59, 999);
  return d;
}
