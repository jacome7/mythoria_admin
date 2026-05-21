'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAdminAuth } from '@/lib/hooks/useAdminAuth';

interface PromotionCodeDetail {
  promotionCodeId: string;
  code: string;
  type: string;
  creditAmount: number;
  maxGlobalRedemptions: number | null;
  maxRedemptionsPerUser: number;
  validFrom: string | null;
  validUntil: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  totalRedemptions: number;
  uniqueUsers: number;
  remainingGlobal: number | null;
}

interface RedemptionRow {
  promotionCodeRedemptionId: string;
  authorId: string;
  authorDisplayName: string;
  authorEmail: string;
  creditsGranted: number;
  redeemedAt: string;
}

interface RedemptionResponse {
  data: RedemptionRow[];
  pagination: {
    page: number;
    limit: number;
    totalCount: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

interface FormState {
  code: string;
  type: 'partner' | 'referral' | 'book_qr';
  creditAmount: number;
  maxGlobalRedemptions: string;
  maxRedemptionsPerUser: number;
  validFrom: string;
  validUntil: string;
  active: boolean;
}

function badgeForStatus(code: PromotionCodeDetail) {
  const now = Date.now();
  if (!code.active) return <span className="badge badge-outline">Inactive</span>;
  if (code.validFrom && new Date(code.validFrom).getTime() > now)
    return <span className="badge badge-info">Scheduled</span>;
  if (code.validUntil && new Date(code.validUntil).getTime() < now)
    return <span className="badge badge-error">Expired</span>;
  return <span className="badge badge-success">Active</span>;
}

function formatDate(value: string | null) {
  if (!value) return '-';
  return new Date(value).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function toDateTimeLocal(value: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 16);
}

function toFormState(code: PromotionCodeDetail): FormState {
  return {
    code: code.code,
    type: code.type as FormState['type'],
    creditAmount: code.creditAmount,
    maxGlobalRedemptions:
      code.maxGlobalRedemptions == null ? '' : code.maxGlobalRedemptions.toString(),
    maxRedemptionsPerUser: code.maxRedemptionsPerUser,
    validFrom: toDateTimeLocal(code.validFrom),
    validUntil: toDateTimeLocal(code.validUntil),
    active: code.active,
  };
}

export default function PromotionCodeDetailPage() {
  const { session, loading } = useAdminAuth();
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;
  const [code, setCode] = useState<PromotionCodeDetail | null>(null);
  const [redemptions, setRedemptions] = useState<RedemptionRow[]>([]);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isRedLoading, setIsRedLoading] = useState(true);
  const [pagination, setPagination] = useState<RedemptionResponse['pagination'] | null>(null);
  const [toggling, setToggling] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState<FormState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const fetchCode = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await fetch(`/api/admin/promotion-codes/${id}`);
      if (res.status === 404) {
        router.push('/promotion-codes');
        return;
      }
      if (!res.ok) {
        setError('Failed to load promotion code');
        return;
      }
      const json = await res.json();
      setCode(json.promotionCode);
      setForm(toFormState(json.promotionCode));
    } catch (e) {
      console.error(e);
      setError('Error loading promotion code');
    } finally {
      setIsLoading(false);
    }
  }, [id, router]);

  const fetchRedemptions = useCallback(async () => {
    try {
      setIsRedLoading(true);
      const res = await fetch(`/api/admin/promotion-codes/${id}/redemptions?page=${page}&limit=50`);
      if (res.ok) {
        const json: RedemptionResponse = await res.json();
        setRedemptions(json.data);
        setPagination(json.pagination);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsRedLoading(false);
    }
  }, [id, page]);

  useEffect(() => {
    if (!loading && session?.user) fetchCode();
  }, [loading, session, fetchCode]);
  useEffect(() => {
    if (!loading && session?.user) fetchRedemptions();
  }, [loading, session, fetchRedemptions]);

  const update = <K extends keyof FormState>(key: K, value: FormState[K]): void => {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  const validate = (): string | null => {
    if (!form) return 'Missing promotion code form data';
    if (!/^[A-Z0-9-]{3,64}$/.test(form.code.trim().toUpperCase()))
      return 'Code must be 3-64 chars (A-Z, 0-9, dash)';
    if (form.creditAmount <= 0) return 'Credit amount must be greater than 0';
    if (form.maxRedemptionsPerUser <= 0) return 'Per-user limit must be greater than 0';
    if (form.maxGlobalRedemptions) {
      const n = parseInt(form.maxGlobalRedemptions, 10);
      if (Number.isNaN(n) || n <= 0) return 'Global limit must be positive';
    }
    if (form.validFrom && form.validUntil) {
      if (new Date(form.validFrom) >= new Date(form.validUntil))
        return 'Validity start must be before end';
    }
    return null;
  };

  const canEdit = (code?.totalRedemptions ?? 0) === 0;
  const canDelete = !!code && !code.active && code.totalRedemptions === 0;

  const toggleActive = async () => {
    if (!code) return;
    setActionError(null);
    setToggling(true);
    try {
      const res = await fetch(`/api/admin/promotion-codes/${code.promotionCodeId}/toggle`, {
        method: 'POST',
      });
      if (res.ok) {
        const json = await res.json();
        setCode((prev) =>
          prev
            ? {
                ...prev,
                active: json.promotionCode.active,
                updatedAt: json.promotionCode.updatedAt,
              }
            : prev,
        );
        setForm((prev) => (prev ? { ...prev, active: json.promotionCode.active } : prev));
      } else {
        setActionError('Failed to update promotion code status.');
      }
    } finally {
      setToggling(false);
    }
  };

  const startEditing = () => {
    if (!code || !canEdit) return;
    setActionError(null);
    setForm(toFormState(code));
    setIsEditing(true);
  };

  const cancelEditing = () => {
    if (code) setForm(toFormState(code));
    setActionError(null);
    setIsEditing(false);
  };

  const saveChanges = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form || !code) return;
    const validationError = validate();
    if (validationError) {
      setActionError(validationError);
      return;
    }

    setSaving(true);
    setActionError(null);
    try {
      const payload = {
        code: form.code.trim().toUpperCase(),
        type: form.type,
        creditAmount: form.creditAmount,
        maxGlobalRedemptions: form.maxGlobalRedemptions
          ? parseInt(form.maxGlobalRedemptions, 10)
          : null,
        maxRedemptionsPerUser: form.maxRedemptionsPerUser,
        validFrom: form.validFrom || null,
        validUntil: form.validUntil || null,
        active: form.active,
      };
      const res = await fetch(`/api/admin/promotion-codes/${code.promotionCodeId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.status === 409) {
        const json = await res.json();
        setActionError(
          json.error === 'code_exists'
            ? 'A promotion code with that code already exists.'
            : 'This promotion code can no longer be edited because it has been used.',
        );
        return;
      }
      if (!res.ok) {
        setActionError('Failed to save promotion code.');
        return;
      }

      const json = await res.json();
      setCode(json.promotionCode);
      setForm(toFormState(json.promotionCode));
      setIsEditing(false);
    } catch (err) {
      console.error('Update promotion code error', err);
      setActionError('Unexpected error while saving promotion code.');
    } finally {
      setSaving(false);
    }
  };

  const deleteCode = async () => {
    if (!code || !canDelete) return;
    if (!confirm(`Delete promotion code "${code.code}"? This action cannot be undone.`)) return;

    setDeleting(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/admin/promotion-codes/${code.promotionCodeId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        router.push('/promotion-codes');
        return;
      }
      if (res.status === 409) {
        setActionError('Only inactive promotion codes with no redemptions can be deleted.');
        return;
      }
      setActionError('Failed to delete promotion code.');
    } catch (err) {
      console.error('Delete promotion code error', err);
      setActionError('Unexpected error while deleting promotion code.');
    } finally {
      setDeleting(false);
    }
  };

  if (loading)
    return (
      <div className="min-h-screen flex items-center justify-center">
        <span className="loading loading-spinner loading-lg" />
      </div>
    );
  if (!session?.user) return null;
  if (isLoading)
    return (
      <div className="min-h-screen flex items-center justify-center">
        <span className="loading loading-spinner loading-lg" />
      </div>
    );
  if (error)
    return (
      <div className="min-h-screen p-8">
        <p className="text-error">{error}</p>
      </div>
    );
  if (!code || !form) return null;

  return (
    <div className="min-h-screen">
      <main className="container mx-auto px-4 py-8">
        <div className="flex flex-col gap-4 mb-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="breadcrumbs text-sm mb-1">
              <ul>
                <li>
                  <Link href="/promotion-codes">Promotion Codes</Link>
                </li>
                <li>{code.code}</li>
              </ul>
            </div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              {code.code} {badgeForStatus(code)}
            </h1>
            <p className="text-sm text-gray-500 mt-1 font-mono">ID: {code.promotionCodeId}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button className="btn" onClick={toggleActive} disabled={toggling || isEditing}>
              {toggling ? (
                <span className="loading loading-spinner loading-sm" />
              ) : code.active ? (
                'Deactivate'
              ) : (
                'Activate'
              )}
            </button>
            <button className="btn btn-outline" onClick={startEditing} disabled={!canEdit}>
              Edit
            </button>
            <button
              className="btn btn-error"
              onClick={deleteCode}
              disabled={!canDelete || deleting}
            >
              {deleting ? <span className="loading loading-spinner loading-sm" /> : 'Delete'}
            </button>
            <Link href="/promotion-codes" className="btn btn-outline">
              Back
            </Link>
          </div>
        </div>

        {actionError && <div className="alert alert-error text-sm mb-6">{actionError}</div>}
        {!canEdit && (
          <div className="alert alert-info text-sm mb-6">
            This promotion code has redemptions, so its configuration is locked.
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="stat bg-base-100 rounded-lg shadow-sm">
            <div className="stat-title">Credit / Redemption</div>
            <div className="stat-value text-lg">{code.creditAmount}</div>
          </div>
          <div className="stat bg-base-100 rounded-lg shadow-sm">
            <div className="stat-title">Total Redemptions</div>
            <div className="stat-value text-lg">{code.totalRedemptions}</div>
          </div>
          <div className="stat bg-base-100 rounded-lg shadow-sm">
            <div className="stat-title">Unique Users</div>
            <div className="stat-value text-lg">{code.uniqueUsers}</div>
          </div>
          <div className="stat bg-base-100 rounded-lg shadow-sm">
            <div className="stat-title">Remaining Global</div>
            <div className="stat-value text-lg">
              {code.maxGlobalRedemptions == null ? 'Unlimited' : (code.remainingGlobal ?? 0)}
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-8 mb-12">
          <div className="lg:col-span-1 space-y-6">
            <div className="card bg-base-200 shadow-sm">
              <div className="card-body">
                <h2 className="card-title">Configuration</h2>
                {isEditing ? (
                  <form onSubmit={saveChanges} className="mt-4 space-y-4">
                    <div className="form-control">
                      <label className="label">
                        <span className="label-text">Code *</span>
                      </label>
                      <input
                        className="input input-bordered"
                        value={form.code}
                        onChange={(e) => update('code', e.target.value.toUpperCase())}
                        required
                      />
                    </div>
                    <div className="form-control">
                      <label className="label">
                        <span className="label-text">Type</span>
                      </label>
                      <select
                        className="select select-bordered"
                        value={form.type}
                        onChange={(e) => update('type', e.target.value as FormState['type'])}
                      >
                        <option value="partner">Partner</option>
                        <option value="referral">Referral</option>
                        <option value="book_qr">Book QR</option>
                      </select>
                    </div>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div className="form-control">
                        <label className="label">
                          <span className="label-text">Credits *</span>
                        </label>
                        <input
                          type="number"
                          min={1}
                          className="input input-bordered"
                          value={form.creditAmount}
                          onChange={(e) => update('creditAmount', parseInt(e.target.value) || 0)}
                          required
                        />
                      </div>
                      <div className="form-control">
                        <label className="label">
                          <span className="label-text">Per User *</span>
                        </label>
                        <input
                          type="number"
                          min={1}
                          className="input input-bordered"
                          value={form.maxRedemptionsPerUser}
                          onChange={(e) =>
                            update('maxRedemptionsPerUser', parseInt(e.target.value) || 1)
                          }
                          required
                        />
                      </div>
                    </div>
                    <div className="form-control">
                      <label className="label">
                        <span className="label-text">Global Limit</span>
                      </label>
                      <input
                        type="number"
                        min={1}
                        className="input input-bordered"
                        value={form.maxGlobalRedemptions}
                        onChange={(e) => update('maxGlobalRedemptions', e.target.value)}
                        placeholder="Blank = unlimited"
                      />
                    </div>
                    <div className="form-control">
                      <label className="label">
                        <span className="label-text">Valid From</span>
                      </label>
                      <input
                        type="datetime-local"
                        className="input input-bordered"
                        value={form.validFrom}
                        onChange={(e) => update('validFrom', e.target.value)}
                      />
                    </div>
                    <div className="form-control">
                      <label className="label">
                        <span className="label-text">Valid Until</span>
                      </label>
                      <input
                        type="datetime-local"
                        className="input input-bordered"
                        value={form.validUntil}
                        onChange={(e) => update('validUntil', e.target.value)}
                      />
                    </div>
                    <div className="form-control">
                      <label className="label cursor-pointer justify-between gap-4">
                        <span className="label-text">Active</span>
                        <input
                          type="checkbox"
                          className="toggle"
                          checked={form.active}
                          onChange={(e) => update('active', e.target.checked)}
                        />
                      </label>
                    </div>
                    <div className="flex justify-end gap-3 pt-2">
                      <button type="button" className="btn btn-ghost" onClick={cancelEditing}>
                        Cancel
                      </button>
                      <button type="submit" className="btn btn-primary" disabled={saving}>
                        {saving ? (
                          <span className="loading loading-spinner loading-sm" />
                        ) : (
                          'Save Changes'
                        )}
                      </button>
                    </div>
                  </form>
                ) : (
                  <dl className="mt-4 space-y-2 text-sm">
                    <div className="flex justify-between">
                      <dt className="opacity-70">Type</dt>
                      <dd className="capitalize">{code.type.replace('_', ' ')}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="opacity-70">Per User Limit</dt>
                      <dd>{code.maxRedemptionsPerUser}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="opacity-70">Global Limit</dt>
                      <dd>
                        {code.maxGlobalRedemptions == null
                          ? 'Unlimited'
                          : code.maxGlobalRedemptions}
                      </dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="opacity-70">Valid From</dt>
                      <dd>{formatDate(code.validFrom)}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="opacity-70">Valid Until</dt>
                      <dd>{formatDate(code.validUntil)}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="opacity-70">Created</dt>
                      <dd>{formatDate(code.createdAt)}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="opacity-70">Updated</dt>
                      <dd>{formatDate(code.updatedAt)}</dd>
                    </div>
                  </dl>
                )}
              </div>
            </div>
          </div>
          <div className="lg:col-span-2">
            <div className="card bg-base-200 shadow-sm">
              <div className="card-body">
                <h2 className="card-title mb-4">Redemptions</h2>
                {isRedLoading ? (
                  <div className="flex justify-center items-center py-16">
                    <span className="loading loading-spinner loading-lg" />
                  </div>
                ) : redemptions.length === 0 ? (
                  <div className="p-6 text-center text-gray-500">No redemptions yet</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="table table-zebra w-full">
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>User</th>
                          <th>Email</th>
                          <th className="text-right">Credits</th>
                        </tr>
                      </thead>
                      <tbody>
                        {redemptions.map((r) => (
                          <tr key={r.promotionCodeRedemptionId}>
                            <td className="text-xs">{new Date(r.redeemedAt).toLocaleString()}</td>
                            <td>
                              <Link href={`/users/${r.authorId}`} className="link link-primary">
                                {r.authorDisplayName || 'User'}
                              </Link>
                            </td>
                            <td className="text-xs">{r.authorEmail}</td>
                            <td className="text-right font-mono">{r.creditsGranted}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {pagination && pagination.totalPages > 1 && (
                  <div className="flex justify-center mt-6">
                    <div className="btn-group">
                      <button
                        className={`btn ${!pagination.hasPrev ? 'btn-disabled' : ''}`}
                        disabled={!pagination.hasPrev}
                        onClick={() => setPage((p) => p - 1)}
                      >
                        Prev
                      </button>
                      <button className="btn btn-active">Page {pagination.page}</button>
                      <button
                        className={`btn ${!pagination.hasNext ? 'btn-disabled' : ''}`}
                        disabled={!pagination.hasNext}
                        onClick={() => setPage((p) => p + 1)}
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
