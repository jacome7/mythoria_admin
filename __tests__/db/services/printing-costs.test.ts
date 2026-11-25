/** @jest-environment node */
import { PgDialect } from 'drizzle-orm/pg-core';
import { getPrintingCosts, getPrintingCostRequests } from '@/db/services/printing-costs';
import { getMythoriaDb } from '@/db';

jest.mock('@/db', () => ({ getMythoriaDb: jest.fn() }));
const execute = jest.fn();
const dialect = new PgDialect();

beforeEach(() => {
  jest.useFakeTimers().setSystemTime(new Date('2026-11-24T12:00:00Z'));
  jest.mocked(getMythoriaDb).mockReturnValue({ execute } as never);
  execute.mockReset();
});
afterEach(() => jest.useRealTimers());

it('fills UTC days and distinguishes missing FX from missing production job prices', async () => {
  execute.mockResolvedValueOnce({
    rows: [
      {
        date: '2026-11-23T00:00:00.000Z',
        total: '12.34',
        total_cost: '12.34',
        pending_conversion: '2',
        pending_price: '1',
      },
    ],
  });
  const result = await getPrintingCosts('7d');
  expect(result.buckets).toHaveLength(7);
  expect(result.buckets[5]).toEqual({ date: '2026-11-23T00:00:00.000Z', totalCost: 12.34 });
  expect(result.buckets[6].totalCost).toBe(0);
  expect(result).toMatchObject({
    totalCost: 12.34,
    pendingConversionCount: 2,
    pendingPriceCount: 1,
  });
  const pendingSql = dialect.sqlToQuery(execute.mock.calls[0][0]);
  expect(pendingSql.sql).toContain("f.vendor->>'environment' = 'production'");
  expect(pendingSql.sql).toContain('c.print_request_id IS NULL');
  expect(pendingSql.params).toContain('2026-11-18T00:00:00.000Z');
  expect(pendingSql.params).toContain('2026-11-25T00:00:00.000Z');
});

it('fills missing calendar months in all-time totals', async () => {
  execute.mockResolvedValueOnce({
    rows: [
      {
        date: '2026-01-01T00:00:00.000Z',
        total: '1',
        total_cost: '3',
        pending_conversion: '0',
        pending_price: '0',
      },
      {
        date: '2026-03-01T00:00:00.000Z',
        total: '2',
        total_cost: '3',
        pending_conversion: '0',
        pending_price: '0',
      },
    ],
  });
  const result = await getPrintingCosts('forever');
  expect(result.granularity).toBe('month');
  expect(result.buckets.map((b) => b.totalCost)).toEqual([1, 0, 2]);
});

it('preserves nullable request and price fields and paginates deterministically', async () => {
  execute
    .mockResolvedValueOnce({
      rows: [
        {
          id: 'id',
          requested_at: '2026-11-24T10:00:00Z',
          title: null,
          copies: null,
          provider: 'legacy',
          status: 'requested',
          vendor_status: null,
          sandbox: true,
          ticket_id: null,
          amount: null,
          currency: null,
          amount_eur: null,
        },
      ],
    })
    .mockResolvedValueOnce({ rows: [{ total: '26' }] });
  const result = await getPrintingCostRequests('30d', 2);
  expect(result).toMatchObject({
    page: 2,
    pageSize: 25,
    total: 26,
    requests: [{ title: null, cost: null, provider: 'legacy', sandbox: true }],
  });
  const query = dialect.sqlToQuery(execute.mock.calls[0][0]);
  expect(query.sql).toContain('LEFT JOIN print_fulfillments');
  expect(query.sql).toContain("f.email_variables->>'storyTitle'");
  expect(query.sql).toContain("f.vendor->>'environment' = 'sandbox'");
  expect(query.sql).toContain('r.status::text AS status');
  expect(query.params).toContain(25);
});
