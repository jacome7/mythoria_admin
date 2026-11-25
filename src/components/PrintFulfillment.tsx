'use client';

import { useCallback, useEffect, useState } from 'react';

interface PrintView {
  provider: string;
  status: string;
  proofVersion: number;
  copies: number;
  binding: string;
  proofOnly?: boolean;
  adminOrder?: boolean;
  orderOrigin?: 'customer' | 'staff_proof' | 'admin_order';
  luluConfigured?: boolean;
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
    id: string;
    status: string;
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

export function PrintFulfillment({ ticketId, closed }: { ticketId: string; closed: boolean }) {
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
  useEffect(() => {
    if (closed || !view || !['pending', 'preparing', 'submitting'].includes(view.status)) {
      return;
    }
    const timer = setInterval(() => {
      void command<PrintView>({ operation: 'get', ticketId })
        .then((result) => setView(result))
        .catch(() => {});
    }, 4000);
    return () => clearInterval(timer);
  }, [closed, ticketId, view]);
  const quote = view?.quote;
  const skipInboxCheck = Boolean(view?.proofOnly || view?.adminOrder);
  const ready =
    !closed &&
    view?.status === 'proof_ready' &&
    view.proof?.qaPassed &&
    (Boolean(view.proof.sentAt) || skipInboxCheck) &&
    !view.holdReason;
  const canSubmit =
    ready &&
    view.provider === 'lulu' &&
    (!view.squareEdition ||
      (view.proof?.supplierValidated &&
        view.maxEurPerCopy > 0 &&
        quote &&
        Math.round(quote.totalEur * 100) <= Math.round(view.maxEurPerCopy * 100) * view.copies)) &&
    quote &&
    checkedInbox &&
    Number(amount) === quote.totalEur;
  const canEdit =
    !closed && view && ['pending', 'proof_ready', 'held', 'manual_review'].includes(view.status);
  const vendorStatusUpper = view?.vendor?.status?.toUpperCase();
  const isUnpaid = Boolean(view?.vendor?.unpaid || vendorStatusUpper === 'UNPAID');
  const isProductionDelayed = vendorStatusUpper === 'PRODUCTION_DELAYED';
  const trackingUrls = Array.isArray(view?.vendor?.tracking)
    ? view.vendor.tracking.filter((item): item is string => typeof item === 'string')
    : [];
  return (
    <div className="card bg-base-100 shadow-sm">
      <div className="card-body">
        <h3 className="card-title">Print fulfillment</h3>
        {message && <p role="alert">{message}</p>}
        {view && (
          <>
            {view.proofOnly ? (
              <p className="font-semibold">Staff proof · One copy · No customer charge</p>
            ) : view.adminOrder ? (
              <p className="font-semibold">
                Admin print order · {view.copies} {view.copies === 1 ? 'copy' : 'copies'} · No
                customer charge
              </p>
            ) : null}
            <p>
              Provider: {view.provider} · Status: {view.status} · Copies: {view.copies} · Binding:{' '}
              {view.binding}
            </p>
            <p>Limit: €{view.maxEurPerCopy} per copy</p>
            {view.status === 'uncertain' && (
              <div className="alert alert-error text-sm" role="alert">
                Submission state is uncertain. Click &quot;Refresh order&quot; to reconcile with
                Lulu before creating or retrying any job.
              </div>
            )}
            {view.provider === 'lulu' && isUnpaid && (
              <div className="alert alert-warning text-sm" role="alert">
                Lulu job is <strong>UNPAID</strong>. Fund your Lulu Developer account / payment
                method or cancel this job before production can start.
              </div>
            )}
            {view.provider === 'lulu' && isProductionDelayed && (
              <div className="alert alert-info text-sm" role="status">
                Lulu job is queued in <strong>PRODUCTION_DELAYED</strong> (cancelable until it moves
                to production).
              </div>
            )}
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
            {view.holdReason && <p>Hold: {view.holdReason}</p>}
            {view.holdReason && !closed && (
              <ShippingCorrection
                key={`${view.proofVersion}-${view.shippingAddress.street1}`}
                address={view.shippingAddress}
                taxIdPresent={view.taxIdPresent}
                busy={busy}
                proofOnly={view.proofOnly}
                submit={(shippingAddress) =>
                  void run('correctShipping', { customerConfirmed: true, shippingAddress })
                }
              />
            )}
            {view.squareEdition && !view.proofOnly && view.status === 'held' && !closed && (
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
            {view.provider === 'lulu' && view.vendor && (
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
                ) : (
                  <p className="text-xs text-base-content/70">
                    Tracking: Pending carrier assignment
                  </p>
                )}
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
                {!closed && view.vendor.cancelable && (
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <input
                      className="input input-bordered input-xs"
                      aria-label="Cancellation reason"
                      placeholder="Reason to cancel Lulu job"
                      value={cancelReason}
                      onChange={(event) => setCancelReason(event.target.value)}
                    />
                    <button
                      type="button"
                      className="btn btn-error btn-xs"
                      disabled={busy || !cancelReason.trim()}
                      onClick={() => {
                        const trimmed = cancelReason.trim();
                        setCancelReason('');
                        void run('cancel', { reason: trimmed });
                      }}
                    >
                      Cancel Lulu job
                    </button>
                  </div>
                )}
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              {canEdit && (
                <>
                  <button
                    className="btn btn-sm"
                    disabled={busy || closed}
                    onClick={() => void run('select', { provider: 'lulu' })}
                  >
                    {view.squareEdition ? 'Prepare for Lulu' : 'Select Lulu'}
                  </button>
                  <button
                    className="btn btn-sm"
                    disabled={busy || closed}
                    onClick={() => void run('select', { provider: 'manual' })}
                  >
                    {view.squareEdition ? 'Prepare for manual printer' : 'Select manual'}
                  </button>
                  {!view.squareEdition && (
                    <button
                      className="btn btn-sm"
                      disabled={busy || closed}
                      onClick={() => void run('revise')}
                    >
                      Revise proof
                    </button>
                  )}
                </>
              )}
              <button
                className="btn btn-sm"
                disabled={busy || closed}
                onClick={() => void run('prepare', { runImmediately: true })}
              >
                {view.provider === 'lulu' ? 'Prepare proof and quote' : 'Prepare proof'}
              </button>
              <button className="btn btn-sm" disabled={busy} onClick={() => void run('reconcile')}>
                Refresh order
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              <input
                className="input input-bordered input-sm"
                placeholder="Reason for hold"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
              />
              <button
                className="btn btn-sm"
                disabled={busy || closed || !reason.trim()}
                onClick={() => void run('hold', { reason: reason.trim() })}
              >
                Put on hold
              </button>
              <button
                className="btn btn-sm"
                disabled={busy || closed || !view.holdReason}
                onClick={() => void run('clear')}
              >
                Clear hold
              </button>
            </div>
            {view.provider === 'lulu' && quote && !closed && (
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
                  disabled={busy || !canSubmit}
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
  taxIdPresent,
  busy,
  proofOnly,
  submit,
}: {
  address: ShippingAddress;
  taxIdPresent: boolean;
  busy: boolean;
  proofOnly?: boolean;
  submit: (address: ShippingAddress & { recipient_tax_id?: string }) => void;
}) {
  const [form, setForm] = useState(address);
  const [taxId, setTaxId] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const fields: { key: keyof ShippingAddress; label: string; required?: boolean }[] = [
    { key: 'name', label: 'Recipient', required: true },
    { key: 'street1', label: 'Street', required: true },
    { key: 'street2', label: 'Address line 2' },
    { key: 'city', label: 'City', required: true },
    { key: 'postcode', label: 'Postal code' },
    { key: 'country_code', label: 'Country code', required: true },
    { key: 'state_code', label: 'State or region' },
    { key: 'phone_number', label: 'Phone' },
    { key: 'email', label: 'Email', required: true },
  ];
  return (
    <form
      className="space-y-2"
      onSubmit={(event) => {
        event.preventDefault();
        if (confirmed)
          submit({ ...form, ...(taxId.trim() ? { recipient_tax_id: taxId.trim() } : {}) });
      }}
    >
      <h4 className="font-semibold">Correct shipping address</h4>
      <p>
        Enter the confirmed {proofOnly ? 'staff' : 'customer'} address. Saving keeps the order on
        hold and requires a new proof.
      </p>
      {fields.map(({ key, label, required }) => (
        <label key={key} className="block">
          {label}
          <input
            className="input input-bordered input-sm w-full"
            required={required}
            value={form[key] || ''}
            onChange={(event) => setForm({ ...form, [key]: event.target.value })}
          />
        </label>
      ))}
      <label className="block">
        Tax ID{' '}
        {taxIdPresent
          ? '(already provided; leave blank to retain for the same country)'
          : '(if required)'}
        <input
          className="input input-bordered input-sm w-full"
          value={taxId}
          onChange={(event) => setTaxId(event.target.value)}
        />
      </label>
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
