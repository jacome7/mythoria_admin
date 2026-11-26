'use client';

import { useCallback, useEffect, useState } from 'react';
import { formatAdminDateTime } from '@/lib/date-utils';
import {
  AdminPrintAddressFields,
  type AdminLuluShippingDefaults,
} from '@/components/AdminPrintDelivery';
import { classifyPrintOrder } from '@/lib/print-order-state';

interface PrintView {
  printRequestId?: string;
  provider: string;
  status: string;
  proofVersion: number;
  copies: number;
  binding: string;
  proofOnly?: boolean;
  adminOrder?: boolean;
  orderOrigin?: 'customer' | 'staff_proof' | 'admin_order';
  luluConfigured?: boolean;
  squareLuluBlockReason?: string | null;
  squareEdition?: {
    revision: string;
    manifest: { key: string; generation: string; sha256: string; bytes: number };
    podPackageId?: string;
    luluEnvironment?: string;
  };
  proof: {
    qaPassed: boolean;
    pageCount: number;
    sourcePageCount?: number;
    normalizedPageCount?: number;
    addedBlankPages?: number;
    coverDimensions?: { width: number; height: number };
    podPackageId?: string;
    interiorUrl: string;
    coverUrl: string;
    sentAt: string | null;
    supplierValidated?: boolean;
    issues?: string[];
  } | null;
  holdReason: string | null;
  quote: {
    shippingLevel: string;
    totalEur: number;
    perCopyEur: number;
    confirmationId: string;
    podPackageId?: string;
    normalizedPageCount?: number;
    printCostExclTaxEur?: number;
    shippingCostExclTaxEur?: number;
    totalTaxEur?: number;
  } | null;
  vendor: {
    id?: string;
    status?: string;
    tracking: unknown;
    orderId?: string | number | null;
    environment?: 'sandbox' | 'production';
    createdAt?: string;
    unpaid?: boolean;
    cancelable?: boolean;
    lines?: {
      id?: string;
      external_id?: string | null;
      carrier_name?: string | null;
      carrier?: string | null;
      tracking_id?: string | null;
      tracking_urls?: string[] | null;
      status?: {
        name: string;
        changed?: string | null;
        messages?: {
          tracking_id?: string | null;
          carrier_name?: string | null;
          tracking_urls?: string[];
        } | null;
      } | null;
    }[];
    costs?: {
      currency: string;
      total?: number;
      amountExclTax?: string;
      fees: unknown[];
    };
  } | null;
  lastError: string | null;
  maxEurPerCopy: number;
  shippingAddress: ShippingAddress;
  purchaserEmail?: string | null;
  addressReview?: {
    proofVersion: number;
    suggested: Partial<
      Pick<
        ShippingAddress,
        'street1' | 'street2' | 'city' | 'postcode' | 'country_code' | 'state_code'
      >
    >;
  };
  taxIdPresent: boolean;
}

interface ShippingAddress {
  name: string;
  street1: string;
  street2?: string;
  city: string;
  postcode: string;
  country_code: string;
  state_code?: string;
  phone_number: string;
  email: string;
}

const editableStatuses = ['pending', 'proof_ready', 'held', 'manual_review'];
const luluReconciliationStatuses = ['submitting', 'uncertain', 'submitted'];

function luluReleaseBlock(view: PrintView) {
  if (view.squareLuluBlockReason) return view.squareLuluBlockReason;
  if (view.luluConfigured === false) return 'Lulu is unavailable for this environment.';
  if (view.status !== 'proof_ready') return null;
  if (view.squareEdition && !view.proof?.supplierValidated)
    return 'Lulu has not validated this square proof.';
  if (!view.quote) return 'The current proof has no Lulu quote.';
  if (
    view.maxEurPerCopy <= 0 ||
    Math.round(view.quote.totalEur * 100) > Math.round(view.maxEurPerCopy * 100) * view.copies
  )
    return 'The Lulu quote exceeds the current per-copy cost limit.';
  return null;
}

function luluTrackingUrls(vendor: PrintView['vendor']) {
  const tracking = Array.isArray(vendor?.tracking) ? vendor.tracking : [];
  const links = vendor?.lines?.flatMap((line) => [
    ...(line.tracking_urls ?? []),
    ...(line.status?.messages?.tracking_urls ?? []),
  ]);
  return [...new Set([...tracking, ...(links ?? [])])].filter(
    (url): url is string => typeof url === 'string' && /^https?:\/\//i.test(url),
  );
}

function StateHistory({
  view,
  ticketStatus,
  ticketCreatedAt,
  ticketUpdatedAt,
}: {
  view: PrintView;
  ticketStatus: string;
  ticketCreatedAt?: string;
  ticketUpdatedAt?: string;
}) {
  const events = [
    { at: ticketCreatedAt, label: 'Ticket created' },
    {
      at: ticketUpdatedAt === ticketCreatedAt ? undefined : ticketUpdatedAt,
      label: 'Ticket last updated',
    },
    { at: view.proof?.sentAt, label: `Proof version ${view.proofVersion} emailed` },
    { at: view.vendor?.createdAt, label: 'Lulu job created' },
    ...(view.vendor?.lines?.map((line, index) => ({
      at: line.status?.changed,
      label: `Lulu line ${index + 1} changed to ${line.status?.name}`,
    })) ?? []),
  ]
    .flatMap(({ at, label }) => {
      const formatted = formatAdminDateTime(at);
      return at && formatted ? [{ at, formatted, label }] : [];
    })
    .sort((a, b) => Date.parse(a.at) - Date.parse(b.at));

  return (
    <details className="rounded-lg border border-base-300 p-3 text-sm">
      <summary className="cursor-pointer font-semibold">Print state and history</summary>
      <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
        <dt>Support ticket status</dt>
        <dd>{ticketStatus}</dd>
        <dt>Mythoria fulfillment status</dt>
        <dd>{view.status}</dd>
        <dt>{view.provider === 'lulu' ? 'Lulu job status' : 'Manual dispatch outcome'}</dt>
        <dd>{view.vendor?.status ?? '—'}</dd>
      </dl>
      {events.length > 0 && (
        <ol className="mt-2 list-disc space-y-1 pl-5">
          {events.map(({ at, formatted, label }) => (
            <li key={label}>
              {label} <time dateTime={at}>{formatted}</time>
            </li>
          ))}
        </ol>
      )}
    </details>
  );
}

async function command<T>(body: Record<string, unknown>): Promise<T> {
  const response = await fetch('/api/admin/print', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok || !result) throw new Error(result?.error || 'Print command failed');
  return result.data as T;
}

export function PrintSettings() {
  const [provider, setProvider] = useState<'none' | 'lulu'>('none');
  const [limit, setLimit] = useState('');
  const [hardcoverEnabled, setHardcoverEnabled] = useState(false);
  const [hardcoverCredits, setHardcoverCredits] = useState('');
  const [hardcoverChanged, setHardcoverChanged] = useState(false);
  const [message, setMessage] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    void command<{
      defaultProvider: 'none' | 'lulu';
      maxEurPerCopy: number;
      hardcoverCredits: number | null;
      savedHardcoverCredits?: number | null;
    }>({
      operation: 'getConfig',
    })
      .then((config) => {
        setProvider(config.defaultProvider);
        setLimit(String(config.maxEurPerCopy));
        setHardcoverEnabled(config.hardcoverCredits != null);
        setHardcoverCredits(String(config.hardcoverCredits ?? config.savedHardcoverCredits ?? ''));
        setLoaded(true);
      })
      .catch(() => setMessage('Print settings unavailable.'));
  }, []);
  const save = async () => {
    setSaving(true);
    try {
      await command({
        operation: 'setConfig',
        defaultProvider: provider,
        maxEurPerCopy: Number(limit),
        ...(hardcoverChanged
          ? { hardcoverCredits: hardcoverEnabled ? Number(hardcoverCredits) : null }
          : {}),
      });
      setHardcoverChanged(false);
      setMessage('Settings saved for future orders.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to save settings');
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="card bg-base-100 shadow-sm">
      <div className="card-body">
        <h2 className="card-title">Print fulfillment settings</h2>
        <p>Default applies to future orders. Existing orders keep their selection.</p>
        <fieldset className="contents" disabled={!loaded || saving}>
          <label>
            Default provider{' '}
            <select
              className="select select-bordered"
              value={provider}
              onChange={(event) => setProvider(event.target.value as 'none' | 'lulu')}
            >
              <option value="none">None / manual</option>
              <option value="lulu">Lulu</option>
            </select>
          </label>
          <label className="flex gap-2">
            <input
              type="checkbox"
              checked={hardcoverEnabled}
              onChange={(event) => {
                setHardcoverEnabled(event.target.checked);
                setHardcoverChanged(true);
              }}
            />
            Enable hardcover pricing
          </label>
          <label>
            Hardcover price in credits{' '}
            <input
              className="input input-bordered"
              type="number"
              min="1"
              step="1"
              value={hardcoverCredits}
              disabled={!hardcoverEnabled}
              onChange={(event) => {
                setHardcoverCredits(event.target.value);
                setHardcoverChanged(true);
              }}
            />
          </label>
          <p>
            Square hardcover checkout requires a recorded physical proof approval. Lulu also
            requires approval for its current environment and the verified product configuration.
          </p>
          <label>
            Maximum landed EUR per copy{' '}
            <input
              className="input input-bordered"
              type="number"
              min={provider === 'lulu' ? 0.01 : 0}
              step="0.01"
              value={limit}
              onChange={(event) => setLimit(event.target.value)}
            />
          </label>
          <button
            className="btn btn-primary"
            onClick={() => void save()}
            disabled={
              !limit.trim() ||
              !Number.isFinite(Number(limit)) ||
              Number(limit) < 0 ||
              Number(limit) > 99999999.99 ||
              (provider === 'lulu' && Number(limit) < 0.01) ||
              (hardcoverEnabled &&
                (!Number.isInteger(Number(hardcoverCredits)) ||
                  Number(hardcoverCredits) < 1 ||
                  Number(hardcoverCredits) > 1000000))
            }
          >
            Save settings
          </button>
        </fieldset>
        {message && <p role="status">{message}</p>}
      </div>
    </div>
  );
}

function ManualPrint({
  ticketId,
  view,
  refresh,
}: {
  ticketId: string;
  view: PrintView;
  refresh: () => void;
}) {
  const [printers, setPrinters] = useState<{ id: string; name: string }[]>([]);
  const [partnerId, setPartnerId] = useState('');
  const [subject, setSubject] = useState(
    view.proofOnly ? 'Prova de impressão' : 'Livro para impressão',
  );
  const [bodyText, setBodyText] = useState(() => {
    const a = view.shippingAddress;
    if (view.squareEdition)
      return `Pedido de ${view.proofOnly ? 'prova de ' : ''}impressão — ${ticketId}`;
    const binding = view.binding === 'hardcover' ? 'capa dura' : 'capa mole';
    return [
      `Pedido de impressão — ${ticketId}`,
      `Exemplares: ${view.copies} · ${binding}`,
      '',
      'Morada de entrega',
      a.name,
      a.street1,
      a.street2,
      [a.postcode, a.city, a.state_code].filter(Boolean).join(' '),
      a.country_code,
      a.phone_number,
      a.email,
    ]
      .filter((value) => value !== undefined)
      .join('\n');
  });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [checkedInbox, setCheckedInbox] = useState(false);
  useEffect(() => {
    void fetch('/api/admin/partners')
      .then((response) => {
        if (!response.ok) throw new Error('Could not load printer partners');
        return response.json();
      })
      .then((result) => {
        const list = (result.data || []).filter(
          (partner: { type: string; status: string; email?: string }) =>
            partner.type === 'printer' && partner.status === 'active' && partner.email,
        );
        setPrinters(list);
      })
      .catch(() => setMessage('Could not load printer partners.'));
  }, []);
  const send = async () => {
    setBusy(true);
    setCheckedInbox(false);
    setMessage('');
    try {
      const response = await fetch('/api/admin/print/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticketId,
          partnerId,
          proofVersion: view.proofVersion,
          checkedInbox,
          subject,
          bodyText,
        }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result) throw new Error(result?.error || 'Dispatch failed');
      setMessage(
        result.outcome === 'sent'
          ? 'Request sent to the printer.'
          : 'Delivery is uncertain. Check the delivery before taking further action.',
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Dispatch could not be confirmed');
    } finally {
      setBusy(false);
      refresh();
    }
  };
  return (
    <div className="space-y-2">
      <h4 className="font-semibold">Send current proof to printer</h4>
      <select
        aria-label="Printer"
        className="select select-bordered select-sm"
        value={partnerId}
        onChange={(event) => setPartnerId(event.target.value)}
      >
        <option value="">Select printer</option>
        {printers.map((printer) => (
          <option key={printer.id} value={printer.id}>
            {printer.name}
          </option>
        ))}
      </select>
      <input
        aria-label="Email subject"
        className="input input-bordered input-sm w-full"
        value={subject}
        onChange={(event) => setSubject(event.target.value)}
      />
      <textarea
        aria-label="Email message"
        className="textarea textarea-bordered w-full"
        value={bodyText}
        onChange={(event) => setBodyText(event.target.value)}
      />
      <label className="flex gap-2">
        <input
          type="checkbox"
          checked={checkedInbox}
          onChange={(event) => setCheckedInbox(event.target.checked)}
        />
        {view.proofOnly
          ? 'I reviewed staff proof version'
          : 'I checked the inbox and reviewed proof version'}{' '}
        {view.proofVersion}.
      </label>
      <button
        className="btn btn-sm"
        disabled={busy || !checkedInbox || !partnerId || !subject.trim() || !bodyText.trim()}
        onClick={() => void send()}
      >
        Send print request
      </button>
      {message && <p role="status">{message}</p>}
    </div>
  );
}

export function PrintFulfillment({
  ticketId,
  ticketStatus,
  ticketCreatedAt,
  ticketUpdatedAt,
}: {
  ticketId: string;
  ticketStatus: string;
  ticketCreatedAt?: string;
  ticketUpdatedAt?: string;
}) {
  const [view, setView] = useState<PrintView | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState('');
  const [cancelReason, setCancelReason] = useState('');
  const [checkedInbox, setCheckedInbox] = useState(false);
  const [amount, setAmount] = useState('');
  const [correctedRevision, setCorrectedRevision] = useState('');
  const [correctionReason, setCorrectionReason] = useState('');
  const run = useCallback(
    async (operation: string, extra: Record<string, unknown> = {}) => {
      setBusy(true);
      setMessage('');
      setCheckedInbox(false);
      setAmount('');
      try {
        const result = await command<PrintView>({ operation, ticketId, ...extra });
        setView(result);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : 'Print command failed');
      } finally {
        setBusy(false);
      }
    },
    [ticketId],
  );
  useEffect(() => {
    let current = true;
    void command<PrintView>({ operation: 'get', ticketId })
      .then((result) => {
        if (current) setView(result);
      })
      .catch((error: unknown) => {
        if (current)
          setMessage(error instanceof Error ? error.message : 'Could not load fulfillment');
      });
    return () => {
      current = false;
    };
  }, [ticketId]);
  const closed = ticketStatus === 'closed' || ticketStatus === 'resolved';
  const status = view?.status;
  useEffect(() => {
    if (closed || busy || !status || !['pending', 'preparing', 'submitting'].includes(status)) {
      return;
    }
    let current = true;
    let refreshing = false;
    const timer = setInterval(() => {
      if (refreshing) return;
      refreshing = true;
      void command<PrintView>({ operation: 'get', ticketId })
        .then((result) => {
          if (current) setView(result);
        })
        .catch(() => {})
        .finally(() => {
          refreshing = false;
        });
    }, 4000);
    return () => {
      current = false;
      clearInterval(timer);
    };
  }, [closed, busy, ticketId, status]);
  const quote = view?.quote;
  const skipInboxCheck = Boolean(view?.proofOnly || view?.adminOrder);
  const releaseBlock = view?.provider === 'lulu' ? luluReleaseBlock(view) : null;
  const hasVendor = Boolean(view?.vendor?.id || view?.vendor?.status);
  const orderState = view
    ? classifyPrintOrder({
        ticketStatus,
        fulfillmentStatus: view.status,
        vendorStatus: view.vendor?.status,
        hasVendor,
        provider: view.provider,
        purpose:
          view.orderOrigin ??
          (view.proofOnly ? 'staff_proof' : view.adminOrder ? 'admin_order' : 'customer'),
        held: Boolean(view.holdReason),
        proofSent: Boolean(view.proof?.sentAt),
        qaPassed: view.proof?.qaPassed,
        hasQuote: Boolean(quote),
        blockReason: releaseBlock,
      })
    : null;
  const editable = Boolean(
    view &&
    !closed &&
    !hasVendor &&
    orderState?.stage !== 'supplier' &&
    editableStatuses.includes(view.status),
  );
  const onHold = status === 'held' || Boolean(view?.holdReason);
  const luluSelectionBlock =
    view?.squareLuluBlockReason ||
    (view?.luluConfigured === false ? 'Lulu is unavailable for this environment.' : null);
  const mayPrepare =
    editable &&
    !onHold &&
    view?.proof?.qaPassed !== false &&
    (status === 'pending' ||
      status === 'manual_review' ||
      (view?.provider === 'lulu' && view.squareEdition && !view.proof?.supplierValidated));
  const ready =
    editable &&
    view?.status === 'proof_ready' &&
    view.proof?.qaPassed &&
    (Boolean(view.proof.sentAt) || skipInboxCheck) &&
    !onHold;
  const vendorStatusUpper = view?.vendor?.status?.toUpperCase();
  const isUnpaid = Boolean(view?.vendor?.unpaid || vendorStatusUpper === 'UNPAID');
  const isCanceled = vendorStatusUpper === 'CANCELED' || vendorStatusUpper === 'CANCELLED';
  const needsSupplierFollowUp =
    isCanceled || vendorStatusUpper === 'ERROR' || vendorStatusUpper === 'REJECTED';
  const isProductionDelayed = vendorStatusUpper === 'PRODUCTION_DELAYED';
  const mayReconcileLulu =
    view?.provider === 'lulu' && status && luluReconciliationStatuses.includes(status);
  const luluSubmissionUnconfirmed = status !== 'submitted' || !hasVendor;
  const trackingUrls = luluTrackingUrls(view?.vendor ?? null);
  return (
    <div className="card bg-base-100 shadow-sm">
      <div className="card-body">
        <h3 className="card-title">Print fulfillment</h3>
        {message && <p role="alert">{message}</p>}
        {!view &&
          (message ? (
            <button
              type="button"
              className="btn btn-sm self-start"
              disabled={busy}
              onClick={() => void run('get')}
            >
              Retry loading order
            </button>
          ) : (
            <p role="status">Loading print order…</p>
          ))}
        {view && (
          <>
            {orderState && (
              <p className="font-semibold" role="status">
                {orderState.label}
              </p>
            )}
            {editable && luluSelectionBlock && (
              <p>{luluSelectionBlock} Use the manual printer path if approved for this order.</p>
            )}
            {view.proofOnly ? (
              <p className="font-semibold">Staff proof · One copy · No customer charge</p>
            ) : view.adminOrder ? (
              <p className="font-semibold">
                Admin print order · {view.copies} {view.copies === 1 ? 'copy' : 'copies'} · No
                customer charge
              </p>
            ) : null}
            <p>
              {view.printRequestId && `Order #${view.printRequestId.slice(0, 8).toUpperCase()} · `}
              Provider {view.provider} · {view.copies} {view.copies === 1 ? 'copy' : 'copies'} ·{' '}
              {view.binding}
            </p>
            <p>Limit: €{view.maxEurPerCopy} per copy</p>
            <StateHistory
              view={view}
              ticketStatus={ticketStatus}
              ticketCreatedAt={ticketCreatedAt}
              ticketUpdatedAt={ticketUpdatedAt}
            />
            {view.squareEdition && (
              <div className="space-y-1">
                <h4 className="font-semibold">Square hardcover (8.5 × 8.5 in)</h4>
                <p>Edition {view.squareEdition.revision}</p>
                {view.provider === 'lulu' && (
                  <p>
                    Lulu {view.squareEdition.luluEnvironment} · {view.squareEdition.podPackageId}
                  </p>
                )}
                <p className="break-all text-sm">
                  Manifest generation {view.squareEdition.manifest.generation} · SHA-256{' '}
                  {view.squareEdition.manifest.sha256}
                </p>
              </div>
            )}
            <div className="space-y-1">
              <h4 className="font-semibold">Shipping address for this order</h4>
              {view.purchaserEmail && (
                <p className="text-sm">Purchaser and proof recipient: {view.purchaserEmail}</p>
              )}
              <address className="not-italic text-sm">
                <div>{view.shippingAddress.name}</div>
                <div>{view.shippingAddress.street1}</div>
                {view.shippingAddress.street2 && <div>{view.shippingAddress.street2}</div>}
                <div>
                  {[
                    view.shippingAddress.postcode,
                    view.shippingAddress.city,
                    view.shippingAddress.state_code,
                  ]
                    .filter(Boolean)
                    .join(' ')}
                </div>
                <div>{view.shippingAddress.country_code}</div>
                {view.shippingAddress.phone_number && (
                  <div>{view.shippingAddress.phone_number}</div>
                )}
                <div>{view.shippingAddress.email}</div>
              </address>
            </div>
            {view.lastError && <p role="alert">{view.lastError}</p>}
            {view.holdReason && <p>Hold reason — {view.holdReason}</p>}
            {view.holdReason && editable && (
              <ShippingCorrection
                key={`${view.proofVersion}-${view.shippingAddress.street1}`}
                address={view.shippingAddress}
                provider={view.provider === 'lulu' ? 'lulu' : 'manual'}
                suggested={view.addressReview?.suggested}
                taxIdPresent={view.taxIdPresent}
                busy={busy}
                proofOnly={view.proofOnly}
                submit={(shippingAddress) =>
                  void run('correctShipping', {
                    customerConfirmed: true,
                    expectedProofVersion: view.proofVersion,
                    shippingAddress,
                  })
                }
              />
            )}
            {view.squareEdition && !view.proofOnly && view.status === 'held' && editable && (
              <form
                key={view.squareEdition.revision}
                className="space-y-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  void run('correctSquareEdition', {
                    expectedRevision: view.squareEdition?.revision,
                    correctedRevision: correctedRevision.trim(),
                    reason: correctionReason.trim(),
                  });
                }}
              >
                <h4 className="font-semibold">Bind published correction</h4>
                <p>The order stays on hold. Clearing it queues a replacement proof and quote.</p>
                <label className="block">
                  Published revision ID
                  <input
                    className="input input-bordered input-sm w-full"
                    required
                    value={correctedRevision}
                    onChange={(event) => setCorrectedRevision(event.target.value)}
                  />
                </label>
                <label className="block">
                  Reason for revision
                  <input
                    className="input input-bordered input-sm w-full"
                    required
                    maxLength={500}
                    value={correctionReason}
                    onChange={(event) => setCorrectionReason(event.target.value)}
                  />
                </label>
                <button
                  className="btn btn-sm"
                  type="submit"
                  disabled={busy || !correctedRevision.trim() || !correctionReason.trim()}
                >
                  Bind corrected edition
                </button>
              </form>
            )}
            {view.proof && (
              <div>
                <p>
                  Proof version {view.proofVersion} · {view.proof.pageCount} pages
                  {view.proof.normalizedPageCount &&
                    view.proof.normalizedPageCount !== view.proof.pageCount &&
                    ` (Lulu normalized: ${view.proof.normalizedPageCount} pages)`}{' '}
                  · QA {view.proof.qaPassed ? 'passed' : 'not passed'}
                  {!skipInboxCheck && ` · Emailed ${view.proof.sentAt || 'not sent'}`}
                </p>
                {view.proof.coverDimensions && (
                  <p className="text-xs text-base-content/70">
                    Cover spread: {view.proof.coverDimensions.width.toFixed(1)} ×{' '}
                    {view.proof.coverDimensions.height.toFixed(1)} pt
                    {view.proof.podPackageId ? ` · SKU ${view.proof.podPackageId}` : ''}
                  </p>
                )}
                {view.squareEdition && view.provider === 'lulu' && (
                  <p>Lulu file validation {view.proof.supplierValidated ? 'passed' : 'pending'}</p>
                )}
                <p>
                  <a
                    className="link"
                    href={view.proof.interiorUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Interior proof
                  </a>{' '}
                  ·{' '}
                  <a className="link" href={view.proof.coverUrl} target="_blank" rel="noreferrer">
                    Cover proof
                  </a>
                </p>
                {!!view.proof.issues?.length && (
                  <ul className="list-disc pl-5">
                    {view.proof.issues.map((issue) => (
                      <li key={issue}>
                        {issue === 'image_below_300_ppi' ? 'An image is below 300 PPI.' : issue}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
            {ready && view.provider === 'manual' && (
              <ManualPrint
                key={view.proofVersion}
                view={view}
                ticketId={ticketId}
                refresh={() => void run('get')}
              />
            )}
            {quote && (
              <div className="space-y-1 text-sm">
                <p>
                  Quote: €{quote.totalEur} total, €{quote.perCopyEur} per copy, shipping{' '}
                  {quote.shippingLevel}
                </p>
                {(quote.printCostExclTaxEur !== undefined ||
                  quote.shippingCostExclTaxEur !== undefined ||
                  quote.totalTaxEur !== undefined) && (
                  <p className="text-xs text-base-content/70">
                    Breakdown: print €{quote.printCostExclTaxEur ?? '—'} + shipping €
                    {quote.shippingCostExclTaxEur ?? '—'} + tax €{quote.totalTaxEur ?? '—'}
                  </p>
                )}
              </div>
            )}
            {view.provider === 'lulu' && view.vendor?.id && (
              <div className="space-y-2 rounded-lg border border-base-300 p-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">
                    Lulu order {view.vendor.id}: {view.vendor.status}
                  </span>
                  {view.vendor.environment && (
                    <span className="badge badge-outline badge-sm">{view.vendor.environment}</span>
                  )}
                  {view.vendor.orderId != null && (
                    <span className="text-xs text-base-content/70">
                      Order #{String(view.vendor.orderId)}
                    </span>
                  )}
                </div>
                {view.vendor.costs && (
                  <p className="text-xs text-base-content/70">
                    Actual Lulu cost: {view.vendor.costs.currency}{' '}
                    {view.vendor.costs.total ?? view.vendor.costs.amountExclTax ?? '—'}
                    {view.vendor.costs.amountExclTax &&
                      ` (excl. tax: ${view.vendor.costs.amountExclTax})`}
                    {quote ? ` · Quoted EUR ${quote.totalEur}` : ''}
                  </p>
                )}
                {needsSupplierFollowUp ? (
                  <div className="space-y-1">
                    <h4 className="font-semibold">
                      {isCanceled ? 'Cancellation follow-up' : 'Supplier failure follow-up'}
                    </h4>
                    <p>
                      Verify the supplier outcome and any payment or credit in Lulu. Record any
                      customer refund or replacement separately in the{' '}
                      <a href="#ticket-comments" className="link">
                        ticket comments
                      </a>
                      .
                    </p>
                  </div>
                ) : isUnpaid ? (
                  <p className="text-warning">
                    Pay for this job in the Lulu Developer Portal or cancel it before production.
                    Refresh the order after taking action.
                  </p>
                ) : isProductionDelayed ? (
                  <p>Production is delayed. Lulu can still accept a cancellation at this stage.</p>
                ) : null}
                {trackingUrls.length > 0 ? (
                  <div className="flex flex-wrap gap-2 text-xs">
                    <span>Tracking:</span>
                    {trackingUrls.map((url, idx) => (
                      <a
                        key={url}
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        className="link link-primary"
                      >
                        Shipment link {idx + 1}
                      </a>
                    ))}
                  </div>
                ) : !isUnpaid && !needsSupplierFollowUp ? (
                  <p className="text-xs text-base-content/70">Tracking is currently unavailable.</p>
                ) : null}
                {view.vendor.lines?.map((line, index) => {
                  const carrier =
                    line.carrier_name ?? line.status?.messages?.carrier_name ?? line.carrier;
                  const trackingId = line.tracking_id ?? line.status?.messages?.tracking_id;
                  if (!carrier && !trackingId && !line.status?.name) return null;
                  return (
                    <p
                      key={line.id ?? line.external_id ?? index}
                      className="text-xs text-base-content/70"
                    >
                      Line {index + 1}: {line.status?.name ?? view.vendor?.status}
                      {carrier ? ` · ${carrier}` : ''}
                      {trackingId ? ` · #${trackingId}` : ''}
                    </p>
                  );
                })}
                {!closed &&
                  status === 'submitted' &&
                  view.vendor.cancelable &&
                  !needsSupplierFollowUp && (
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <input
                        className="input input-bordered input-xs"
                        aria-label="Cancellation reason"
                        placeholder="Reason to cancel Lulu job"
                        maxLength={500}
                        value={cancelReason}
                        onChange={(event) => setCancelReason(event.target.value)}
                      />
                      <button
                        type="button"
                        className="btn btn-error btn-xs"
                        disabled={busy || !cancelReason.trim()}
                        onClick={() => void run('cancel', { reason: cancelReason.trim() })}
                      >
                        Cancel Lulu job
                      </button>
                    </div>
                  )}
              </div>
            )}
            {mayReconcileLulu && (
              <div className="space-y-2">
                {luluSubmissionUnconfirmed && (
                  <p>
                    Lulu submission is unconfirmed. Reconcile the order with Lulu before you retry
                    or arrange another shipment.
                  </p>
                )}
                <button
                  className="btn btn-sm"
                  disabled={busy}
                  onClick={() => void run('reconcile')}
                >
                  {luluSubmissionUnconfirmed ? 'Reconcile with Lulu' : 'Refresh order'}
                </button>
              </div>
            )}
            {status === 'manual_dispatching' && (
              <div className="space-y-2">
                <p>Refresh the dispatch status to check whether the printer email was sent.</p>
                <button
                  className="btn btn-sm"
                  disabled={busy}
                  onClick={() => void run('reconcile')}
                >
                  Refresh dispatch status
                </button>
              </div>
            )}
            {status === 'manual_uncertain' && (
              <p>
                Check the delivery record and contact the printer before sending the proof again.
                Record the outcome in the{' '}
                <a href="#ticket-comments" className="link">
                  ticket comments
                </a>
                .
              </p>
            )}
            {status === 'manual_sent' && (
              <p>
                The proof was sent to the printer. Confirm production and delivery with the printer
                and record the outcome in the{' '}
                <a href="#ticket-comments" className="link">
                  ticket comments
                </a>
                .
              </p>
            )}
            {editable && (
              <>
                <div className="flex flex-wrap gap-2">
                  <button
                    className="btn btn-sm"
                    disabled={busy || Boolean(luluSelectionBlock)}
                    onClick={() => void run('select', { provider: 'lulu' })}
                  >
                    {view.squareEdition ? 'Prepare for Lulu' : 'Select Lulu'}
                  </button>
                  <button
                    className="btn btn-sm"
                    disabled={busy}
                    onClick={() => void run('select', { provider: 'manual' })}
                  >
                    {view.squareEdition ? 'Prepare for manual printer' : 'Select manual'}
                  </button>
                  {!view.squareEdition && (
                    <button
                      className="btn btn-sm"
                      disabled={busy}
                      onClick={() => void run('revise')}
                    >
                      Revise proof
                    </button>
                  )}
                  {mayPrepare && (
                    <button
                      className="btn btn-sm"
                      disabled={busy || (view.provider === 'lulu' && Boolean(luluSelectionBlock))}
                      onClick={() => void run('prepare', { runImmediately: true })}
                    >
                      {view.provider === 'lulu' ? 'Prepare proof and quote' : 'Prepare proof'}
                    </button>
                  )}
                </div>
                {onHold ? (
                  <div className="space-y-2">
                    <p>
                      Resolve the hold reason, then clear the hold to resume preparation or review.
                    </p>
                    <button
                      className="btn btn-sm"
                      disabled={busy}
                      onClick={() => void run('clear')}
                    >
                      Clear hold
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    <input
                      className="input input-bordered input-sm"
                      aria-label="Reason for hold"
                      placeholder="Reason for hold"
                      maxLength={500}
                      value={reason}
                      onChange={(event) => setReason(event.target.value)}
                    />
                    <button
                      className="btn btn-sm"
                      disabled={busy || !reason.trim()}
                      onClick={() => void run('hold', { reason: reason.trim() })}
                    >
                      Put on hold
                    </button>
                  </div>
                )}
              </>
            )}
            {editable && !onHold && status === 'manual_review' && (
              <p>
                {view.proof?.qaPassed === false
                  ? view.squareEdition
                    ? view.proofOnly
                      ? 'Prepare a staff proof from the corrected published edition.'
                      : 'Put the order on hold and bind the corrected published edition to generate a new proof.'
                    : 'Correct the source issue and choose Revise proof to generate new files.'
                  : 'Review the preparation issue, then prepare the proof again once it is resolved.'}
              </p>
            )}
            {editable && !onHold && status === 'proof_ready' && !ready && (
              <p>
                {view.proof?.qaPassed
                  ? 'Confirm delivery of the current proof email before releasing this order.'
                  : 'Review the proof files and correct any QA issues before generating a new proof.'}
              </p>
            )}
            {ready && releaseBlock && releaseBlock !== luluSelectionBlock && (
              <p>
                {releaseBlock}{' '}
                {quote && (!view.squareEdition || view.proof?.supplierValidated)
                  ? 'Review the limit in Print settings or use the manual printer path.'
                  : view.squareEdition
                    ? 'Prepare a new proof and quote before release.'
                    : 'Revise the proof to prepare a new quote.'}
              </p>
            )}
            {ready && view.provider === 'lulu' && quote && !releaseBlock && (
              <div className="space-y-2">
                <label className="flex gap-2">
                  <input
                    type="checkbox"
                    checked={checkedInbox}
                    onChange={(event) => setCheckedInbox(event.target.checked)}
                  />
                  {view.proofOnly
                    ? 'I reviewed staff proof version'
                    : view.adminOrder
                      ? 'I reviewed admin proof version'
                      : 'I checked the inbox and reviewed proof version'}{' '}
                  {view.proofVersion}.
                </label>
                <label>
                  Confirm total EUR{' '}
                  <input
                    className="input input-bordered input-sm"
                    type="number"
                    step="0.01"
                    value={amount}
                    onChange={(event) => setAmount(event.target.value)}
                  />
                </label>
                <button
                  className="btn btn-primary btn-sm"
                  disabled={busy || !checkedInbox || Number(amount) !== quote.totalEur}
                  onClick={() =>
                    void run('submit', {
                      confirmationId: quote.confirmationId,
                      checkedInbox: true,
                      confirmedTotalEur: Number(amount),
                      proofVersion: view.proofVersion,
                    })
                  }
                >
                  {view.proofOnly
                    ? 'Submit one proof to Lulu'
                    : view.squareEdition
                      ? 'Release square order to Lulu'
                      : 'Submit to Lulu'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function ShippingCorrection({
  address,
  provider,
  suggested,
  taxIdPresent,
  busy,
  proofOnly,
  submit,
}: {
  address: ShippingAddress;
  provider: 'manual' | 'lulu';
  suggested?: NonNullable<PrintView['addressReview']>['suggested'];
  taxIdPresent: boolean;
  busy: boolean;
  proofOnly?: boolean;
  submit: (address: AdminLuluShippingDefaults) => void;
}) {
  const [form, setForm] = useState<AdminLuluShippingDefaults>(address);
  const [confirmed, setConfirmed] = useState(false);
  const fields = {
    country_code: 'Country',
    street1: 'Street',
    street2: 'Address line 2',
    city: 'City',
    postcode: 'Postal code',
    state_code: 'State or region',
  };
  const keepTaxId =
    taxIdPresent &&
    form.country_code === address.country_code &&
    form.name?.trim() === address.name.trim();
  function edit(next: AdminLuluShippingDefaults) {
    setForm(next);
    setConfirmed(false);
  }
  return (
    <form
      className="space-y-2"
      onSubmit={(event) => {
        event.preventDefault();
        if (confirmed)
          submit({ ...form, recipient_tax_id: form.recipient_tax_id?.trim() || undefined });
      }}
    >
      <h4 className="font-semibold">Correct shipping address</h4>
      {suggested &&
        (Object.keys(suggested).length ? (
          <div className="space-y-2">
            <table className="table table-sm">
              <caption className="text-left">Lulu address check</caption>
              <thead>
                <tr>
                  <th>Field</th>
                  <th>Entered</th>
                  <th>Suggested</th>
                </tr>
              </thead>
              <tbody>
                {(Object.keys(fields) as Array<keyof typeof fields>).map((key) => {
                  const label = fields[key];
                  const value = suggested[key];
                  if (value === undefined) return null;
                  return (
                    <tr key={key}>
                      <th scope="row">{label}</th>
                      <td>{address[key] || '—'}</td>
                      <td>{value || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <button
              className="btn btn-sm"
              type="button"
              disabled={busy}
              onClick={() => {
                edit({
                  ...form,
                  ...(suggested.country_code && suggested.country_code !== form.country_code
                    ? { state_code: '', recipient_tax_id: '' }
                    : {}),
                  ...suggested,
                });
              }}
            >
              Use suggested fields
            </button>
          </div>
        ) : (
          <p role="status">
            Lulu could not verify this address. Confirm the missing or incorrect details with the
            recipient.
          </p>
        ))}
      <p>
        Enter the confirmed {proofOnly ? 'staff' : 'customer'} address. Saving keeps the order on
        hold and requires a new proof.
      </p>
      <AdminPrintAddressFields
        shipping={form}
        onChange={edit}
        provider={provider}
        taxIdOnFile={keepTaxId}
      />
      <label className="flex gap-2">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(event) => setConfirmed(event.target.checked)}
        />
        {proofOnly
          ? 'I confirmed the staff shipping address.'
          : 'The customer confirmed this address.'}
      </label>
      <button type="submit" className="btn btn-sm" disabled={busy || !confirmed}>
        Save customer-confirmed address
      </button>
    </form>
  );
}
