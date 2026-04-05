import { mergeProjectStatisticsDailySeries } from '@/lib/analytics/projectStatisticsMerge';
import {
  normalizeRegistrationAggregation,
  type RegistrationAggregation,
} from '@/lib/analytics/registrations';
import { normalizeRevenueAggregation, type RevenueAggregation } from '@/lib/analytics/revenue';
import {
  normalizeServiceUsageAggregation,
  type ServiceUsageAggregation,
} from '@/lib/analytics/service-usage';

describe('mergeProjectStatisticsDailySeries', () => {
  it('aligns registration, revenue, and AI rows on dateKey', () => {
    const reg: RegistrationAggregation = {
      range: '7d',
      granularity: 'day',
      startDate: '2025-11-10T00:00:00.000Z',
      endDate: '2025-11-11T00:00:00.000Z',
      buckets: [{ bucketStart: '2025-11-10T00:00:00.000Z', registrations: 2 }],
    };
    const rev: RevenueAggregation = {
      range: '7d',
      granularity: 'day',
      startDate: '2025-11-10T00:00:00.000Z',
      endDate: '2025-11-11T00:00:00.000Z',
      buckets: [
        {
          bucketStart: '2025-11-11T00:00:00.000Z',
          revenueCents: 500,
          transactions: 1,
        },
      ],
    };
    const usage: ServiceUsageAggregation = {
      range: '7d',
      granularity: 'day',
      startDate: '2025-11-10T00:00:00.000Z',
      endDate: '2025-11-11T00:00:00.000Z',
      rows: [],
    };

    const normReg = normalizeRegistrationAggregation(reg);
    const normRev = normalizeRevenueAggregation(rev);
    const normSu = normalizeServiceUsageAggregation(usage);
    const emptyReg = normalizeRegistrationAggregation({
      ...reg,
      buckets: [],
    });

    const merged = mergeProjectStatisticsDailySeries(
      'day',
      normReg,
      normRev,
      normSu,
      emptyReg,
      emptyReg,
      emptyReg,
      [{ date: '2025-11-10', totalCost: 1.5, totalTokens: 100, requests: 2 }],
    );

    const nov10 = merged.find((b) => b.dateKey === '2025-11-10');
    const nov11 = merged.find((b) => b.dateKey === '2025-11-11');

    expect(nov10?.newRegistrations).toBe(2);
    expect(nov10?.aiCostEUR).toBe(1.5);
    expect(nov10?.revenue).toBe(0);
    expect(nov11?.revenue).toBe(5);
    expect(nov11?.transactions).toBe(1);
  });
});
