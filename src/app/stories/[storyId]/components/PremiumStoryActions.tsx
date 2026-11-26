'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { AdminLuluOrderForm } from '@/components/AdminLuluOrderForm';
import type { PremiumEditionSummary } from '@/lib/premium-edition';
import { PremiumPrintActions } from './PremiumPrintActions';

const fields = [
  { name: 'name', label: 'Staff recipient', maxLength: 120, required: true },
  { name: 'email', label: 'Staff email', maxLength: 255, required: true, type: 'email' },
  { name: 'phone_number', label: 'Phone', maxLength: 30, required: true, type: 'tel' },
  { name: 'street1', label: 'Street address', maxLength: 255, required: true },
  { name: 'street2', label: 'Address line 2', maxLength: 255 },
  { name: 'city', label: 'City', maxLength: 120, required: true },
  { name: 'postcode', label: 'Postal code', maxLength: 20 },
  { name: 'state_code', label: 'State or region code', maxLength: 120 },
  {
    name: 'country_code',
    label: 'Country code',
    maxLength: 2,
    required: true,
    pattern: '[A-Za-z]{2}',
  },
  { name: 'recipient_tax_id', label: 'Recipient tax ID (if required)', maxLength: 40 },
];

export function PremiumStoryActions({
  storyId,
  edition,
}: {
  storyId: string;
  edition: PremiumEditionSummary;
}) {
  const [ticketId, setTicketId] = useState<string>();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const revision =
    'revision' in edition && edition.state === 'published' ? edition.revision : undefined;

  async function requestProof(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || ticketId || !revision) return;
    const shippingAddress = Object.fromEntries(new FormData(event.currentTarget));
    setBusy(true);
    setError(undefined);
    try {
      const response = await fetch(`/api/admin/stories/${storyId}/premium-edition`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ revision, shippingAddress }),
      });
      const result = await response.json();
      if (!response.ok || !result.data?.ticketId) {
        throw new Error(result.error || 'Could not create the staff proof ticket.');
      }
      setTicketId(result.data.ticketId);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not create the staff proof ticket.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card bg-base-100 shadow-xl">
      <div className="card-body space-y-3">
        <h2 className="card-title">Premium Edition</h2>
        {revision ? (
          <>
            <p className="text-sm break-all">Revision {revision}</p>
            <Link href={`/stories/${storyId}/read`} className="btn btn-primary">
              Read Premium Edition
            </Link>
            <PremiumPrintActions key={revision} storyId={storyId} revision={revision} />
            {ticketId ? (
              <Link href={`/tickets/${ticketId}`} className="btn btn-outline">
                Open Staff Proof Ticket
              </Link>
            ) : (
              <details className="rounded-lg border border-base-300 p-3">
                <summary className="cursor-pointer font-semibold">
                  Request one staff print proof
                </summary>
                <p className="my-2 text-sm">
                  Creates a ticket for one square hardcover copy. Review and release the print job
                  from the ticket.
                </p>
                <form className="space-y-2" onSubmit={(event) => void requestProof(event)}>
                  <fieldset className="grid gap-2 sm:grid-cols-2" disabled={busy}>
                    {fields.map(({ name, label, ...input }) => (
                      <label key={name} className="grid gap-1 text-sm">
                        {label}
                        <input
                          className="input input-bordered input-sm w-full"
                          name={name}
                          {...input}
                        />
                      </label>
                    ))}
                  </fieldset>
                  {error && (
                    <p className="text-error text-sm" role="alert">
                      {error}
                    </p>
                  )}
                  <button className="btn btn-outline btn-sm" type="submit" disabled={busy}>
                    {busy ? 'Creating ticket…' : 'Create Proof Ticket'}
                  </button>
                </form>
              </details>
            )}
            <details className="rounded-lg border border-base-300 p-3">
              <summary className="cursor-pointer font-semibold">
                Dispatch Print Order via Lulu (1–10 copies)
              </summary>
              <p className="my-2 text-sm text-base-content/70">
                Create an admin print-and-ship order (Premium Square Hardcover or Standard A5) and
                prepare Lulu-compliant interior &amp; cover PDFs immediately.
              </p>
              <AdminLuluOrderForm
                storyId={storyId}
                hasPublishedPremiumEdition={Boolean(revision)}
                defaultBookFormat="premium_square"
                defaultBinding="hardcover"
              />
            </details>
          </>
        ) : (
          <p role="status">
            {edition.state === 'queued'
              ? 'The premium edition is in production.'
              : 'A published edition is unavailable.'}
          </p>
        )}
      </div>
    </section>
  );
}
