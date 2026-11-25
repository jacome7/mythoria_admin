'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useAdminAuth } from '@/lib/hooks/useAdminAuth';
import type { RegistrationGranularity, RegistrationRange } from '@/lib/analytics/registrations';
import MeasuredChartFrame from '@/components/charts/MeasuredChartFrame';

interface PrintingCostBucket {
  date: string;
  totalCost: number;
}

interface PrintingCostsResponse {
  range: RegistrationRange;
  granularity: RegistrationGranularity;
  currency: string;
  buckets: PrintingCostBucket[];
  totalCost: number;
  pendingConversionCount: number;
  pendingPriceCount: number;
}

interface PrintRequest {
  id: string;
  requestedAt: string;
  title: string | null;
  copies: number | null;
  provider: 'lulu' | 'manual' | 'legacy';
  status: string;
  vendorStatus: string | null;
  sandbox?: boolean;
  ticketId: string | null;
  quotedEur?: string | null;
  totalInclTax?: string | null;
  cost: { amount: string; currency: string; amountEur: string | null } | null;
}

interface PrintRequestsResponse {
  requests: PrintRequest[];
  page: number;
  pageSize: number;
  total: number;
}

interface ChartBucket extends PrintingCostBucket {
  label: string;
}

const RANGE_OPTIONS: { label: string; value: RegistrationRange }[] = [
  { label: 'Last 7 days', value: '7d' },
  { label: 'Last 30 days', value: '30d' },
  { label: 'Last 90 days', value: '90d' },
  { label: 'Forever', value: 'forever' },
];

export default function PrintingCostsPage() {
  const { session, loading: authLoading } = useAdminAuth();
  const [range, setRange] = useState<RegistrationRange>('30d');
  const [page, setPage] = useState(1);
  const [summary, setSummary] = useState<PrintingCostsResponse | null>(null);
  const [requests, setRequests] = useState<PrintRequestsResponse | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [requestsLoading, setRequestsLoading] = useState(true);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [requestsError, setRequestsError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const loadSummary = async () => {
      setSummaryLoading(true);
      setSummaryError(null);
      try {
        const response = await fetch(`/api/admin/printing-costs?range=${range}`, {
          signal: controller.signal,
          cache: 'no-store',
        });
        if (!response.ok) throw new Error(`Could not load printing costs (${response.status})`);
        const payload: PrintingCostsResponse = await response.json();
        if (!controller.signal.aborted) setSummary(payload);
      } catch (error) {
        if (controller.signal.aborted) return;
        setSummaryError(error instanceof Error ? error.message : 'Could not load printing costs');
        setSummary(null);
      } finally {
        if (!controller.signal.aborted) setSummaryLoading(false);
      }
    };
    void loadSummary();
    return () => controller.abort();
  }, [range]);

  useEffect(() => {
    const controller = new AbortController();
    const loadRequests = async () => {
      setRequestsLoading(true);
      setRequestsError(null);
      try {
        const response = await fetch(
          `/api/admin/printing-costs/requests?range=${range}&page=${page}`,
          { signal: controller.signal, cache: 'no-store' },
        );
        if (!response.ok) throw new Error(`Could not load print requests (${response.status})`);
        const payload: PrintRequestsResponse = await response.json();
        if (!controller.signal.aborted) setRequests(payload);
      } catch (error) {
        if (controller.signal.aborted) return;
        setRequestsError(error instanceof Error ? error.message : 'Could not load print requests');
        setRequests(null);
      } finally {
        if (!controller.signal.aborted) setRequestsLoading(false);
      }
    };
    void loadRequests();
    return () => controller.abort();
  }, [page, range]);

  const currencyCode = (summary?.currency || 'EUR').toUpperCase();
  const currencyFormatter = useMemo(
    () =>
      new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currencyCode,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
    [currencyCode],
  );
  const chartData = useMemo(
    () =>
      (summary?.buckets ?? []).map((bucket) => ({
        ...bucket,
        label: bucketLabel(bucket.date, summary?.granularity ?? 'day'),
      })),
    [summary],
  );
  const currentPage = requests?.page ?? page;
  const pageSize = requests?.pageSize ?? 25;
  const total = requests?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / Math.max(pageSize, 1)));
  const firstItem = total ? (currentPage - 1) * pageSize + 1 : 0;
  const lastItem = Math.min(currentPage * pageSize, total);
  const hasIncompleteCosts = Boolean(summary?.pendingConversionCount || summary?.pendingPriceCount);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-base-200">
        <main className="container mx-auto flex h-64 items-center justify-center p-6">
          <span
            className="loading loading-spinner loading-lg"
            aria-label="Loading printing costs"
          />
        </main>
      </div>
    );
  }
  if (!session?.user) return null;

  return (
    <div className="min-h-screen bg-base-200">
      <main className="container mx-auto space-y-8 p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="mb-2 text-3xl font-bold text-base-content">Printing costs</h1>
            <p className="text-base-content/70">
              Track recorded print fulfillment costs and orders that still need pricing or currency
              conversion. Costs exclude tax.
            </p>
          </div>
          <div className="form-control">
            <label className="label" htmlFor="printing-cost-range">
              <span className="label-text">Period</span>
            </label>
            <select
              id="printing-cost-range"
              className="select select-bordered"
              value={range}
              onChange={(event) => {
                setRange(event.target.value as RegistrationRange);
                setPage(1);
              }}
            >
              {RANGE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {summaryError ? (
          <div className="alert alert-error">
            <div>
              <h2 className="font-semibold">Printing costs unavailable</h2>
              <p className="text-sm">{summaryError}</p>
            </div>
          </div>
        ) : (
          <section className="grid grid-cols-1 gap-6 md:grid-cols-3">
            <StatCard
              label={`Recorded cost (${currencyCode})`}
              value={
                summaryLoading ? 'Loading…' : currencyFormatter.format(summary?.totalCost ?? 0)
              }
              subtitle={
                hasIncompleteCosts
                  ? 'Incomplete while some costs are unresolved'
                  : 'Known costs in the selected period'
              }
            />
            <StatCard
              label="Pending currency conversion"
              value={
                summaryLoading
                  ? 'Loading…'
                  : (summary?.pendingConversionCount ?? 0).toLocaleString()
              }
              subtitle="Orders with a source price awaiting EUR conversion"
            />
            <StatCard
              label="Pending price"
              value={
                summaryLoading ? 'Loading…' : (summary?.pendingPriceCount ?? 0).toLocaleString()
              }
              subtitle="Orders without a recorded print price"
            />
          </section>
        )}

        <section className="card bg-base-100 shadow-sm">
          <div className="card-body">
            <h2 className="card-title">Printing costs by verified production job date (UTC)</h2>
            <p className="text-sm text-base-content/70">
              Costs are shown in EUR, exclude tax, and only include prices with a known EUR value.
            </p>
            <div className="mt-4 h-80 min-w-0">
              {summaryLoading ? (
                <div className="flex h-full items-center justify-center">
                  <span
                    className="loading loading-spinner loading-md"
                    aria-label="Loading cost chart"
                  />
                </div>
              ) : summaryError ? (
                <div className="flex h-full items-center justify-center text-sm text-error">
                  {summaryError}
                </div>
              ) : chartData.length === 0 ? (
                <div className="flex h-full items-center justify-center text-base-content/70">
                  No recorded printing costs for this period.
                </div>
              ) : (
                <MeasuredChartFrame minHeight={320}>
                  {({ width, height }) => (
                    <ResponsiveContainer width={width} height={height}>
                      <ComposedChart
                        data={chartData}
                        margin={{ top: 8, right: 12, left: 4, bottom: 8 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.3)" />
                        <XAxis
                          dataKey="label"
                          tick={{ fontSize: 11 }}
                          interval={chartData.length > 14 ? Math.floor(chartData.length / 14) : 0}
                        />
                        <YAxis
                          tickFormatter={(value: number) => currencyFormatter.format(Number(value))}
                          tick={{ fontSize: 10 }}
                          width={74}
                        />
                        <Tooltip
                          content={
                            <CostTooltip
                              currencyFormatter={currencyFormatter}
                              granularity={summary?.granularity ?? 'day'}
                            />
                          }
                        />
                        <Bar dataKey="totalCost" name="Print cost" fill="#f97316" />
                      </ComposedChart>
                    </ResponsiveContainer>
                  )}
                </MeasuredChartFrame>
              )}
            </div>
            {hasIncompleteCosts && (
              <div className="alert alert-warning mt-3" role="status">
                <span>
                  The EUR total is incomplete:{' '}
                  {summary?.pendingConversionCount?.toLocaleString() ?? 0} orders await conversion
                  and {summary?.pendingPriceCount?.toLocaleString() ?? 0} await a price.
                </span>
              </div>
            )}
          </div>
        </section>

        <section className="card bg-base-100 shadow-sm">
          <div className="card-body">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="card-title">Print requests</h2>
                <p className="text-sm text-base-content/70">
                  {total.toLocaleString()} requests in this period. The table is filtered by request
                  date (UTC).
                </p>
              </div>
              <p className="text-sm text-base-content/70" aria-live="polite">
                {requestsLoading
                  ? 'Loading requests…'
                  : total
                    ? `Showing ${firstItem}–${lastItem} of ${total}`
                    : 'No requests'}
              </p>
            </div>
            {requestsError ? (
              <div className="alert alert-error mt-4" role="alert">
                {requestsError}
              </div>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="table table-zebra">
                  <thead>
                    <tr>
                      <th>Request date (UTC)</th>
                      <th>Story</th>
                      <th>Copies</th>
                      <th>Provider</th>
                      <th>Status</th>
                      <th>Vendor</th>
                      <th className="text-right">Quoted (incl. tax)</th>
                      <th className="text-right">Cost excl. tax</th>
                    </tr>
                  </thead>
                  <tbody>
                    {requestsLoading ? (
                      <tr>
                        <td colSpan={8} className="py-8 text-center">
                          <span className="loading loading-spinner loading-sm" />
                        </td>
                      </tr>
                    ) : requests?.requests.length ? (
                      requests.requests.map((request) => (
                        <tr key={request.id}>
                          <td className="whitespace-nowrap">
                            {formatRequestedAt(request.requestedAt)}
                          </td>
                          <td className="min-w-48">
                            <span className="font-medium">{request.title || 'Untitled story'}</span>
                            {request.ticketId && (
                              <div className="text-xs">
                                <Link
                                  className="link link-hover"
                                  href={`/tickets/${request.ticketId}`}
                                >
                                  Open ticket
                                </Link>
                              </div>
                            )}
                          </td>
                          <td>{request.copies ?? '—'}</td>
                          <td className="capitalize">
                            {request.provider}
                            {request.sandbox ? ' (sandbox)' : ''}
                          </td>
                          <td>{formatStatus(request.status)}</td>
                          <td>
                            {request.vendorStatus ? (
                              <span
                                className={`badge badge-sm ${vendorStatusBadge(request.vendorStatus)}`}
                              >
                                {formatStatus(request.vendorStatus)}
                              </span>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td className="text-right">
                            {request.quotedEur
                              ? currencyFormatter.format(Number(request.quotedEur))
                              : '—'}
                          </td>
                          <td className="min-w-40 text-right font-medium">
                            {formatRequestCost(
                              request.cost,
                              currencyFormatter,
                              request.sandbox,
                              request.provider,
                            )}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={8} className="py-8 text-center text-base-content/70">
                          No print requests found for this period.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
            {!requestsError && totalPages > 1 && (
              <div className="mt-4 flex items-center justify-between gap-4">
                <button
                  className="btn btn-sm"
                  disabled={requestsLoading || currentPage <= 1}
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                >
                  Previous
                </button>
                <span className="text-sm text-base-content/70">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  className="btn btn-sm"
                  disabled={requestsLoading || currentPage >= totalPages}
                  onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                >
                  Next
                </button>
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

function StatCard({ label, value, subtitle }: { label: string; value: string; subtitle: string }) {
  return (
    <div className="card bg-base-100 shadow">
      <div className="card-body">
        <p className="text-xs uppercase tracking-wide text-base-content/60">{label}</p>
        <p className="mt-2 text-3xl font-bold">{value}</p>
        <p className="text-sm text-base-content/60">{subtitle}</p>
      </div>
    </div>
  );
}

function CostTooltip({
  active,
  payload,
  currencyFormatter,
  granularity,
}: {
  active?: boolean;
  payload?: { payload: ChartBucket }[];
  currencyFormatter: Intl.NumberFormat;
  granularity: RegistrationGranularity;
}) {
  if (!active || !payload?.length) return null;
  const bucket = payload[0].payload;
  const date = new Date(bucket.date);
  const label =
    granularity === 'month'
      ? date.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })
      : date.toLocaleDateString('en-US', {
          weekday: 'short',
          month: 'long',
          day: 'numeric',
          year: 'numeric',
          timeZone: 'UTC',
        });
  return (
    <div className="rounded-lg border border-base-200 bg-base-100 px-3 py-2 text-sm shadow">
      <p className="font-semibold">{label}</p>
      <p>Print cost: {currencyFormatter.format(bucket.totalCost)}</p>
    </div>
  );
}

function bucketLabel(value: string, granularity: RegistrationGranularity) {
  const date = new Date(value);
  return granularity === 'month'
    ? date.toLocaleDateString('en-US', { month: 'short', year: '2-digit', timeZone: 'UTC' })
    : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

function formatRequestedAt(value: string) {
  return new Date(value).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'UTC',
  });
}

function formatRequestCost(
  cost: PrintRequest['cost'],
  currencyFormatter: Intl.NumberFormat,
  sandbox = false,
  provider: PrintRequest['provider'],
) {
  if (sandbox) return <span className="text-base-content/60">Not tracked (sandbox)</span>;
  if (provider !== 'lulu') return <span className="text-base-content/60">Not tracked</span>;
  if (!cost) return <span className="text-warning">Price pending</span>;
  if (cost.amountEur === null) {
    return (
      <span className="text-warning">
        {new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: cost.currency,
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }).format(Number(cost.amount))}{' '}
        · FX pending
      </span>
    );
  }
  const eurValue = currencyFormatter.format(Number(cost.amountEur));
  if (cost.currency.toUpperCase() === 'EUR') return eurValue;
  const original = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: cost.currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(cost.amount));
  return (
    <span>
      {original} <span className="text-base-content/60">→</span> {eurValue}
    </span>
  );
}

function vendorStatusBadge(value: string) {
  switch (value.toUpperCase()) {
    case 'UNPAID':
    case 'ERROR':
    case 'REJECTED':
      return 'badge-error';
    case 'PRODUCTION_DELAYED':
      return 'badge-warning';
    case 'IN_PRODUCTION':
    case 'SHIPPED':
    case 'DELIVERED':
      return 'badge-success';
    case 'CANCELED':
    case 'CANCELLED':
      return 'badge-ghost';
    default:
      return 'badge-outline';
  }
}

function formatStatus(value: string) {
  return value
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
