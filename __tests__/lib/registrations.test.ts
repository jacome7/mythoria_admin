import {
  normalizeRegistrationAggregation,
  type RegistrationAggregation,
} from '@/lib/analytics/registrations';

describe('normalizeRegistrationAggregation', () => {
  it('fills missing daily buckets and tracks cumulative totals', () => {
    const aggregation: RegistrationAggregation = {
      range: '7d',
      granularity: 'day',
      startDate: '2025-11-10T00:00:00.000Z',
      endDate: '2025-11-12T00:00:00.000Z',
      buckets: [
        { bucketStart: '2025-11-10T00:00:00.000Z', registrations: 2 },
        { bucketStart: '2025-11-12T00:00:00.000Z', registrations: 3 },
      ],
    };

    const points = normalizeRegistrationAggregation(aggregation);

    expect(points).toHaveLength(3);
    expect(points[1].count).toBe(0);
    expect(points[2].cumulativeCount).toBe(5);
    expect(points[0].label).toBe('10-nov');
  });

  it('fills missing months for forever range', () => {
    const aggregation: RegistrationAggregation = {
      range: 'forever',
      granularity: 'month',
      startDate: '2025-01-01T00:00:00.000Z',
      endDate: '2025-03-01T00:00:00.000Z',
      buckets: [{ bucketStart: '2025-01-01T00:00:00.000Z', registrations: 5 }],
    };

    const points = normalizeRegistrationAggregation(aggregation);

    expect(points).toHaveLength(3);
    expect(points[1].count).toBe(0);
    expect(points[2].cumulativeCount).toBe(5);
    expect(points[2].label).toBe('mar-25');
  });
});
