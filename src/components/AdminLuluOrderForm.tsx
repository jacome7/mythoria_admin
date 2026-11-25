'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';

export interface AdminLuluShippingDefaults {
  name?: string;
  email?: string;
  phone_number?: string;
  street1?: string;
  street2?: string;
  city?: string;
  postcode?: string;
  state_code?: string;
  country_code?: string;
  recipient_tax_id?: string;
}

interface AdminLuluOrderFormProps {
  storyId: string;
  hasPublishedPremiumEdition: boolean;
  defaultBookFormat?: 'premium_square' | 'standard_a5';
  defaultBinding?: 'paperback' | 'hardcover';
  defaultCopies?: number;
  defaultShipping?: AdminLuluShippingDefaults;
  legacyTicketId?: string;
  onLinked?: (result: { ticketId: string; printRequestId: string }) => void | Promise<void>;
}

const addressFields: {
  key: keyof AdminLuluShippingDefaults;
  label: string;
  maxLength: number;
  required?: boolean;
  type?: string;
  pattern?: string;
  hint?: string;
}[] = [
  {
    key: 'name',
    label: 'Recipient name',
    maxLength: 35,
    required: true,
    hint: 'Max 35 chars for Lulu',
  },
  { key: 'email', label: 'Recipient email', maxLength: 255, required: true, type: 'email' },
  {
    key: 'phone_number',
    label: 'Carrier phone',
    maxLength: 20,
    required: true,
    type: 'tel',
    hint: '8-20 chars (e.g. +351210000000)',
  },
  {
    key: 'street1',
    label: 'Street address',
    maxLength: 30,
    required: true,
    hint: 'Max 30 chars for Lulu',
  },
  { key: 'street2', label: 'Address line 2', maxLength: 30, hint: 'Max 30 chars' },
  { key: 'city', label: 'City', maxLength: 30, required: true, hint: 'Max 30 chars' },
  { key: 'postcode', label: 'Postal code', maxLength: 20, required: true },
  {
    key: 'state_code',
    label: 'State / region code',
    maxLength: 3,
    hint: 'Required short code for US/CA/AU/ES/IT/BR/MX/etc.',
  },
  {
    key: 'country_code',
    label: 'Country code (ISO-2)',
    maxLength: 2,
    required: true,
    pattern: '[A-Za-z]{2}',
  },
  {
    key: 'recipient_tax_id',
    label: 'Recipient tax ID',
    maxLength: 40,
    hint: 'Required for BR, CL, MX',
  },
];

export function AdminLuluOrderForm({
  storyId,
  hasPublishedPremiumEdition,
  defaultBookFormat,
  defaultBinding,
  defaultCopies = 1,
  defaultShipping,
  legacyTicketId,
  onLinked,
}: AdminLuluOrderFormProps) {
  const initialFormat =
    hasPublishedPremiumEdition && defaultBookFormat === 'premium_square'
      ? 'premium_square'
      : 'standard_a5';
  const [bookFormat, setBookFormat] = useState<'premium_square' | 'standard_a5'>(initialFormat);
  const [binding, setBinding] = useState<'paperback' | 'hardcover'>(
    initialFormat === 'premium_square' ? 'hardcover' : (defaultBinding ?? 'paperback'),
  );
  const [orderKind, setOrderKind] = useState<'staff_proof' | 'admin_order'>(
    defaultCopies > 1 ? 'admin_order' : 'admin_order',
  );
  const [copies, setCopies] = useState<number>(Math.min(10, Math.max(1, defaultCopies)));
  const [provider, setProvider] = useState<'lulu' | 'manual'>('lulu');
  const [shipping, setShipping] = useState<AdminLuluShippingDefaults>({
    name: defaultShipping?.name ?? '',
    email: defaultShipping?.email ?? '',
    phone_number: defaultShipping?.phone_number ?? '',
    street1: defaultShipping?.street1 ?? '',
    street2: defaultShipping?.street2 ?? '',
    city: defaultShipping?.city ?? '',
    postcode: defaultShipping?.postcode ?? '',
    state_code: defaultShipping?.state_code ?? '',
    country_code: defaultShipping?.country_code ?? '',
    recipient_tax_id: defaultShipping?.recipient_tax_id ?? '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{
    ticketId: string;
    printRequestId: string;
    prepareWarning?: string;
  } | null>(null);

  const effectiveBinding = bookFormat === 'premium_square' ? 'hardcover' : binding;
  const effectiveCopies = orderKind === 'staff_proof' ? 1 : copies;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const payloadShipping = {
        name: shipping.name?.trim() ?? '',
        email: shipping.email?.trim() ?? '',
        phone_number: shipping.phone_number?.trim() ?? '',
        street1: shipping.street1?.trim() ?? '',
        ...(shipping.street2?.trim() ? { street2: shipping.street2.trim() } : {}),
        city: shipping.city?.trim() ?? '',
        postcode: shipping.postcode?.trim() ?? '',
        ...(shipping.state_code?.trim()
          ? { state_code: shipping.state_code.trim().toUpperCase() }
          : {}),
        country_code: (shipping.country_code?.trim() ?? '').toUpperCase(),
        ...(shipping.recipient_tax_id?.trim()
          ? { recipient_tax_id: shipping.recipient_tax_id.trim() }
          : {}),
      };
      const response = await fetch(`/api/admin/stories/${storyId}/lulu-print`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookFormat,
          binding: effectiveBinding,
          copies: effectiveCopies,
          orderKind,
          provider,
          prepareNow: true,
          ...(legacyTicketId ? { legacyTicketId } : {}),
          shippingAddress: payloadShipping,
        }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.data?.ticketId) {
        throw new Error(result?.error || 'Could not create the Lulu print order.');
      }
      setCreated(result.data);
      if (onLinked) await onLinked(result.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create the Lulu print order.');
    } finally {
      setBusy(false);
    }
  }

  if (created) {
    return (
      <div className="space-y-3 rounded-lg border border-success/40 bg-success/5 p-3">
        <p className="text-sm font-medium text-success">
          Print fulfillment order prepared and linked to ticket {created.ticketId.slice(0, 8)}.
        </p>
        {created.prepareWarning && (
          <p className="text-xs text-warning" role="status">
            {created.prepareWarning}
          </p>
        )}
        <Link href={`/tickets/${created.ticketId}`} className="btn btn-primary btn-sm">
          Open Print Fulfillment Ticket
        </Link>
      </div>
    );
  }

  return (
    <form className="space-y-3" onSubmit={(event) => void handleSubmit(event)}>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1 text-sm">
          <span>Book format</span>
          <select
            className="select select-bordered select-sm w-full"
            value={bookFormat}
            disabled={busy || !hasPublishedPremiumEdition}
            onChange={(event) => {
              const next = event.target.value as 'premium_square' | 'standard_a5';
              setBookFormat(next);
              if (next === 'premium_square') setBinding('hardcover');
            }}
          >
            {hasPublishedPremiumEdition && (
              <option value="premium_square">Premium Square 8.5×8.5&quot; Hardcover</option>
            )}
            <option value="standard_a5">Standard A5 (5.83×8.27&quot;)</option>
          </select>
        </label>

        <label className="grid gap-1 text-sm">
          <span>Binding</span>
          <select
            className="select select-bordered select-sm w-full"
            value={effectiveBinding}
            disabled={busy || bookFormat === 'premium_square'}
            onChange={(event) => setBinding(event.target.value as 'paperback' | 'hardcover')}
          >
            {bookFormat === 'standard_a5' && <option value="paperback">Paperback</option>}
            <option value="hardcover">Hardcover (Casewrap)</option>
          </select>
        </label>

        <label className="grid gap-1 text-sm">
          <span>Order type</span>
          <select
            className="select select-bordered select-sm w-full"
            value={orderKind}
            disabled={busy}
            onChange={(event) => {
              const next = event.target.value as 'staff_proof' | 'admin_order';
              setOrderKind(next);
              if (next === 'staff_proof') setCopies(1);
            }}
          >
            <option value="admin_order">Admin print &amp; ship (1-10 copies)</option>
            <option value="staff_proof">Staff proof (1 copy)</option>
          </select>
        </label>

        <label className="grid gap-1 text-sm">
          <span>Copies</span>
          <input
            type="number"
            min={1}
            max={orderKind === 'staff_proof' ? 1 : 10}
            className="input input-bordered input-sm w-full"
            value={effectiveCopies}
            disabled={busy || orderKind === 'staff_proof'}
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
            disabled={busy}
            onChange={(event) => setProvider(event.target.value as 'lulu' | 'manual')}
          >
            <option value="lulu">Lulu Print &amp; Ship</option>
            <option value="manual">Manual printer partner</option>
          </select>
        </label>
      </div>

      <fieldset className="grid gap-2 sm:grid-cols-2" disabled={busy}>
        {addressFields.map(({ key, label, maxLength, required, type, pattern, hint }) => (
          <label key={key} className="grid gap-1 text-sm">
            <span>{label}</span>
            <input
              className="input input-bordered input-sm w-full"
              name={key}
              type={type ?? 'text'}
              maxLength={provider === 'lulu' ? maxLength : 255}
              required={required}
              pattern={pattern}
              value={shipping[key] ?? ''}
              onChange={(event) => setShipping((prev) => ({ ...prev, [key]: event.target.value }))}
            />
            {hint && <span className="text-xs text-base-content/60">{hint}</span>}
          </label>
        ))}
      </fieldset>

      {error && (
        <p className="text-sm text-error" role="alert">
          {error}
        </p>
      )}

      <button type="submit" className="btn btn-primary btn-sm" disabled={busy}>
        {busy ? 'Creating & preparing Lulu order...' : 'Create & Prepare Print Order'}
      </button>
    </form>
  );
}
