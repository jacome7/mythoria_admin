import {
  MAX_STATISTICS_DAY_SPAN,
  resolveStatisticsWindow,
  StatisticsWindowError,
} from '@/lib/analytics/statisticsWindow';

describe('resolveStatisticsWindow', () => {
  it('resolves preset 7d as bounded daily window', () => {
    const w = resolveStatisticsWindow({ range: '7d' });
    expect(w.kind).toBe('bounded');
    if (w.kind !== 'bounded') return;
    expect(w.granularity).toBe('day');
    expect(w.end.getTime()).toBeGreaterThanOrEqual(w.start.getTime());
  });

  it('resolves forever as monthly unbounded', () => {
    const w = resolveStatisticsWindow({ range: 'forever' });
    expect(w).toEqual({ kind: 'forever', granularity: 'month' });
  });

  it('rejects range and custom dates together', () => {
    expect(() =>
      resolveStatisticsWindow({
        range: '30d',
        startDate: '2025-01-01',
        endDate: '2025-01-31',
      }),
    ).toThrow(StatisticsWindowError);
  });

  it('rejects custom window exceeding max day span', () => {
    expect(() =>
      resolveStatisticsWindow({
        startDate: '2025-01-01',
        endDate: '2026-01-08',
      }),
    ).toThrow(StatisticsWindowError);
  });

  it('accepts custom window at exactly max inclusive days', () => {
    const start = new Date('2025-01-01T00:00:00.000Z');
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + (MAX_STATISTICS_DAY_SPAN - 1));
    const w = resolveStatisticsWindow({
      startDate: start.toISOString(),
      endDate: end.toISOString(),
    });
    expect(w.kind).toBe('bounded');
  });

  it('requires both startDate and endDate', () => {
    expect(() => resolveStatisticsWindow({ startDate: '2025-01-01' })).toThrow(
      StatisticsWindowError,
    );
  });
});
