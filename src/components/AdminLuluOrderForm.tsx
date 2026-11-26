'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { z } from 'zod';
import {
  AdminPrintDelivery,
  emptyAdminPrintDelivery,
  parseAdminPrintShipping,
  type AdminLuluShippingDefaults,
  type AdminPrintDeliveryValue,
} from '@/components/AdminPrintDelivery';
import {
  adminPrintOrderResult,
  adminPrintProgress,
  type AdminPrintBookFormat,
  type AdminPrintMatch,
  type AdminPrintOrderKind,
  type AdminPrintProvider,
} from '@/lib/admin-print-order';

interface AdminLuluOrderFormProps {
  storyId: string;
  premiumRevision?: string;
  defaultBookFormat?: AdminPrintBookFormat;
  defaultBinding?: 'paperback' | 'hardcover';
  defaultCopies?: number;
  legacyAddress?: AdminLuluShippingDefaults;
  purchaser?: string;
  legacyTicketId?: string;
  requestedThrough?: string;
  onLinked?: () => void | Promise<void>;
}

interface PrintContext {
  premiumRevision?: string;
  customerAddress?: AdminLuluShippingDefaults;
  matches: AdminPrintMatch[];
}

interface PrintOrder {
  ticketId: string;
  printRequestId: string;
  reused?: boolean;
  prepareWarning?: string;
  fulfillment?: z.infer<typeof adminPrintProgress>;
}

interface OrderPayload {
  intentId: string;
  bookFormat: AdminPrintBookFormat;
  revision?: string;
  binding: 'paperback' | 'hardcover';
  copies: number;
  orderKind: AdminPrintOrderKind;
  provider: AdminPrintProvider;
  legacyTicketId?: string;
  shippingAddress: AdminLuluShippingDefaults;
  allowRepeat?: true;
  confirmSeparateLegacyShipment?: true;
}

class PrintRequestError extends Error {
  constructor(
    message: string,
    readonly code?: string,
  ) {
    super(message);
  }
}

const preparationLabels: Partial<Record<string, string>> = {
  pending: 'Preparing',
  preparing: 'Preparing',
  held: 'Preparation on hold',
  manual_review: 'Preparation needs attention',
  proof_ready: 'Ready for review',
};

const countryNames = new Intl.DisplayNames(['en-US'], { type: 'region' });

function PrintMatches({ matches }: { matches: AdminPrintMatch[] }) {
  return (
    <ul className="space-y-2">
      {matches.map((match) => {
        const destination =
          match.countryCode && /^[A-Z]{2}$/.test(match.countryCode)
            ? countryNames.of(match.countryCode)
            : undefined;
        const type =
          match.purpose === 'paid'
            ? 'paid print'
            : match.purpose === 'staff_proof'
              ? 'staff proof'
              : 'print';
        return (
          <li key={match.ticketId} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            <Link href={`/tickets/${match.ticketId}`} className="link link-primary">
              Open {type} ticket {match.orderNumber ?? match.ticketId.slice(0, 8)}
            </Link>
            <span className="text-base-content/70">
              {match.bookFormat === 'premium_square' ? 'Premium Square' : 'Standard A5'}
              {' · '}
              {match.copies} {match.copies === 1 ? 'copy' : 'copies'}
              {destination && ` · ${destination}`}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

export function AdminPrintOrderEntry(props: AdminLuluOrderFormProps) {
  const [opened, setOpened] = useState(false);
  return (
    <details
      className="rounded-lg border border-base-300 p-3"
      onToggle={(event) => {
        if (event.currentTarget.open) setOpened(true);
      }}
    >
      <summary className="cursor-pointer font-semibold">
        {props.legacyTicketId ? 'Upgrade this print ticket' : 'Order a printed copy'}
      </summary>
      {opened && (
        <div className="mt-3">
          <AdminLuluOrderForm key={`${props.storyId}:${props.legacyTicketId ?? ''}`} {...props} />
        </div>
      )}
    </details>
  );
}

export function AdminLuluOrderForm({
  storyId,
  premiumRevision,
  defaultBookFormat = 'standard_a5',
  defaultBinding = 'paperback',
  defaultCopies = 1,
  legacyAddress,
  purchaser,
  legacyTicketId,
  requestedThrough,
  onLinked,
}: AdminLuluOrderFormProps) {
  const path = `/api/admin/stories/${storyId}/print-orders`;
  const storageKey = `mythoria:admin-print:${storyId}:${legacyTicketId ?? 'new'}`;
  const [printContext, setPrintContext] = useState<PrintContext>();
  const [contextError, setContextError] = useState<string>();
  const [formatChoice, setFormatChoice] = useState<AdminPrintBookFormat>();
  const [binding, setBinding] = useState(defaultBinding);
  const [orderKind, setOrderKind] = useState<AdminPrintOrderKind>('admin_order');
  const [copies, setCopies] = useState(Math.min(10, Math.max(1, defaultCopies)));
  const [providerChoice, setProviderChoice] = useState<AdminPrintProvider>();
  const [delivery, setDelivery] = useState<AdminPrintDeliveryValue>(emptyAdminPrintDelivery);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [needsRecovery, setNeedsRecovery] = useState(false);
  const [legacyConflict, setLegacyConflict] = useState(false);
  const [possibleMatch, setPossibleMatch] = useState<{
    matches: AdminPrintMatch[];
    payload: OrderPayload;
  }>();
  const [created, setCreated] = useState<PrintOrder>();
  const running = useRef(false);
  const intentId = useRef<string | undefined>(undefined);
  const errorMessage = useRef<HTMLParagraphElement>(null);

  const revision = printContext ? printContext.premiumRevision : premiumRevision;
  const bookFormat = revision ? (formatChoice ?? defaultBookFormat) : 'standard_a5';
  const effectiveBinding = bookFormat === 'premium_square' ? 'hardcover' : binding;
  const effectiveCopies = orderKind === 'staff_proof' ? 1 : copies;
  const provider = providerChoice ?? (orderKind === 'staff_proof' ? 'manual' : 'lulu');
  const existingStaffTicket =
    orderKind === 'staff_proof' && bookFormat === 'premium_square'
      ? printContext?.matches.find((match) => match.purpose === 'staff_proof')
      : undefined;

  const loadContext = useCallback(
    async (signal?: AbortSignal) => {
      try {
        const search = new URLSearchParams();
        if (legacyTicketId) search.set('legacyTicketId', legacyTicketId);
        if (requestedThrough) search.set('requestedThrough', requestedThrough);
        const response = await fetch(`${path}${search.size ? `?${search}` : ''}`, {
          cache: 'no-store',
          signal,
        });
        const result = await response.json().catch(() => null);
        if (signal?.aborted) return;
        if (!response.ok || !Array.isArray(result?.data?.matches)) {
          throw new Error(result?.error ?? 'Could not look up print options for this story.');
        }
        setPrintContext(result.data);
        setContextError(undefined);
      } catch (err) {
        if (signal?.aborted) return;
        setContextError(err instanceof Error ? err.message : 'Could not look up print options.');
      }
    },
    [path, legacyTicketId, requestedThrough],
  );

  useEffect(() => {
    const controller = new AbortController();
    void loadContext(controller.signal);
    return () => controller.abort();
  }, [loadContext]);

  useEffect(() => {
    if (error) errorMessage.current?.focus();
  }, [error]);

  const send = useCallback(
    async (payload: OrderPayload | { operation: 'recover'; intentId: string }) => {
      const response = await fetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) {
        throw new PrintRequestError(
          result?.error || 'Could not confirm the print ticket.',
          result?.code,
        );
      }
      const data = adminPrintOrderResult.safeParse(result?.data);
      if (!data.success) throw new PrintRequestError('Could not confirm the print ticket.');
      if ('status' in data.data) return data.data;
      const fulfillment = adminPrintProgress.safeParse(result.data.fulfillment);
      return {
        ...data.data,
        fulfillment: fulfillment.success ? fulfillment.data : undefined,
        prepareWarning:
          typeof result.data.prepareWarning === 'string' ? result.data.prepareWarning : undefined,
      };
    },
    [path],
  );

  const complete = useCallback(
    (order: PrintOrder) => {
      setCreated(order);
      setNeedsRecovery(false);
      setPossibleMatch(undefined);
      void onLinked?.();
    },
    [onLinked],
  );

  const recover = useCallback(
    async (id: string) => {
      if (running.current) return;
      running.current = true;
      setBusy(true);
      setNeedsRecovery(true);
      setError(undefined);
      try {
        const result = await send({ operation: 'recover', intentId: id });
        if ('status' in result) throw new PrintRequestError('Could not confirm the print ticket.');
        complete({ ...result, reused: true });
      } catch (err) {
        if (err instanceof PrintRequestError && err.code === 'print_intent_not_found') {
          setNeedsRecovery(false);
          setError(
            'No ticket was found for this attempt. You can review the details and submit again.',
          );
        } else {
          if (
            legacyTicketId &&
            err instanceof PrintRequestError &&
            (err.code === 'print_legacy_conflict' || err.code === 'print_intent_conflict')
          )
            setLegacyConflict(true);
          setError(err instanceof Error ? err.message : 'Could not check the previous request.');
        }
      } finally {
        running.current = false;
        setBusy(false);
      }
    },
    [complete, legacyTicketId, send],
  );

  useEffect(() => {
    if (intentId.current) return;
    try {
      const stored = z.uuid().safeParse(window.localStorage.getItem(storageKey));
      if (stored.success) {
        intentId.current = stored.data;
        void recover(stored.data);
      }
    } catch {
      // Submission confirms that storage is available before it sends an order.
    }
  }, [recover, storageKey]);

  async function create(payload: OrderPayload) {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    setError(undefined);
    try {
      const result = await send(payload);
      if ('status' in result) {
        setPossibleMatch({ matches: result.matches, payload });
      } else {
        complete(result);
      }
    } catch (err) {
      setPossibleMatch(undefined);
      setNeedsRecovery(true);
      if (
        legacyTicketId &&
        err instanceof PrintRequestError &&
        (err.code === 'print_legacy_conflict' || err.code === 'print_intent_conflict')
      )
        setLegacyConflict(true);
      setError(err instanceof Error ? err.message : 'Could not confirm the print ticket.');
    } finally {
      running.current = false;
      setBusy(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (running.current || !printContext || existingStaffTicket) return;
    const shipping = parseAdminPrintShipping(delivery, provider);
    if (!shipping.success) {
      setError(shipping.error.issues[0]?.message ?? 'Enter a valid shipping address.');
      return;
    }

    try {
      const saved = z.uuid().safeParse(window.localStorage.getItem(storageKey));
      if (saved.success && saved.data !== intentId.current) {
        intentId.current = saved.data;
        void recover(saved.data);
        return;
      }
      const id = intentId.current ?? window.crypto.randomUUID();
      window.localStorage.setItem(storageKey, id);
      intentId.current = id;
      void create({
        intentId: id,
        bookFormat,
        revision: bookFormat === 'premium_square' ? revision : undefined,
        binding: effectiveBinding,
        copies: effectiveCopies,
        orderKind,
        provider,
        legacyTicketId,
        shippingAddress: shipping.data,
      });
    } catch {
      setError(
        'This browser could not save the request reference. Enable site storage before submitting.',
      );
    }
  }

  function startAnother() {
    try {
      const saved = z.uuid().safeParse(window.localStorage.getItem(storageKey));
      if (saved.success && saved.data !== intentId.current) {
        setCreated(undefined);
        intentId.current = saved.data;
        void recover(saved.data);
        return;
      }
      window.localStorage.removeItem(storageKey);
      intentId.current = undefined;
      setCreated(undefined);
      setError(undefined);
      setOrderKind('admin_order');
      setProviderChoice(undefined);
      setDelivery(emptyAdminPrintDelivery);
    } catch {
      setError('This browser could not start a separate print request.');
    }
  }

  const alert = error && (
    <p className="text-sm text-error" role="alert" tabIndex={-1} ref={errorMessage}>
      {error}
    </p>
  );

  if (created) {
    const fulfillment = created.fulfillment;
    const reason = created.prepareWarning || fulfillment?.holdReason || fulfillment?.lastError;
    const status =
      preparationLabels[fulfillment?.status ?? ''] ??
      (created.reused
        ? 'Existing ticket found'
        : legacyTicketId
          ? 'Ticket upgraded'
          : 'Ticket created');
    return (
      <div className="space-y-3 rounded-lg border border-base-300 p-3">
        <div role="status" className="text-sm">
          <p className="font-medium">{status}</p>
          {reason && <p>{reason}</p>}
        </div>
        {alert}
        <div className="flex flex-wrap gap-2">
          <Link href={`/tickets/${created.ticketId}`} className="btn btn-primary btn-sm">
            {created.reused || legacyTicketId || reason
              ? 'Open existing ticket'
              : 'Open print ticket'}
          </Link>
          {!legacyTicketId && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={startAnother}>
              Order another printed copy
            </button>
          )}
        </div>
      </div>
    );
  }

  if (legacyConflict && legacyTicketId) {
    return (
      <div className="space-y-3">
        {alert}
        <Link
          href={`/tickets/${legacyTicketId}`}
          className="btn btn-outline btn-sm"
          onClick={() => void onLinked?.()}
        >
          Open existing ticket
        </Link>
      </div>
    );
  }

  if (needsRecovery) {
    return (
      <div className="space-y-3" aria-busy={busy}>
        {alert}
        <p role="status" className="text-sm">
          {busy
            ? 'Checking the previous print request…'
            : 'Check the previous request before sending it again.'}
        </p>
        {!busy && (
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => {
              if (intentId.current) void recover(intentId.current);
            }}
          >
            Check previous request
          </button>
        )}
      </div>
    );
  }

  if (possibleMatch) {
    const existingStaffProof = possibleMatch.matches.some(
      (match) => match.purpose === 'staff_proof',
    );
    const canContinue =
      !existingStaffProof &&
      (!legacyTicketId || possibleMatch.matches.every((match) => match.purpose === 'paid'));
    return (
      <div className="space-y-3" aria-busy={busy}>
        <p role="status" className="text-sm font-medium">
          {existingStaffProof
            ? 'A staff proof already exists for this edition.'
            : legacyTicketId
              ? 'Check whether one of these paid orders covers this legacy ticket.'
              : 'A print ticket may match these details.'}
        </p>
        <PrintMatches matches={possibleMatch.matches} />
        <div className="flex flex-wrap gap-2">
          {canContinue && (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={busy}
              onClick={() =>
                void create({
                  ...possibleMatch.payload,
                  ...(legacyTicketId
                    ? { confirmSeparateLegacyShipment: true }
                    : { allowRepeat: true }),
                })
              }
            >
              {busy
                ? 'Saving print order…'
                : legacyTicketId
                  ? 'Confirm separate shipment on this ticket'
                  : 'Create a separate shipment'}
            </button>
          )}
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            disabled={busy}
            onClick={() => setPossibleMatch(undefined)}
          >
            Edit print details
          </button>
        </div>
      </div>
    );
  }

  if (!printContext) {
    return contextError ? (
      <div className="space-y-2">
        <p role="alert" className="text-sm text-error">
          {contextError}
        </p>
        <button type="button" className="btn btn-outline btn-sm" onClick={() => void loadContext()}>
          Check print options again
        </button>
      </div>
    ) : (
      <p role="status" className="text-sm">
        Checking print options…
      </p>
    );
  }

  return (
    <form className="space-y-3" onSubmit={handleSubmit} aria-busy={busy}>
      {printContext.matches.length > 0 && (
        <div className="space-y-2 rounded-lg bg-base-200 p-3">
          <p className="text-sm font-medium">Existing print orders</p>
          <PrintMatches matches={printContext.matches} />
        </div>
      )}
      <fieldset className="grid gap-3 sm:grid-cols-2" disabled={busy}>
        {!legacyTicketId && (
          <label className="grid gap-1 text-sm">
            <span>Order type</span>
            <select
              className="select select-bordered select-sm w-full"
              value={orderKind}
              onChange={(event) => {
                setOrderKind(event.target.value as AdminPrintOrderKind);
                setProviderChoice(undefined);
              }}
            >
              <option value="admin_order">Print and ship</option>
              <option value="staff_proof">One staff proof</option>
            </select>
          </label>
        )}

        <label className="grid gap-1 text-sm">
          <span>Book format</span>
          <select
            className="select select-bordered select-sm w-full"
            value={bookFormat}
            disabled={!revision}
            onChange={(event) => setFormatChoice(event.target.value as AdminPrintBookFormat)}
          >
            {revision && <option value="premium_square">Premium Square 8.5×8.5&quot;</option>}
            <option value="standard_a5">Standard A5 (5.83×8.27&quot;)</option>
          </select>
        </label>

        <label className="grid gap-1 text-sm">
          <span>Binding</span>
          <select
            className="select select-bordered select-sm w-full"
            value={effectiveBinding}
            disabled={bookFormat === 'premium_square'}
            onChange={(event) => setBinding(event.target.value as 'paperback' | 'hardcover')}
          >
            {bookFormat === 'standard_a5' && <option value="paperback">Paperback</option>}
            <option value="hardcover">Hardcover</option>
          </select>
        </label>

        <label className="grid gap-1 text-sm">
          <span>Copies</span>
          <input
            type="number"
            min={1}
            max={10}
            className="input input-bordered input-sm w-full"
            value={effectiveCopies}
            disabled={orderKind === 'staff_proof'}
            onChange={(event) =>
              setCopies(Math.min(10, Math.max(1, Number(event.target.value) || 1)))
            }
          />
        </label>

        <label className="grid gap-1 text-sm sm:col-span-2">
          <span>Fulfillment provider</span>
          <select
            className="select select-bordered select-sm w-full"
            value={provider}
            onChange={(event) => setProviderChoice(event.target.value as AdminPrintProvider)}
          >
            <option value="lulu">Lulu Print &amp; Ship</option>
            <option value="manual">Manual printer partner</option>
          </select>
        </label>
      </fieldset>

      {alert}
      {existingStaffTicket ? (
        <p role="status" className="text-sm">
          Open the existing staff proof for this edition above.
        </p>
      ) : (
        <>
          <AdminPrintDelivery
            value={delivery}
            onChange={setDelivery}
            busy={busy}
            provider={provider}
            customerAddress={printContext.customerAddress}
            legacyAddress={legacyAddress}
            purchaser={purchaser}
            proofRecipient="Staff review on the print ticket"
          />
          <button type="submit" className="btn btn-primary btn-sm" disabled={busy}>
            {busy
              ? 'Creating print ticket…'
              : legacyTicketId
                ? 'Upgrade print ticket'
                : 'Create print ticket'}
          </button>
        </>
      )}
    </form>
  );
}
