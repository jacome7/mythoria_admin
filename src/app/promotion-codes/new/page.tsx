'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAdminAuth } from '@/lib/hooks/useAdminAuth';

interface FormState {
  code: string;
  type: 'partner' | 'referral' | 'book_qr';
  creditAmount: number;
  maxGlobalRedemptions: string; // keep as string for easy input control
  maxRedemptionsPerUser: number;
  validFrom: string;
  validUntil: string;
  active: boolean;
}

export default function NewPromotionCodePage() {
  const { session, loading } = useAdminAuth();
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>({
    code: '',
    type: 'partner',
    creditAmount: 10,
    maxGlobalRedemptions: '',
    maxRedemptionsPerUser: 1,
    validFrom: '',
    validUntil: '',
    active: true,
  });

  const update = <K extends keyof FormState>(key: K, value: FormState[K]): void => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const validate = (): string | null => {
    if (!/^[A-Z0-9-]{3,64}$/.test(form.code.trim().toUpperCase())) return 'Code must be 3-64 chars (A-Z, 0-9, dash)';
    if (form.creditAmount <= 0) return 'Credit amount must be > 0';
    if (form.maxRedemptionsPerUser <= 0) return 'Per-user limit must be > 0';
    if (form.validFrom && form.validUntil) {
      if (new Date(form.validFrom) >= new Date(form.validUntil)) return 'Validity: start must be before end';
    }
    if (form.maxGlobalRedemptions) {
      const n = parseInt(form.maxGlobalRedemptions, 10);
      if (isNaN(n) || n <= 0) return 'Global limit must be positive';
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const v = validate();
    if (v) { setError(v); return; }
    setError(null);
    setSubmitting(true);
    try {
      const payload = {
        code: form.code.trim().toUpperCase(),
        type: form.type,
        creditAmount: form.creditAmount,
        maxGlobalRedemptions: form.maxGlobalRedemptions ? parseInt(form.maxGlobalRedemptions, 10) : null,
        maxRedemptionsPerUser: form.maxRedemptionsPerUser,
        validFrom: form.validFrom || null,
        validUntil: form.validUntil || null,
        active: form.active,
      };
      const res = await fetch('/api/admin/promotion-codes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.status === 409) { setError('A promotion code with that code already exists.'); return; }
      if (!res.ok) { setError('Failed to create code.'); return; }
  const json: { promotionCodeId?: string } = await res.json();
      if (json.promotionCodeId) {
        router.push(`/promotion-codes/${json.promotionCodeId}`);
      } else {
        // Fallback: reload list
        router.push('/promotion-codes');
      }
    } catch (err) {
  console.error('Create promotion code error', err);
      setError('Unexpected error.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><span className="loading loading-spinner loading-lg" /></div>;
  if (!session?.user) return null;

  return (
    <div className="min-h-screen">
      <main className="container mx-auto px-4 py-8 max-w-3xl">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-3xl font-bold">Create Promotion Code</h1>
          <Link href="/promotion-codes" className="btn btn-outline">Back</Link>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6 bg-base-100 p-6 rounded-lg shadow-sm">
          {error && <div className="alert alert-error text-sm">{error}</div>}
          <div className="grid md:grid-cols-2 gap-6">
            <div className="form-control">
              <label className="label"><span className="label-text">Code *</span></label>
              <input
                className="input input-bordered"
                value={form.code}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => update('code', e.target.value.toUpperCase())}
                placeholder="PARTNER10"
                required
              />
              <span className="text-xs mt-1 opacity-70">Uppercase A-Z, numbers, dash.</span>
            </div>
            <div className="form-control">
              <label className="label"><span className="label-text">Type</span></label>
              <select className="select select-bordered" value={form.type} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => update('type', e.target.value as FormState['type'])}>
                <option value="partner">Partner</option>
                <option value="referral">Referral</option>
                <option value="book_qr">Book QR</option>
              </select>
            </div>
            <div className="form-control">
              <label className="label"><span className="label-text">Credit Amount *</span></label>
              <input type="number" min={1} className="input input-bordered" value={form.creditAmount} onChange={(e: React.ChangeEvent<HTMLInputElement>) => update('creditAmount', parseInt(e.target.value) || 0)} required />
            </div>
            <div className="form-control">
              <label className="label"><span className="label-text">Per-User Limit *</span></label>
              <input type="number" min={1} className="input input-bordered" value={form.maxRedemptionsPerUser} onChange={(e: React.ChangeEvent<HTMLInputElement>) => update('maxRedemptionsPerUser', parseInt(e.target.value) || 1)} required />
            </div>
            <div className="form-control">
              <label className="label"><span className="label-text">Global Limit</span></label>
              <input
                type="number" min={1}
                className="input input-bordered"
                value={form.maxGlobalRedemptions}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => update('maxGlobalRedemptions', e.target.value)}
                placeholder="(blank = unlimited)"
              />
            </div>
            <div className="form-control">
              <label className="label"><span className="label-text">Active</span></label>
              <input type="checkbox" className="toggle" checked={form.active} onChange={(e: React.ChangeEvent<HTMLInputElement>) => update('active', e.target.checked)} />
            </div>
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="form-control">
              <label className="label"><span className="label-text">Valid From</span></label>
              <input type="datetime-local" className="input input-bordered" value={form.validFrom} onChange={(e: React.ChangeEvent<HTMLInputElement>) => update('validFrom', e.target.value)} />
            </div>
            <div className="form-control">
              <label className="label"><span className="label-text">Valid Until</span></label>
              <input type="datetime-local" className="input input-bordered" value={form.validUntil} onChange={(e: React.ChangeEvent<HTMLInputElement>) => update('validUntil', e.target.value)} />
            </div>
          </div>
          <div className="pt-4 flex justify-end gap-3">
            <Link href="/promotion-codes" className="btn btn-ghost" aria-label="Cancel creating promotion code">Cancel</Link>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? <span className="loading loading-spinner loading-sm" /> : 'Create Code'}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
