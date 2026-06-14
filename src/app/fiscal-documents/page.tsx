'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { formatAdminDateTime } from '@/lib/date-utils';
import { useAdminAuth } from '@/lib/hooks/useAdminAuth';
import {
  FISCAL_DOCUMENT_STATUSES,
  fiscalStatusLabel,
  type FiscalDocumentStatus,
} from '@/lib/fiscal-documents';

interface FiscalDocumentSummary {
  id: string;
  orderId: string;
  status: FiscalDocumentStatus;
  fullDocNumber: string | null;
  grossTotal: string | null;
  vatRate: string | null;
  customerMode: string;
  stripeCheckoutSessionId: string | null;
  stripePaymentIntentId: string | null;
  lastError: string | null;
  attemptCount: number;
  nextRetryAt: string | null;
  issuedAt: string | null;
  createdAt: string;
  updatedAt: string;
  needsAttention: boolean;
  retryableNow: boolean;
  attentionPriority: 'high' | 'warning' | 'none';
  pdfStoragePath: string | null;
  paymentOrder: {
    amount: number;
    currency: string;
    status: string;
    provider: string;
    providerOrderId: string | null;
    providerPublicId: string | null;
  } | null;
  author: {
    authorId: string;
    displayName: string;
    email: string;
    fiscalNumber: string | null;
  } | null;
}

interface FiscalDocumentsResponse {
  data: FiscalDocumentSummary[];
  pagination: {
    page: number;
    limit: number;
    totalCount: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

const CURRENCY_FORMATTER = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'EUR',
});

export default function FiscalDocumentsPage() {
  const { session, loading } = useAdminAuth();
  const [documents, setDocuments] = useState<FiscalDocumentSummary[]>([]);
  const [pagination, setPagination] = useState<FiscalDocumentsResponse['pagination'] | null>(null);
  const [selectedStatuses, setSelectedStatuses] = useState<FiscalDocumentStatus[]>([]);
  const [needsAttention, setNeedsAttention] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState<50 | 100 | 200>(50);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryingId, setRetryingId] = useState<string | null>(null);

  const query = useMemo(() => {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
    });
    if (selectedStatuses.length) {
      params.set('status', selectedStatuses.join(','));
    }
    if (needsAttention) {
      params.set('needsAttention', 'true');
    }
    if (search.trim()) {
      params.set('q', search.trim());
    }
    return params.toString();
  }, [limit, needsAttention, page, search, selectedStatuses]);

  const fetchDocuments = useCallback(
    async (signal?: AbortSignal) => {
      try {
        setIsLoading(true);
        setError(null);
        const response = await fetch(`/api/admin/fiscal-documents?${query}`, {
          cache: 'no-store',
          signal,
        });
        if (!response.ok) {
          throw new Error(`Failed to load fiscal documents (${response.status})`);
        }
        const payload: FiscalDocumentsResponse = await response.json();
        if (signal?.aborted) {
          return;
        }
        setDocuments(payload.data);
        setPagination(payload.pagination);
      } catch (err) {
        if (signal?.aborted) {
          return;
        }
        console.error('Error loading fiscal documents:', err);
        setError('Failed to load fiscal documents.');
      } finally {
        if (!signal?.aborted) {
          setIsLoading(false);
        }
      }
    },
    [query],
  );

  useEffect(() => {
    if (loading || !session?.user) {
      return;
    }
    const controller = new AbortController();
    void fetchDocuments(controller.signal);
    return () => controller.abort();
  }, [fetchDocuments, loading, session]);

  const toggleStatus = (status: FiscalDocumentStatus) => {
    setSelectedStatuses((current) =>
      current.includes(status) ? current.filter((item) => item !== status) : [...current, status],
    );
    setPage(1);
  };

  const handleRetry = async (documentId: string) => {
    setRetryingId(documentId);
    try {
      const response = await fetch(`/api/admin/fiscal-documents/${documentId}/retry`, {
        method: 'POST',
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || `Retry failed (${response.status})`);
      }
      await fetchDocuments();
    } catch (err) {
      console.error('Fiscal document retry failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to retry fiscal document.');
    } finally {
      setRetryingId(null);
    }
  };

  if (loading) {
    return <CenteredSpinner />;
  }

  if (!session?.user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-base-200">
      <main className="container mx-auto px-4 py-6 md:py-8">
        <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-3xl font-bold">Fiscal Documents</h1>
            <p className="mt-1 text-sm text-base-content/70">
              Monitor Stripe-paid orders and KeyInvoice document generation.
            </p>
          </div>
          <div className="text-sm text-base-content/60">
            {pagination ? `${pagination.totalCount} documents` : null}
          </div>
        </div>

        <section className="mb-6 rounded-lg bg-base-100 p-4 shadow-sm">
          <div className="grid gap-4 lg:grid-cols-[minmax(220px,1fr)_auto_auto] lg:items-end">
            <label className="form-control">
              <span className="label-text mb-1">Search</span>
              <input
                className="input input-bordered"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
                placeholder="Order, document, Stripe, customer, VAT"
              />
            </label>
            <label className="label cursor-pointer justify-start gap-3 rounded-lg border border-base-300 px-4 py-3">
              <input
                type="checkbox"
                className="toggle toggle-error"
                checked={needsAttention}
                onChange={(event) => {
                  setNeedsAttention(event.target.checked);
                  setPage(1);
                }}
              />
              <span className="label-text">Needs attention</span>
            </label>
            <label className="form-control">
              <span className="label-text mb-1">Rows</span>
              <select
                className="select select-bordered"
                value={limit}
                onChange={(event) => {
                  setLimit(Number(event.target.value) as 50 | 100 | 200);
                  setPage(1);
                }}
              >
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={200}>200</option>
              </select>
            </label>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {FISCAL_DOCUMENT_STATUSES.map((status) => (
              <label
                key={status}
                className={`btn btn-sm ${selectedStatuses.includes(status) ? 'btn-primary' : 'btn-outline'}`}
              >
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={selectedStatuses.includes(status)}
                  onChange={() => toggleStatus(status)}
                />
                {fiscalStatusLabel(status)}
              </label>
            ))}
          </div>
        </section>

        {error ? (
          <div className="alert alert-error mb-6">
            <span>{error}</span>
            <button className="btn btn-sm" onClick={() => void fetchDocuments()}>
              Retry
            </button>
          </div>
        ) : null}

        <section className="rounded-lg bg-base-100 shadow-sm">
          {isLoading ? (
            <TableSkeleton />
          ) : documents.length === 0 ? (
            <div className="py-16 text-center text-base-content/60">
              {selectedStatuses.length || needsAttention || search
                ? 'No documents match the current filters.'
                : 'No fiscal documents found.'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="table table-zebra w-full">
                <thead>
                  <tr>
                    <th>Updated</th>
                    <th>Status</th>
                    <th>Attention</th>
                    <th>Document</th>
                    <th>Order / Stripe</th>
                    <th>Customer</th>
                    <th className="text-right">Gross</th>
                    <th>VAT</th>
                    <th>Attempts</th>
                    <th>Next retry</th>
                    <th>Error</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {documents.map((document) => (
                    <tr key={document.id}>
                      <td className="whitespace-nowrap text-xs">
                        <div>{formatAdminDateTime(document.updatedAt)}</div>
                        <div className="text-base-content/50">
                          Created {formatAdminDateTime(document.createdAt)}
                        </div>
                      </td>
                      <td>
                        <StatusBadge status={document.status} />
                      </td>
                      <td>
                        {document.needsAttention ? (
                          <span
                            className={`badge ${
                              document.attentionPriority === 'high'
                                ? 'badge-error'
                                : 'badge-warning'
                            }`}
                          >
                            Attention
                          </span>
                        ) : (
                          <span className="badge badge-ghost">Clear</span>
                        )}
                      </td>
                      <td className="min-w-48">
                        <Link
                          href={`/fiscal-documents/${document.id}`}
                          className="link link-primary"
                        >
                          {document.fullDocNumber || 'No remote document'}
                        </Link>
                        <div className="font-mono text-xs text-base-content/50">{document.id}</div>
                      </td>
                      <td className="min-w-56">
                        <CopyLine label="Order" value={document.orderId} />
                        <CopyLine
                          label="Session"
                          value={
                            document.stripeCheckoutSessionId ||
                            document.paymentOrder?.providerOrderId ||
                            null
                          }
                        />
                        <CopyLine
                          label="Intent"
                          value={
                            document.stripePaymentIntentId ||
                            document.paymentOrder?.providerPublicId ||
                            null
                          }
                        />
                      </td>
                      <td className="min-w-48">
                        {document.author ? (
                          <>
                            <Link
                              href={`/users/${document.author.authorId}`}
                              className="link link-primary"
                            >
                              {document.author.displayName}
                            </Link>
                            <div className="text-xs text-base-content/60">
                              {document.author.email}
                            </div>
                          </>
                        ) : (
                          <span className="text-base-content/40">Unknown</span>
                        )}
                        <div className="mt-1 text-xs capitalize text-base-content/50">
                          {document.customerMode.replace('_', ' ')}
                        </div>
                      </td>
                      <td className="text-right font-mono">
                        {formatMoney(document.grossTotal, document.paymentOrder?.currency)}
                      </td>
                      <td>{document.vatRate ? `${document.vatRate}%` : '-'}</td>
                      <td>{document.attemptCount}</td>
                      <td className="whitespace-nowrap text-xs">
                        {document.nextRetryAt ? formatAdminDateTime(document.nextRetryAt) : '-'}
                      </td>
                      <td className="max-w-64 truncate text-xs" title={document.lastError || ''}>
                        {document.lastError || (
                          <span className="text-base-content/40">No error</span>
                        )}
                      </td>
                      <td>
                        <div className="flex flex-wrap gap-2">
                          <Link
                            href={`/fiscal-documents/${document.id}`}
                            className="btn btn-outline btn-xs"
                          >
                            View
                          </Link>
                          {document.status === 'issued' && document.pdfStoragePath ? (
                            <a
                              href={`/api/admin/fiscal-documents/${document.id}/pdf`}
                              target="_blank"
                              rel="noreferrer"
                              className="btn btn-outline btn-xs"
                            >
                              PDF
                            </a>
                          ) : null}
                          {document.retryableNow ? (
                            <button
                              className="btn btn-warning btn-xs"
                              disabled={retryingId === document.id}
                              onClick={() => void handleRetry(document.id)}
                            >
                              {retryingId === document.id ? 'Retrying' : 'Retry'}
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {pagination ? (
          <div className="mt-6 flex flex-col items-center justify-between gap-3 md:flex-row">
            <span className="text-sm text-base-content/70">
              Page {pagination.page} of {Math.max(pagination.totalPages, 1)}
            </span>
            <div className="join">
              <button
                className="btn join-item"
                disabled={!pagination.hasPrev}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
              >
                Previous
              </button>
              <button
                className="btn join-item"
                disabled={!pagination.hasNext}
                onClick={() => setPage((current) => current + 1)}
              >
                Next
              </button>
            </div>
          </div>
        ) : null}
      </main>
    </div>
  );
}

function StatusBadge({ status }: { status: FiscalDocumentStatus }) {
  const badgeClass =
    status === 'issued' || status === 'credit_note_issued'
      ? 'badge-success'
      : status === 'failed' || status === 'credit_note_required'
        ? 'badge-error'
        : status === 'pending'
          ? 'badge-warning'
          : status === 'issuing'
            ? 'badge-info'
            : 'badge-ghost';
  return <span className={`badge ${badgeClass}`}>{fiscalStatusLabel(status)}</span>;
}

function CopyLine({ label, value }: { label: string; value: string | null }) {
  if (!value) {
    return (
      <div className="text-xs">
        <span className="text-base-content/50">{label}: </span>
        <span className="text-base-content/40">-</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1 text-xs">
      <span className="text-base-content/50">{label}:</span>
      <span className="max-w-44 truncate font-mono" title={value}>
        {value}
      </span>
      <button
        type="button"
        className="btn btn-ghost btn-xs h-5 min-h-5 px-1"
        onClick={() => void navigator.clipboard?.writeText(value)}
      >
        Copy
      </button>
    </div>
  );
}

function formatMoney(value: string | null, currency?: string | null): string {
  const numericValue = value ? Number(value) : null;
  if (numericValue == null || Number.isNaN(numericValue)) {
    return '-';
  }
  if (!currency || currency.toUpperCase() === 'EUR') {
    return CURRENCY_FORMATTER.format(numericValue);
  }
  return `${numericValue.toFixed(2)} ${currency.toUpperCase()}`;
}

function CenteredSpinner() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <span className="loading loading-spinner loading-lg" />
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="space-y-3 p-6">
      {Array.from({ length: 8 }).map((_, index) => (
        <div key={index} className="h-10 animate-pulse rounded bg-base-200" />
      ))}
    </div>
  );
}
