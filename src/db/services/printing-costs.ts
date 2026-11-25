import { sql, type SQL } from 'drizzle-orm';
import { getMythoriaDb } from '@/db';
import { printFulfillmentCostsRead, printFulfillmentsRead } from '@/db/schema/print-costs';
import {
  resolveStatisticsWindow,
  type ResolvedStatisticsWindow,
} from '@/lib/analytics/statisticsWindow';
import { type RegistrationRange, startOfUtcDay } from '@/lib/analytics/registrations';

const PAGE_SIZE = 25;

function windowFilter(column: SQL, window: ResolvedStatisticsWindow): SQL {
  if (window.kind === 'forever') return sql`true`;
  const end = new Date(window.end);
  end.setUTCDate(end.getUTCDate() + 1);
  return sql`${column} >= ${window.start.toISOString()}::timestamptz AND ${column} < ${end.toISOString()}::timestamptz`;
}

function fillBuckets(
  range: RegistrationRange,
  window: ResolvedStatisticsWindow,
  rows: { date: string; total: string }[],
) {
  const values = new Map(rows.map((row) => [new Date(row.date).toISOString(), Number(row.total)]));
  let start: Date;
  let end: Date;
  if (window.kind === 'forever') {
    const today = startOfUtcDay(new Date());
    today.setUTCDate(1);
    start = rows.length ? new Date(rows[0].date) : today;
    end = rows.length ? new Date(rows[rows.length - 1].date) : today;
  } else {
    start = new Date(window.start);
    end = window.end;
  }
  const buckets: { date: string; totalCost: number }[] = [];
  for (const cursor = new Date(start); cursor <= end;) {
    const date = cursor.toISOString();
    buckets.push({ date, totalCost: values.get(date) ?? 0 });
    if (range === 'forever') cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    else cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return buckets;
}

export async function getPrintingCosts(range: RegistrationRange) {
  const db = getMythoriaDb();
  const window = resolveStatisticsWindow({ range });
  const interval = window.granularity === 'month' ? sql.raw("'month'") : sql.raw("'day'");
  // A single statement gives every total and bucket the same PostgreSQL snapshot.
  const result = await db.execute<{
    date: string | null;
    total: string | null;
    pending_conversion: string;
    total_cost: string;
    pending_price: string;
  }>(sql`
    WITH filtered_costs AS (
      SELECT * FROM ${printFulfillmentCostsRead}
      WHERE ${windowFilter(sql`job_created_at`, window)}
    ), buckets AS (
      SELECT (date_trunc(${interval}, job_created_at AT TIME ZONE 'UTC') AT TIME ZONE 'UTC') AS date,
        COALESCE(SUM(amount_eur), 0)::text AS total
      FROM filtered_costs GROUP BY 1
    ), totals AS (
      SELECT count(*) FILTER (WHERE amount_eur IS NULL)::text AS pending_conversion,
        COALESCE(SUM(amount_eur), 0)::text AS total_cost FROM filtered_costs
    ), pending AS (
      SELECT count(*)::text AS pending_price FROM ${printFulfillmentsRead} f
      LEFT JOIN ${printFulfillmentCostsRead} c ON c.print_request_id = f.print_request_id
      WHERE f.provider = 'lulu' AND f.vendor->>'environment' = 'production'
        AND NULLIF(f.vendor->>'id', '') IS NOT NULL AND NULLIF(f.vendor->>'createdAt', '') IS NOT NULL
        AND c.print_request_id IS NULL
        AND ${windowFilter(sql`(f.vendor->>'createdAt')::timestamptz`, window)}
    )
    SELECT buckets.date, buckets.total, totals.pending_conversion, totals.total_cost, pending.pending_price
    FROM totals CROSS JOIN pending LEFT JOIN buckets ON true ORDER BY buckets.date
  `);
  const buckets = result.rows.flatMap((row) =>
    row.date === null ? [] : [{ date: row.date, total: row.total ?? '0' }],
  );
  return {
    range,
    granularity: window.granularity,
    currency: 'EUR' as const,
    buckets: fillBuckets(range, window, buckets),
    totalCost: Number(result.rows[0]?.total_cost ?? 0),
    pendingConversionCount: Number(result.rows[0]?.pending_conversion ?? 0),
    pendingPriceCount: Number(result.rows[0]?.pending_price ?? 0),
  };
}

export async function getPrintingCostRequests(range: RegistrationRange, page: number) {
  const db = getMythoriaDb();
  const window = resolveStatisticsWindow({ range });
  const where = windowFilter(sql`r.requested_at`, window);
  const rows = await db.execute<{
    id: string;
    requested_at: Date | string;
    title: string | null;
    copies: number | null;
    provider: 'lulu' | 'manual' | 'legacy';
    status: string;
    vendor_status: string | null;
    sandbox: boolean | null;
    ticket_id: string | null;
    amount: string | null;
    currency: string | null;
    amount_eur: string | null;
  }>(sql`
    SELECT r.id, r.requested_at,
      COALESCE(NULLIF(f.email_variables->>'storyTitle', ''), s.title) AS title,
      COALESCE(f.copies, CASE WHEN r.printing_options->>'numberOfCopies' ~ '^[1-9][0-9]{0,8}$'
        THEN (r.printing_options->>'numberOfCopies')::integer END) AS copies,
      CASE WHEN f.provider IN ('lulu', 'manual') THEN f.provider ELSE 'legacy' END AS provider,
      r.status::text AS status, f.vendor->>'status' AS vendor_status,
      f.ticket_id, (f.vendor->>'environment' = 'sandbox') AS sandbox,
      c.amount_excl_tax::text AS amount, c.currency, c.amount_eur::text AS amount_eur
    FROM print_requests r
    LEFT JOIN ${printFulfillmentsRead} f ON f.print_request_id = r.id
    LEFT JOIN ${printFulfillmentCostsRead} c ON c.print_request_id = r.id
    LEFT JOIN stories s ON s.story_id = r.story_id
    WHERE ${where} ORDER BY r.requested_at DESC, r.id DESC
    LIMIT ${PAGE_SIZE} OFFSET ${(page - 1) * PAGE_SIZE}
  `);
  const count = await db.execute<{ total: string }>(sql`
    SELECT count(*)::text AS total FROM print_requests r WHERE ${where}
  `);
  return {
    requests: rows.rows.map((row) => ({
      id: row.id,
      requestedAt: new Date(row.requested_at).toISOString(),
      title: row.title,
      copies: row.copies,
      provider: row.provider,
      status: row.status,
      vendorStatus: row.vendor_status,
      sandbox: row.sandbox ?? false,
      ticketId: row.ticket_id,
      cost:
        row.amount !== null && row.currency !== null
          ? { amount: row.amount, currency: row.currency, amountEur: row.amount_eur }
          : null,
    })),
    page,
    pageSize: PAGE_SIZE,
    total: Number(count.rows[0]?.total ?? 0),
  };
}
