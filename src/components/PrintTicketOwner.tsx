'use client';

import { useState } from 'react';

export function PrintTicketOwner({
  ticketId,
  owner,
  email,
  active,
  reload,
}: {
  ticketId: string;
  owner?: string;
  email?: string | null;
  active: boolean;
  reload: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function changeOwner() {
    setBusy(true);
    setError('');
    try {
      const response = await fetch(`/api/tickets/${ticketId}/print-owner`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: owner ? 'release' : 'claim' }),
      });
      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        throw new Error(result.error || 'Could not update the print owner.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update the print owner.');
    } finally {
      try {
        await reload();
      } finally {
        setBusy(false);
      }
    }
  }
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span>Owner: {owner || 'Unassigned'}</span>
        {active && email && (!owner || owner.toLowerCase() === email.toLowerCase()) && (
          <button
            type="button"
            className="btn btn-ghost btn-xs"
            disabled={busy}
            onClick={() => void changeOwner()}
          >
            {owner ? 'Release ownership' : 'Assign to me'}
          </button>
        )}
      </div>
      {error && (
        <p role="alert" className="text-error text-sm">
          {error}
        </p>
      )}
    </div>
  );
}
