import type { NormalizedRegistrationBucket } from './registrations';
import type { NormalizedRevenueBucket } from './revenue';
import type { NormalizedServiceUsageBucket, ServiceUsageEventType } from './service-usage';
import { SERVICE_USAGE_EVENT_TYPES } from './service-usage';

const EMPTY_EVENTS: Record<ServiceUsageEventType, { actions: number; credits: number }> =
  SERVICE_USAGE_EVENT_TYPES.reduce(
    (acc, t) => {
      acc[t] = { actions: 0, credits: 0 };
      return acc;
    },
    {} as Record<ServiceUsageEventType, { actions: number; credits: number }>,
  );

export interface ProjectStatisticsDailyBucket {
  dateKey: string;
  newRegistrations: number;
  revenue: number;
  transactions: number;
  totalServiceActions: number;
  totalServiceCredits: number;
  serviceUsageByEvent: Record<ServiceUsageEventType, { actions: number; credits: number }>;
  aiCostEUR: number;
  aiTokens: number;
  aiRequests: number;
  newStories: number;
  creditsGranted: number;
  newTickets: number;
}

function mergeKey(isoDate: string, granularity: 'day' | 'month'): string {
  return granularity === 'day' ? isoDate.slice(0, 10) : isoDate.slice(0, 7);
}

function mergeKeyFromAiDate(dateStr: string, granularity: 'day' | 'month'): string {
  const dt = new Date(dateStr);
  if (Number.isNaN(dt.getTime())) {
    return dateStr.slice(0, granularity === 'day' ? 10 : 7);
  }
  if (granularity === 'day') {
    return dt.toISOString().slice(0, 10);
  }
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** Merges normalized dashboard series (same window + granularity) into one timeline. */
export function mergeProjectStatisticsDailySeries(
  granularity: 'day' | 'month',
  normReg: NormalizedRegistrationBucket[],
  normRev: NormalizedRevenueBucket[],
  normSu: NormalizedServiceUsageBucket[],
  normStories: NormalizedRegistrationBucket[],
  normGrants: NormalizedRegistrationBucket[],
  normTickets: NormalizedRegistrationBucket[],
  aiDaily: { date: string; totalCost: number; totalTokens: number; requests: number }[],
): ProjectStatisticsDailyBucket[] {
  const keys = new Set<string>();
  for (const b of normReg) keys.add(mergeKey(b.date, granularity));
  for (const b of normRev) keys.add(mergeKey(b.date, granularity));
  for (const b of normSu) keys.add(mergeKey(b.date, granularity));
  for (const b of normStories) keys.add(mergeKey(b.date, granularity));
  for (const b of normGrants) keys.add(mergeKey(b.date, granularity));
  for (const b of normTickets) keys.add(mergeKey(b.date, granularity));
  for (const d of aiDaily) keys.add(mergeKeyFromAiDate(d.date, granularity));

  const sortedKeys = [...keys].sort((a, b) => a.localeCompare(b));

  const regByK = new Map<string, number>();
  for (const b of normReg) regByK.set(mergeKey(b.date, granularity), b.count);

  const revByK = new Map<string, { revenue: number; transactions: number }>();
  for (const b of normRev) {
    revByK.set(mergeKey(b.date, granularity), {
      revenue: b.revenue,
      transactions: b.transactions,
    });
  }

  const suByK = new Map<
    string,
    {
      events: Record<ServiceUsageEventType, { actions: number; credits: number }>;
      totalActions: number;
      totalCredits: number;
    }
  >();
  for (const b of normSu) {
    suByK.set(mergeKey(b.date, granularity), {
      events: { ...EMPTY_EVENTS, ...b.events },
      totalActions: b.totalActions,
      totalCredits: b.totalCredits,
    });
  }

  const storiesByK = new Map<string, number>();
  for (const b of normStories) storiesByK.set(mergeKey(b.date, granularity), b.count);

  const grantsByK = new Map<string, number>();
  for (const b of normGrants) grantsByK.set(mergeKey(b.date, granularity), b.count);

  const ticketsByK = new Map<string, number>();
  for (const b of normTickets) ticketsByK.set(mergeKey(b.date, granularity), b.count);

  const aiByK = new Map<string, { totalCost: number; totalTokens: number; requests: number }>();
  for (const d of aiDaily) {
    aiByK.set(mergeKeyFromAiDate(d.date, granularity), {
      totalCost: d.totalCost,
      totalTokens: d.totalTokens,
      requests: d.requests,
    });
  }

  return sortedKeys.map((dateKey) => {
    const rev = revByK.get(dateKey);
    const su = suByK.get(dateKey);
    return {
      dateKey,
      newRegistrations: regByK.get(dateKey) ?? 0,
      revenue: rev?.revenue ?? 0,
      transactions: rev?.transactions ?? 0,
      totalServiceActions: su?.totalActions ?? 0,
      totalServiceCredits: su?.totalCredits ?? 0,
      serviceUsageByEvent: su?.events ?? { ...EMPTY_EVENTS },
      aiCostEUR: aiByK.get(dateKey)?.totalCost ?? 0,
      aiTokens: aiByK.get(dateKey)?.totalTokens ?? 0,
      aiRequests: aiByK.get(dateKey)?.requests ?? 0,
      newStories: storiesByK.get(dateKey) ?? 0,
      creditsGranted: grantsByK.get(dateKey) ?? 0,
      newTickets: ticketsByK.get(dateKey) ?? 0,
    };
  });
}
