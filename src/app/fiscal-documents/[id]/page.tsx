'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { formatAdminDateTime } from '@/lib/date-utils';
import {
  canManuallyMarkFiscalDocumentIssued,
  fiscalStatusLabel,
  formatFiscalDocumentFullNumber,
  type FiscalDocumentStatus,
} from '@/lib/fiscal-documents';
import { useAdminAuth } from '@/lib/hooks/useAdminAuth';

interface FiscalDocumentDetail {
  id: string;
  orderId: string;
  authorId: string;
  provider: string;
  status: FiscalDocumentStatus;
  docType: string;
  docSeries: string | null;
  docNum: string | null;
  fullDocNumber: string | null;
  atDocCodeId: string | null;
  grossTotal: string | null;
  netTotal: string | null;
  taxTotal: string | null;
  vatRate: string | null;
  taxId: string | null;
  customerMode: string;
  keyInvoiceClientId: string | null;
  finalConsumerVatNumber: string | null;
  stripeCheckoutSessionId: string | null;
  stripePaymentIntentId: string | null;
  pdfStoragePath: string | null;
  pdfSha256: string | null;
  lastError: string | null;
  attemptCount: number;
  nextRetryAt: string | null;
  issuedAt: string | null;
  createdAt: string;
  updatedAt: string;
  needsAttention: boolean;
  retryableNow: boolean;
  attentionPriority: 'high' | 'warning' | 'none';
  paymentOrder: {
    orderId: string;
    amount: number;
    currency: string;
    status: string;
    provider: string;
    providerOrderId: string | null;
    providerPublicId: string | null;
    creditBundle: unknown;
    metadata: unknown;
    createdAt: string;
    updatedAt: string;
  } | null;
  author: {
    authorId: string;
    displayName: string;
    email: string;
    fiscalNumber: string | null;
  } | null;
  keyInvoiceCustomer: {
    id: string;
    vatin: string;
    keyInvoiceClientId: string;
    name: string;
    email: string | null;
    phone: string | null;
    countryCode: string | null;
    address: string | null;
    postalCode: string | null;
    locality: string | null;
  } | null;
  events: Array<{
    id: string;
    fiscalDocumentId: string | null;
    orderId: string;
    eventType: string;
    requestPayload: unknown;
    responsePayload: unknown;
    createdAt: string;
  }>;
}

const CURRENCY_FORMATTER = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'EUR',
});

interface ManualMarkIssuedFormState {
  docType: string;
  docSeries: string;
  docNum: string;
  fullDocNumber: string;
  atDocCodeId: string;
  issuedAt: string;
  reason: string;
  confirmation: boolean;
}

export default function FiscalDocumentDetailPage() {
  const { session, loading } = useAdminAuth();
  const params = useParams();
  const id = params.id as string;
  const [document, setDocument] = useState<FiscalDocumentDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [manualModalOpen, setManualModalOpen] = useState(false);
  const [manualSubmitting, setManualSubmitting] = useState(false);
  const [manualError, setManualError] = useState<string | null>(null);
  const [manualForm, setManualForm] = useState<ManualMarkIssuedFormState>(() =>
    emptyManualMarkIssuedForm(),
  );

  const fetchDocument = useCallback(
    async (signal?: AbortSignal) => {
      try {
        setIsLoading(true);
        setError(null);
        const response = await fetch(`/api/admin/fiscal-documents/${id}`, {
          cache: 'no-store',
          signal,
        });
        if (response.status === 404) {
          setDocument(null);
          setError('Fiscal document not found.');
          return;
        }
        if (!response.ok) {
          throw new Error(`Failed to load fiscal document (${response.status})`);
        }
        const payload: FiscalDocumentDetail = await response.json();
        if (!signal?.aborted) {
          setDocument(payload);
        }
      } catch (err) {
        if (signal?.aborted) {
          return;
        }
        console.error('Error loading fiscal document:', err);
        setError('Failed to load fiscal document.');
      } finally {
        if (!signal?.aborted) {
          setIsLoading(false);
        }
      }
    },
    [id],
  );

  useEffect(() => {
    if (loading || !session?.user) {
      return;
    }
    const controller = new AbortController();
    void fetchDocument(controller.signal);
    return () => controller.abort();
  }, [fetchDocument, loading, session]);

  const handleRetry = async () => {
    if (!document) {
      return;
    }

    setRetrying(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/fiscal-documents/${document.id}/retry`, {
        method: 'POST',
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || `Retry failed (${response.status})`);
      }
      await fetchDocument();
    } catch (err) {
      console.error('Fiscal document retry failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to retry fiscal document.');
    } finally {
      setRetrying(false);
    }
  };

  const openManualMarkIssuedModal = () => {
    if (!document) {
      return;
    }

    setManualError(null);
    setManualForm({
      docType: document.docType || '34',
      docSeries: document.docSeries || '',
      docNum: document.docNum || '',
      fullDocNumber: document.fullDocNumber || '',
      atDocCodeId: document.atDocCodeId || '',
      issuedAt: toDateTimeLocalValue(new Date()),
      reason: '',
      confirmation: false,
    });
    setManualModalOpen(true);
  };

  const updateManualForm = (field: keyof ManualMarkIssuedFormState, value: string | boolean) => {
    setManualForm((current) => ({ ...current, [field]: value }));
  };

  const handleManualMarkIssued = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!document) {
      return;
    }

    const requiredFields = [
      manualForm.docType.trim(),
      manualForm.docSeries.trim(),
      manualForm.docNum.trim(),
      manualForm.issuedAt.trim(),
      manualForm.reason.trim(),
    ];
    if (requiredFields.some((value) => !value) || !manualForm.confirmation) {
      setManualError('Fill the mandatory fields and confirm the reconciliation statement.');
      return;
    }

    const issuedAt = new Date(manualForm.issuedAt);
    setManualSubmitting(true);
    setManualError(null);
    setError(null);
    try {
      const response = await fetch(`/api/admin/fiscal-documents/${document.id}/mark-issued`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          docType: manualForm.docType.trim(),
          docSeries: manualForm.docSeries.trim(),
          docNum: manualForm.docNum.trim(),
          fullDocNumber: manualForm.fullDocNumber.trim() || undefined,
          atDocCodeId: manualForm.atDocCodeId.trim() || undefined,
          issuedAt: Number.isNaN(issuedAt.getTime()) ? manualForm.issuedAt : issuedAt.toISOString(),
          reason: manualForm.reason.trim(),
          confirmation: manualForm.confirmation,
        }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || `Manual mark issued failed (${response.status})`);
      }
      setManualModalOpen(false);
      await fetchDocument();
    } catch (err) {
      console.error('Manual fiscal document mark-issued failed:', err);
      setManualError(
        err instanceof Error ? err.message : 'Failed to manually mark fiscal document as issued.',
      );
    } finally {
      setManualSubmitting(false);
    }
  };

  if (loading || isLoading) {
    return <CenteredSpinner />;
  }

  if (!session?.user) {
    return null;
  }

  if (!document) {
    return (
      <div className="min-h-screen bg-base-200">
        <main className="container mx-auto px-4 py-8">
          <Link href="/fiscal-documents" className="btn btn-outline btn-sm">
            Back
          </Link>
          <div className="mt-8 rounded-lg bg-base-100 p-8 text-center shadow-sm">
            <p className="text-error">{error || 'Fiscal document not found.'}</p>
          </div>
        </main>
      </div>
    );
  }

  const stripeMetadata = getStripeMetadata(document.paymentOrder?.metadata);
  const latestFailure = [...document.events]
    .reverse()
    .find((event) => event.eventType === 'issue_failed');
  const hasRemoteKeyInvoiceDocument = Boolean(document.docNum);
  const canMarkIssuedManually = canManuallyMarkFiscalDocumentIssued({
    status: document.status,
    updatedAt: document.updatedAt,
  });

  return (
    <div className="min-h-screen bg-base-200">
      <main className="container mx-auto px-4 py-6 md:py-8">
        <div className="breadcrumbs text-sm">
          <ul>
            <li>
              <Link href="/fiscal-documents">Fiscal Documents</Link>
            </li>
            <li>{document.fullDocNumber || document.id}</li>
          </ul>
        </div>

        <header className="mb-6 rounded-lg bg-base-100 p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <StatusBadge status={document.status} />
                {document.needsAttention ? (
                  <span
                    className={`badge ${
                      document.attentionPriority === 'high' ? 'badge-error' : 'badge-warning'
                    }`}
                  >
                    Needs attention
                  </span>
                ) : null}
              </div>
              <h1 className="text-2xl font-bold md:text-3xl">
                {document.fullDocNumber || 'No remote document'}
              </h1>
              <p className="mt-1 font-mono text-xs text-base-content/60">{document.id}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {document.status === 'issued' && document.pdfStoragePath ? (
                <a
                  href={`/api/admin/fiscal-documents/${document.id}/pdf`}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-primary btn-sm"
                >
                  Open PDF
                </a>
              ) : null}
              {document.retryableNow ? (
                <button
                  type="button"
                  className="btn btn-warning btn-sm"
                  onClick={() => void handleRetry()}
                  disabled={retrying}
                >
                  {retrying ? 'Retrying' : 'Retry now'}
                </button>
              ) : null}
              {canMarkIssuedManually ? (
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={openManualMarkIssuedModal}
                >
                  Mark issued manually
                </button>
              ) : null}
            </div>
          </div>

          {document.needsAttention ? (
            <div className="alert alert-warning mt-4">
              <span>
                This document needs operational attention. Review the latest error and event
                timeline before retrying.
              </span>
            </div>
          ) : null}

          {document.status === 'draft' ? (
            <div className="alert alert-info mt-4">
              <span>Remote KeyInvoice document created: No</span>
            </div>
          ) : null}

          {document.status === 'failed' && hasRemoteKeyInvoiceDocument ? (
            <div className="alert alert-info mt-4">
              <span>
                Remote KeyInvoice document exists. The current failure is in local follow-up work
                such as PDF retrieval, PDF storage, AT registration, or readback reconciliation.
              </span>
            </div>
          ) : null}

          {error ? <div className="alert alert-error mt-4">{error}</div> : null}

          <div className="mt-5 grid gap-4 md:grid-cols-4">
            <SummaryStat label="Gross total" value={formatMoney(document.grossTotal)} />
            <SummaryStat label="Customer mode" value={document.customerMode.replace('_', ' ')} />
            <SummaryStat label="Created" value={formatAdminDateTime(document.createdAt)} />
            <SummaryStat label="Issued" value={formatAdminDateTime(document.issuedAt) || '-'} />
          </div>
        </header>

        <div className="grid gap-6 xl:grid-cols-2">
          <InfoCard title="Payment">
            <DetailRow label="Order ID" value={document.orderId} mono copy />
            <DetailRow label="Payment status" value={document.paymentOrder?.status || '-'} />
            <DetailRow label="Provider" value={document.paymentOrder?.provider || '-'} />
            <DetailRow
              label="Amount"
              value={formatCents(
                document.paymentOrder?.amount,
                document.paymentOrder?.currency || 'EUR',
              )}
            />
            <DetailRow
              label="Credit bundle"
              value={formatJsonInline(document.paymentOrder?.creditBundle)}
            />
            <DetailRow
              label="Stripe checkout session"
              value={
                document.stripeCheckoutSessionId || document.paymentOrder?.providerOrderId || '-'
              }
              mono
              copy
            />
            <DetailRow
              label="Stripe payment intent"
              value={
                document.stripePaymentIntentId || document.paymentOrder?.providerPublicId || '-'
              }
              mono
              copy
            />
            <DetailRow label="Stripe payment status" value={stripeMetadata.paymentStatus || '-'} />
          </InfoCard>

          <InfoCard title="Customer">
            <DetailRow label="Author ID" value={document.authorId} mono copy />
            <DetailRow
              label="Author"
              value={
                document.author ? `${document.author.displayName} (${document.author.email})` : '-'
              }
            />
            <DetailRow label="Customer mode" value={document.customerMode.replace('_', ' ')} />
            <DetailRow label="KeyInvoice client ID" value={document.keyInvoiceClientId || '-'} />
            <DetailRow
              label="KeyInvoice/customer VAT"
              value={document.keyInvoiceCustomer?.vatin || '-'}
            />
            <DetailRow label="Profile VAT/NIF" value={document.author?.fiscalNumber || '-'} />
            <DetailRow label="Final consumer VAT" value={document.finalConsumerVatNumber || '-'} />
            <DetailRow
              label="Billing address"
              value={formatBillingAddress(stripeMetadata.customerDetails)}
            />
          </InfoCard>

          <InfoCard title="Fiscal Document">
            <DetailRow label="Provider" value={document.provider} />
            <DetailRow label="Status" value={fiscalStatusLabel(document.status)} />
            <DetailRow label="Doc type" value={document.docType} />
            <DetailRow label="Doc series" value={document.docSeries || '-'} />
            <DetailRow label="Doc number" value={document.docNum || '-'} />
            <DetailRow label="Full document number" value={document.fullDocNumber || '-'} />
            <DetailRow label="AT doc code ID" value={document.atDocCodeId || '-'} />
            <DetailRow label="Gross/net/tax" value={formatTotals(document)} />
            <DetailRow label="VAT rate" value={document.vatRate ? `${document.vatRate}%` : '-'} />
            <DetailRow label="Tax ID" value={document.taxId || '-'} />
            <DetailRow
              label="PDF"
              value={document.pdfStoragePath ? 'Available' : 'Not available'}
            />
            <DetailRow label="PDF SHA-256" value={document.pdfSha256 || '-'} mono />
          </InfoCard>

          <InfoCard title="Error And Retry">
            <DetailRow label="Latest error" value={document.lastError || 'No error'} />
            <DetailRow label="Attempts" value={document.attemptCount.toString()} />
            <DetailRow
              label="Next retry"
              value={document.nextRetryAt ? formatAdminDateTime(document.nextRetryAt) : '-'}
            />
            <DetailRow label="Retry due now" value={document.retryableNow ? 'Yes' : 'No'} />
            <DetailRow
              label="Latest failure event"
              value={latestFailure ? formatAdminDateTime(latestFailure.createdAt) : '-'}
            />
          </InfoCard>
        </div>

        <section className="mt-6 rounded-lg bg-base-100 p-5 shadow-sm">
          <h2 className="text-xl font-semibold">Event Timeline</h2>
          {document.events.length === 0 ? (
            <p className="mt-4 text-base-content/60">No fiscal document events found.</p>
          ) : (
            <div className="mt-4 space-y-4">
              {document.events.map((event) => (
                <div key={event.id} className="rounded-lg border border-base-300 p-4">
                  <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                    <div>
                      <span className="font-semibold">{event.eventType}</span>
                      {event.eventType === 'draft_document_prepared' ? (
                        <span className="badge badge-info ml-2">
                          Remote KeyInvoice document created: No
                        </span>
                      ) : null}
                    </div>
                    <span className="text-sm text-base-content/60">
                      {formatAdminDateTime(event.createdAt)}
                    </span>
                  </div>
                  <div className="mt-3 grid gap-3 lg:grid-cols-2">
                    <JsonDetails label="Request payload" value={event.requestPayload} />
                    <JsonDetails label="Response payload" value={event.responsePayload} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      {manualModalOpen ? (
        <ManualMarkIssuedModal
          form={manualForm}
          error={manualError}
          submitting={manualSubmitting}
          derivedFullDocNumber={deriveFullDocNumber(manualForm)}
          onChange={updateManualForm}
          onClose={() => {
            if (!manualSubmitting) {
              setManualModalOpen(false);
            }
          }}
          onSubmit={handleManualMarkIssued}
        />
      ) : null}
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

function ManualMarkIssuedModal({
  form,
  error,
  submitting,
  derivedFullDocNumber,
  onChange,
  onClose,
  onSubmit,
}: {
  form: ManualMarkIssuedFormState;
  error: string | null;
  submitting: boolean;
  derivedFullDocNumber: string;
  onChange: (field: keyof ManualMarkIssuedFormState, value: string | boolean) => void;
  onClose: () => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <dialog className="modal modal-open" open>
      <div className="modal-box max-w-2xl">
        <h2 className="text-xl font-semibold">Mark issued manually</h2>
        <div className="alert alert-warning mt-4 text-sm">
          <span>
            This only reconciles Mythoria Admin. It does not issue, create, or update any document
            in KeyInvoice.
          </span>
        </div>

        {error ? <div className="alert alert-error mt-4 text-sm">{error}</div> : null}

        <form className="mt-5 space-y-4" onSubmit={onSubmit} noValidate>
          <div className="grid gap-4 md:grid-cols-3">
            <label className="form-control">
              <span className="label-text">Doc type</span>
              <input
                className="input input-bordered"
                value={form.docType}
                onChange={(event) => onChange('docType', event.target.value)}
                maxLength={20}
                required
              />
            </label>
            <label className="form-control">
              <span className="label-text">Doc series</span>
              <input
                className="input input-bordered"
                value={form.docSeries}
                onChange={(event) => onChange('docSeries', event.target.value)}
                maxLength={80}
                required
              />
            </label>
            <label className="form-control">
              <span className="label-text">Doc number</span>
              <input
                className="input input-bordered"
                value={form.docNum}
                onChange={(event) => onChange('docNum', event.target.value)}
                maxLength={80}
                required
              />
            </label>
          </div>

          <label className="form-control">
            <span className="label-text">Full document number</span>
            <input
              className="input input-bordered"
              value={form.fullDocNumber}
              onChange={(event) => onChange('fullDocNumber', event.target.value)}
              placeholder={derivedFullDocNumber}
              maxLength={160}
            />
            <span className="label-text-alt">
              Leave blank to store {derivedFullDocNumber || 'the derived document number'}.
            </span>
          </label>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="form-control">
              <span className="label-text">Issued at</span>
              <input
                type="datetime-local"
                className="input input-bordered"
                value={form.issuedAt}
                onChange={(event) => onChange('issuedAt', event.target.value)}
                required
              />
            </label>
            <label className="form-control">
              <span className="label-text">AT doc code ID</span>
              <input
                className="input input-bordered"
                value={form.atDocCodeId}
                onChange={(event) => onChange('atDocCodeId', event.target.value)}
                maxLength={255}
              />
            </label>
          </div>

          <label className="form-control">
            <span className="label-text">Operational reason</span>
            <textarea
              className="textarea textarea-bordered min-h-24"
              value={form.reason}
              onChange={(event) => onChange('reason', event.target.value)}
              maxLength={2000}
              required
            />
          </label>

          <label className="flex items-start gap-3 rounded-lg border border-base-300 p-3 text-sm">
            <input
              type="checkbox"
              className="checkbox checkbox-warning mt-0.5"
              checked={form.confirmation}
              onChange={(event) => onChange('confirmation', event.target.checked)}
              required
            />
            <span>
              I confirm this invoice exists in KeyInvoice/accounting and this action will not create
              a duplicate fiscal document.
            </span>
          </label>

          <div className="modal-action">
            <button type="button" className="btn btn-ghost" onClick={onClose} disabled={submitting}>
              Cancel
            </button>
            <button type="submit" className="btn btn-warning" disabled={submitting}>
              {submitting ? 'Saving' : 'Mark issued'}
            </button>
          </div>
        </form>
      </div>
      <form method="dialog" className="modal-backdrop" onClick={onClose}>
        <button type="button" aria-label="Close manual mark issued modal" disabled={submitting} />
      </form>
    </dialog>
  );
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-base-300 p-3">
      <p className="text-xs uppercase text-base-content/50">{label}</p>
      <p className="mt-1 font-semibold capitalize">{value}</p>
    </div>
  );
}

function InfoCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg bg-base-100 p-5 shadow-sm">
      <h2 className="text-xl font-semibold">{title}</h2>
      <dl className="mt-4 space-y-3">{children}</dl>
    </section>
  );
}

function DetailRow({
  label,
  value,
  mono = false,
  copy = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
  copy?: boolean;
}) {
  return (
    <div className="grid gap-1 text-sm md:grid-cols-[170px_1fr]">
      <dt className="text-base-content/60">{label}</dt>
      <dd className={`break-words ${mono ? 'font-mono text-xs' : ''}`}>
        {value}
        {copy && value !== '-' ? (
          <button
            type="button"
            className="btn btn-ghost btn-xs ml-2"
            onClick={() => void navigator.clipboard?.writeText(value)}
          >
            Copy
          </button>
        ) : null}
      </dd>
    </div>
  );
}

function JsonDetails({ label, value }: { label: string; value: unknown }) {
  if (value == null) {
    return (
      <div className="rounded-lg bg-base-200 p-3 text-sm text-base-content/50">{label}: empty</div>
    );
  }

  return (
    <details className="rounded-lg bg-base-200 p-3">
      <summary className="cursor-pointer text-sm font-medium">{label}</summary>
      <pre className="mt-3 max-h-96 overflow-auto whitespace-pre-wrap text-xs">
        {JSON.stringify(value, null, 2)}
      </pre>
    </details>
  );
}

function CenteredSpinner() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <span className="loading loading-spinner loading-lg" />
    </div>
  );
}

function formatMoney(value: string | null): string {
  const numericValue = value ? Number(value) : null;
  if (numericValue == null || Number.isNaN(numericValue)) {
    return '-';
  }
  return CURRENCY_FORMATTER.format(numericValue);
}

function formatCents(value?: number | null, currency = 'EUR'): string {
  if (typeof value !== 'number') {
    return '-';
  }
  const amount = value / 100;
  if (currency.toUpperCase() === 'EUR') {
    return CURRENCY_FORMATTER.format(amount);
  }
  return `${amount.toFixed(2)} ${currency.toUpperCase()}`;
}

function formatTotals(document: FiscalDocumentDetail): string {
  return `${formatMoney(document.grossTotal)} / ${formatMoney(document.netTotal)} / ${formatMoney(
    document.taxTotal,
  )}`;
}

function formatJsonInline(value: unknown): string {
  if (value == null) {
    return '-';
  }
  if (typeof value === 'string') {
    return value;
  }
  return JSON.stringify(value);
}

function getStripeMetadata(metadata: unknown): {
  paymentStatus?: string | null;
  customerDetails?: Record<string, unknown> | null;
} {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return {};
  }
  const stripe = (metadata as { stripe?: unknown }).stripe;
  if (!stripe || typeof stripe !== 'object' || Array.isArray(stripe)) {
    return {};
  }
  return stripe as {
    paymentStatus?: string | null;
    customerDetails?: Record<string, unknown> | null;
  };
}

function formatBillingAddress(customerDetails?: Record<string, unknown> | null): string {
  const address = customerDetails?.address;
  if (!address || typeof address !== 'object' || Array.isArray(address)) {
    return '-';
  }

  const parts = [
    stringValue(address, 'line1'),
    stringValue(address, 'line2'),
    stringValue(address, 'postal_code'),
    stringValue(address, 'city'),
    stringValue(address, 'country'),
  ].filter(Boolean);

  return parts.length ? parts.join(', ') : '-';
}

function stringValue(value: object, key: string): string | null {
  const raw = (value as Record<string, unknown>)[key];
  return typeof raw === 'string' && raw.trim() ? raw : null;
}

function emptyManualMarkIssuedForm(): ManualMarkIssuedFormState {
  return {
    docType: '34',
    docSeries: '',
    docNum: '',
    fullDocNumber: '',
    atDocCodeId: '',
    issuedAt: '',
    reason: '',
    confirmation: false,
  };
}

function toDateTimeLocalValue(value: Date): string {
  const offsetMs = value.getTimezoneOffset() * 60_000;
  return new Date(value.getTime() - offsetMs).toISOString().slice(0, 16);
}

function deriveFullDocNumber(form: ManualMarkIssuedFormState): string {
  const docType = form.docType.trim();
  const docSeries = form.docSeries.trim();
  const docNum = form.docNum.trim();
  if (!docType || !docSeries || !docNum) {
    return '';
  }
  return formatFiscalDocumentFullNumber({ docType, docSeries, docNum });
}
