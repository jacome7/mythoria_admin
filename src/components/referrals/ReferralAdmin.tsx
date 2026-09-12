'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
type Item = Record<string, unknown>;
type Props = { view: string; id?: string; permissions: string[] };
async function api(path: string, body?: unknown, method = 'POST') {
  const response = await fetch(
    `/api/admin/referrals/${path}`,
    body === undefined
      ? { cache: 'no-store' }
      : { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
  );
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Request failed');
  return result.data;
}
export default function ReferralAdmin({ view, id, permissions }: Props) {
  const [items, setItems] = useState<Item[]>([]);
  const [owner, setOwner] = useState<Item | null>(null);
  const [ownerSummary, setOwnerSummary] = useState<Item | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [version, setVersion] = useState(0);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [rate, setRate] = useState('10');
  const [reason, setReason] = useState('');
  const [effective, setEffective] = useState('');
  const [selected, setSelected] = useState('');
  const [amount, setAmount] = useState('');
  const [reference, setReference] = useState('');
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [paidAt, setPaidAt] = useState('');
  const [preview, setPreview] = useState<Item | null>(null);
  const [legalName, setLegalName] = useState('');
  const [country, setCountry] = useState('');
  const [locale, setLocale] = useState('pt-PT');
  const [memberRole, setMemberRole] = useState('owner');
  const [ownerFilter, setOwnerFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  useEffect(() => {
    setOwnerFilter(new URLSearchParams(window.location.search).get('ownerId') || '');
  }, []);
  const can = (permission: string) => permissions.includes(`referrals:${permission}`);
  const execute = async (action: () => Promise<unknown>) => {
    setBusy(true);
    setMessage('');
    try {
      await action();
      setMessage('Saved.');
      setVersion((v) => v + 1);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Request failed');
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    if (view === 'new') return;
    const path = id ? `owners/${id}` : view === 'overview' ? 'owners' : view;
    const query = new URLSearchParams({ page: String(page), limit: '25' });
    if (ownerFilter) query.set('ownerId', ownerFilter);
    if (statusFilter && view === 'commissions') query.set('status', statusFilter);
    let cancelled = false;
    if (id)
      void api(`owners/${id}/summary`)
        .then((data) => {
          if (!cancelled) setOwnerSummary(data);
        })
        .catch(() => {
          if (!cancelled) setMessage('The funnel could not be loaded.');
        });
    void api(`${path}?${query}`)
      .then((data) => {
        if (cancelled) return;
        if (id) {
          setOwner(data);
          setName(data.owner.displayName);
          setEmail(data.owner.contactEmailNormalized);
          setCode(data.code.code);
          setLegalName(data.owner.legalName || '');
          setCountry(data.owner.countryCode || '');
          setLocale(data.owner.preferredLocale);
          const current = data.terms.find(
            (t: Item) => new Date(String(t.effectiveFrom)) <= new Date(),
          );
          setRate(String(Number(current?.commissionRateBps ?? 1000) / 100));
        } else setItems(Array.isArray(data) ? data : data.items || []);
      })
      .catch((error) => setMessage(error.message));
    return () => {
      cancelled = true;
    };
  }, [view, id, version, ownerFilter, statusFilter, page]);
  const money = (value: unknown) =>
    new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR' }).format(
      Number(value || 0) / 100,
    );
  const date = (value: unknown) => (value ? new Date(String(value)).toLocaleString('en-GB') : '—');
  return (
    <div className="space-y-6">
      <nav className="flex flex-wrap gap-4">
        {[
          ['', 'Overview'],
          ['owners', 'Owners'],
          ['owners/new', 'New owner'],
          ['commissions', 'Commissions'],
          ['settlements', 'Settlements'],
          ['reconciliation', 'Reconciliation'],
        ].map(([path, label]) => (
          <Link className="link link-primary" key={path} href={`/referrals/${path}`}>
            {label}
          </Link>
        ))}
      </nav>
      {message && (
        <p role="status" className="alert">
          {message}
        </p>
      )}
      {(view === 'new' || id) && can('manage') && (
        <form
          className="card bg-base-100 shadow-sm"
          onSubmit={(e) => {
            e.preventDefault();
            void execute(async () => {
              if (id)
                await api(
                  `owners/${id}`,
                  {
                    displayName: name,
                    legalName,
                    countryCode: country || undefined,
                    preferredLocale: locale,
                    contactEmailNormalized: email,
                  },
                  'PATCH',
                );
              else {
                const created = await api('owners', {
                  displayName: name,
                  contactEmail: email,
                  code,
                  commissionRateBps: Math.round(Number(rate) * 100),
                  memberEmails: [email],
                  preferredLocale: locale,
                  legalName,
                  countryCode: country || undefined,
                });
                window.location.href = `/referrals/owners/${created.referralOwnerId}`;
              }
            });
          }}
        >
          <div className="card-body">
            <h2 className="card-title">{id ? 'Partner details' : 'Create referral owner'}</h2>
            <label>
              Legal name
              <input
                className="input input-bordered w-full"
                value={legalName}
                onChange={(e) => setLegalName(e.target.value)}
              />
            </label>
            <label>
              Country (two-letter code)
              <input
                className="input input-bordered w-full"
                value={country}
                maxLength={2}
                pattern="[A-Z]{2}"
                onChange={(e) => setCountry(e.target.value.toUpperCase())}
              />
            </label>
            <label>
              Communication language
              <select
                className="select select-bordered w-full"
                value={locale}
                onChange={(e) => setLocale(e.target.value)}
              >
                {['en-US', 'pt-PT', 'es-ES', 'fr-FR', 'de-DE'].map((l) => (
                  <option key={l}>{l}</option>
                ))}
              </select>
            </label>
            <label>
              Name
              <input
                className="input input-bordered w-full"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <label>
              Contact / invitation email
              <input
                type="email"
                className="input input-bordered w-full"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            {!id && (
              <>
                <label>
                  Code
                  <input
                    className="input input-bordered w-full"
                    required
                    pattern="[A-Z0-9][A-Z0-9_-]{4,31}"
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                  />
                </label>
                <label>
                  Commission (%)
                  <input
                    className="input input-bordered w-full"
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    required
                    value={rate}
                    onChange={(e) => setRate(e.target.value)}
                  />
                </label>
              </>
            )}
            <button className="btn btn-primary" disabled={busy}>
              Save
            </button>
          </div>
        </form>
      )}
      {id && owner && (
        <>
          {ownerSummary && (
            <section className="card bg-base-100">
              <div className="card-body">
                <h2 className="card-title">Referral funnel</h2>
                <div className="flex flex-wrap gap-6">
                  <p>Visits: {String((ownerSummary.visits as Item)?.visits || 0)}</p>
                  <p>Unique visitors: {String((ownerSummary.visits as Item)?.visitors || 0)}</p>
                  {(ownerSummary.funnel as Item[]).map((event) => (
                    <p key={String(event.event_type)}>
                      {String(event.event_type).replace(/_/g, ' ')}: {String(event.count)}
                    </p>
                  ))}
                </div>
              </div>
            </section>
          )}
          <div className="card bg-base-100">
            <div className="card-body">
              <h2 className="card-title">Referral link</h2>
              <p className="font-mono">https://mythoria.pt/r/{code}</p>
              <p>Status: {String((owner.owner as Item).status)}</p>
              {can('manage') && (
                <>
                  <label>
                    Reason
                    <textarea
                      className="textarea textarea-bordered w-full"
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                    />
                  </label>
                  <div className="flex gap-3">
                    {['active', 'suspended', 'closed'].map((status) => (
                      <button
                        key={status}
                        className="btn"
                        disabled={busy || reason.length < 3}
                        onClick={() =>
                          void execute(() => api(`owners/${id}/status`, { status, reason }))
                        }
                      >
                        {status}
                      </button>
                    ))}
                  </div>
                  <label>
                    Future commission (%)
                    <input
                      className="input input-bordered"
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={rate}
                      onChange={(e) => setRate(e.target.value)}
                    />
                  </label>
                  <label>
                    Effective from
                    <input
                      className="input input-bordered"
                      type="datetime-local"
                      value={effective}
                      onChange={(e) => setEffective(e.target.value)}
                    />
                  </label>
                  <button
                    className="btn"
                    disabled={busy || !effective || reason.length < 3}
                    onClick={() =>
                      void execute(() =>
                        api(`owners/${id}/terms`, {
                          commissionRateBps: Math.round(Number(rate) * 100),
                          effectiveFrom: new Date(effective).toISOString(),
                          reason,
                        }),
                      )
                    }
                  >
                    Schedule rate
                  </button>
                  <label>
                    Referral code
                    <input
                      className="input input-bordered"
                      value={code}
                      onChange={(e) => setCode(e.target.value.toUpperCase())}
                    />
                  </label>
                  <div className="flex gap-3">
                    <button
                      className="btn"
                      disabled={busy}
                      onClick={() => void execute(() => api(`owners/${id}`, { code }, 'PATCH'))}
                    >
                      Rename unused code
                    </button>
                    <button
                      className="btn"
                      disabled={busy}
                      onClick={() =>
                        void execute(() =>
                          api(
                            `owners/${id}`,
                            { codeActive: !(owner.code as Item).active },
                            'PATCH',
                          ),
                        )
                      }
                    >
                      Toggle code
                    </button>
                  </div>
                  <label>
                    Member email
                    <input
                      type="email"
                      className="input input-bordered"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </label>
                  <button
                    className="btn"
                    disabled={busy || !email}
                    onClick={() =>
                      void execute(() =>
                        api(`owners/${id}/members`, {
                          email,
                          role: memberRole,
                          requestId: crypto.randomUUID(),
                        }),
                      )
                    }
                  >
                    Invite / resend
                  </button>
                  <label>
                    Member role
                    <select
                      className="select select-bordered"
                      value={memberRole}
                      onChange={(e) => setMemberRole(e.target.value)}
                    >
                      <option value="owner">Owner</option>
                      <option value="viewer">Viewer</option>
                    </select>
                  </label>
                </>
              )}
            </div>
          </div>
          <h2 className="text-xl font-semibold">Members</h2>
          {(owner.members as Item[]).map((member) => (
            <div key={String(member.membershipId)} className="flex gap-4 items-center">
              <span>
                {String(member.emailNormalized)} · {String(member.status)}
              </span>
              {can('manage') && (
                <button
                  className="btn btn-sm"
                  onClick={() =>
                    void execute(() =>
                      api(`owners/${id}/suspendMember`, { membershipId: member.membershipId }),
                    )
                  }
                >
                  Suspend
                </button>
              )}
            </div>
          ))}
          <Link className="link" href={`/referrals/commissions?ownerId=${id}`}>
            View commissions
          </Link>
        </>
      )}
      {['owners', 'overview'].includes(view) && (
        <div className="overflow-x-auto">
          <table className="table bg-base-100">
            <caption className="text-left text-sm pb-2">
              All-time totals. Revenue is gross revenue from live referral purchases.
            </caption>
            <thead>
              <tr>
                <th>Name</th>
                <th>Code</th>
                <th>Status</th>
                <th className="text-right">Visits</th>
                <th className="text-right">Registrations</th>
                <th className="text-right">Revenue</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const row = item.owner as Item;
                return (
                  <tr key={String(row.referralOwnerId)}>
                    <td>
                      <Link className="link" href={`/referrals/owners/${row.referralOwnerId}`}>
                        {String(row.displayName)}
                      </Link>
                    </td>
                    <td>{String((item.code as Item).code)}</td>
                    <td>{String(row.status)}</td>
                    <td className="text-right tabular-nums">
                      {item.visits == null ? '—' : Number(item.visits).toLocaleString('en-GB')}
                    </td>
                    <td className="text-right tabular-nums">
                      {item.registrations == null
                        ? '—'
                        : Number(item.registrations).toLocaleString('en-GB')}
                    </td>
                    <td className="text-right tabular-nums">
                      {item.revenueCents == null ? '—' : money(item.revenueCents)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {view === 'commissions' && (
        <>
          <div className="flex flex-wrap gap-3">
            <label>
              Owner ID
              <input
                className="input input-bordered"
                value={ownerFilter}
                onChange={(e) => {
                  setOwnerFilter(e.target.value);
                  setPage(1);
                }}
              />
            </label>
            <label>
              Status
              <select
                className="select select-bordered"
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">All</option>
                {['blocked', 'pending', 'approved', 'payable', 'paid', 'cancelled', 'reversed'].map(
                  (s) => (
                    <option key={s}>{s}</option>
                  ),
                )}
              </select>
            </label>
            <button className="btn" disabled={page === 1} onClick={() => setPage(page - 1)}>
              Previous
            </button>
            <button className="btn" disabled={items.length < 25} onClick={() => setPage(page + 1)}>
              Next
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="table bg-base-100">
              <thead>
                <tr>
                  <th>Select</th>
                  <th>Date</th>
                  <th>Customer</th>
                  <th>Mode</th>
                  <th>Paid</th>
                  <th>Commission</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={String(item.id)}>
                    <td>
                      <input
                        type="radio"
                        name="commission"
                        aria-label={`Select commission ${item.id}`}
                        checked={selected === item.id}
                        onChange={() => setSelected(String(item.id))}
                      />
                    </td>
                    <td>{date(item.created_at)}</td>
                    <td>{String(item.customer_reference).slice(0, 8)}</td>
                    <td>{String(item.mode)}</td>
                    <td>{money(item.gross_amount_cents)}</td>
                    <td>{money(item.net_commission_cents)}</td>
                    <td>{String(item.status)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {can('review') && (
            <div className="card bg-base-100">
              <div className="card-body">
                <label>
                  Reason
                  <textarea
                    className="textarea textarea-bordered w-full"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  />
                </label>
                <div className="flex gap-3">
                  {['hold', 'release', 'cancel'].map((action) => (
                    <button
                      className="btn"
                      key={action}
                      disabled={busy || !selected || reason.length < 3}
                      onClick={() =>
                        void execute(() =>
                          api(`commissions/${selected}/review`, { action, reason }),
                        )
                      }
                    >
                      {action}
                    </button>
                  ))}
                </div>
                <label>
                  Adjustment (EUR, signed)
                  <input
                    type="number"
                    step="0.01"
                    className="input input-bordered"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                </label>
                <button
                  className="btn"
                  disabled={busy || !selected || !Number(amount) || reason.length < 3}
                  onClick={() =>
                    void execute(() =>
                      api(`commissions/${selected}/adjust`, {
                        amountCents: Math.round(Number(amount) * 100),
                        reason,
                        requestId: crypto.randomUUID(),
                      }),
                    )
                  }
                >
                  Record adjustment
                </button>
              </div>
            </div>
          )}
        </>
      )}
      {view === 'settlements' && (
        <>
          <div className="flex flex-wrap gap-3">
            <label>
              Owner ID
              <input
                className="input input-bordered"
                value={ownerFilter}
                onChange={(e) => {
                  setOwnerFilter(e.target.value);
                  setPage(1);
                }}
              />
            </label>
            <button className="btn" disabled={page === 1} onClick={() => setPage(page - 1)}>
              Previous
            </button>
            <button className="btn" disabled={items.length < 25} onClick={() => setPage(page + 1)}>
              Next
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="table bg-base-100">
              <thead>
                <tr>
                  <th>Select</th>
                  <th>Owner</th>
                  <th>Period end</th>
                  <th>Amount</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={String(item.id)}>
                    <td>
                      <input
                        type="radio"
                        name="settlement"
                        aria-label={`Select settlement ${item.id}`}
                        onChange={() => {
                          setSelected(String(item.id));
                          setAmount(String(Number(item.netPaymentCents) / 100));
                        }}
                      />
                    </td>
                    <td>{String(item.referralOwnerId)}</td>
                    <td>{date(item.periodEnd)}</td>
                    <td>{money(item.netPaymentCents)}</td>
                    <td>{String(item.status)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {can('settle') && (
            <>
              <div className="card bg-base-100">
                <div className="card-body">
                  <h2 className="card-title">Prepare settlement</h2>
                  <label>
                    Owner ID
                    <input
                      className="input input-bordered"
                      value={reference}
                      onChange={(e) => setReference(e.target.value)}
                    />
                  </label>
                  <label>
                    Period start
                    <input
                      className="input input-bordered"
                      type="datetime-local"
                      value={periodStart}
                      onChange={(e) => setPeriodStart(e.target.value)}
                    />
                  </label>
                  <label>
                    Period end
                    <input
                      className="input input-bordered"
                      type="datetime-local"
                      value={periodEnd}
                      onChange={(e) => setPeriodEnd(e.target.value)}
                    />
                  </label>
                  <button
                    className="btn"
                    disabled={busy || !periodEnd || !reference}
                    onClick={() =>
                      void execute(async () =>
                        setPreview(
                          await api('settlements/preview', {
                            ownerId: reference,
                            periodEnd: new Date(periodEnd).toISOString(),
                          }),
                        ),
                      )
                    }
                  >
                    Preview
                  </button>
                  {preview && (
                    <p>
                      Eligible: {String(preview.eligible)} · Net: {money(preview.netPaymentCents)}
                    </p>
                  )}
                  <button
                    className="btn btn-primary"
                    disabled={busy || !preview?.eligible || !periodStart}
                    onClick={() =>
                      void execute(() =>
                        api('settlements', {
                          ownerId: reference,
                          periodStart: new Date(periodStart).toISOString(),
                          periodEnd: new Date(periodEnd).toISOString(),
                        }),
                      )
                    }
                  >
                    Create settlement
                  </button>
                </div>
              </div>
              <div className="card bg-base-100">
                <div className="card-body">
                  <h2 className="card-title">Record external bank payment</h2>
                  <label>
                    Amount paid (EUR)
                    <input
                      className="input input-bordered"
                      type="number"
                      step="0.01"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                    />
                  </label>
                  <label>
                    Payment reference
                    <input
                      className="input input-bordered"
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                    />
                  </label>
                  <label>
                    Payment date
                    <input
                      className="input input-bordered"
                      type="datetime-local"
                      value={paidAt}
                      onChange={(e) => setPaidAt(e.target.value)}
                    />
                  </label>
                  <button
                    className="btn btn-primary"
                    disabled={busy || !selected || !code || !paidAt}
                    onClick={() =>
                      void execute(() =>
                        api(`settlements/${selected}/paid`, {
                          amountCents: Math.round(Number(amount) * 100),
                          externalPaymentReference: code,
                          paidAt: new Date(paidAt).toISOString(),
                        }),
                      )
                    }
                  >
                    Mark paid
                  </button>
                </div>
              </div>
            </>
          )}
        </>
      )}
      {view === 'reconciliation' && (
        <div className="space-y-4">
          {items.map((item) => (
            <details className="card bg-base-100 p-4" key={String(item.reconciliationId)}>
              <summary>
                {date(item.createdAt)} · {item.clean ? 'Clean' : 'Needs review'}
              </summary>
              <dl className="grid grid-cols-2 gap-2 mt-4">
                {Object.entries(item.report as Item).map(([key, value]) => (
                  <div key={key}>
                    <dt>{key.replace(/_/g, ' ')}</dt>
                    <dd className="font-semibold">{String(value)}</dd>
                  </div>
                ))}
              </dl>
            </details>
          ))}
        </div>
      )}
    </div>
  );
}
