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
  pagination: { page: number; limit: number; totalCount: number; totalPages: number; hasNext: boolean; hasPrev: boolean; };
}

function badgeForStatus(code: PromotionCodeDetail) {
  const now = Date.now();
  if (!code.active) return <span className="badge badge-outline">Inactive</span>;
  if (code.validFrom && new Date(code.validFrom).getTime() > now) return <span className="badge badge-info">Scheduled</span>;
  if (code.validUntil && new Date(code.validUntil).getTime() < now) return <span className="badge badge-error">Expired</span>;
  return <span className="badge badge-success">Active</span>;
}

function formatDate(value: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
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
  const [error, setError] = useState<string | null>(null);

  const fetchCode = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await fetch(`/api/admin/promotion-codes/${id}`);
      if (res.status === 404) { router.push('/promotion-codes'); return; }
      if (!res.ok) { setError('Failed to load promotion code'); return; }
      const json = await res.json();
      setCode(json.promotionCode);
    } catch (e) {
      console.error(e); setError('Error loading promotion code');
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

  useEffect(() => { if (!loading && session?.user) fetchCode(); }, [loading, session, fetchCode]);
  useEffect(() => { if (!loading && session?.user) fetchRedemptions(); }, [loading, session, fetchRedemptions]);

  const toggleActive = async () => {
    if (!code) return;
    setToggling(true);
    try {
      const res = await fetch(`/api/admin/promotion-codes/${code.promotionCodeId}/toggle`, { method: 'POST' });
      if (res.ok) {
        const json = await res.json();
        setCode(prev => prev ? { ...prev, active: json.promotionCode.active, updatedAt: json.promotionCode.updatedAt } : prev);
      }
    } finally {
      setToggling(false);
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><span className="loading loading-spinner loading-lg" /></div>;
  if (!session?.user) return null;
  if (isLoading) return <div className="min-h-screen flex items-center justify-center"><span className="loading loading-spinner loading-lg" /></div>;
  if (error) return <div className="min-h-screen p-8"><p className="text-error">{error}</p></div>;
  if (!code) return null;

  return (
    <div className="min-h-screen">
      <main className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="breadcrumbs text-sm mb-1">
              <ul>
                <li><Link href="/promotion-codes">Promotion Codes</Link></li>
                <li>{code.code}</li>
              </ul>
            </div>
            <h1 className="text-3xl font-bold flex items-center gap-3">{code.code} {badgeForStatus(code)}</h1>
            <p className="text-sm text-gray-500 mt-1 font-mono">ID: {code.promotionCodeId}</p>
          </div>
          <div className="flex gap-3">
            <button className="btn" onClick={toggleActive} disabled={toggling}>{toggling ? <span className="loading loading-spinner loading-sm" /> : (code.active ? 'Deactivate' : 'Activate')}</button>
            <Link href="/promotion-codes" className="btn btn-outline">Back</Link>
          </div>
        </div>

        {/* Stats Cards */}
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
            <div className="stat-value text-lg">{code.maxGlobalRedemptions == null ? '∞' : (code.remainingGlobal ?? 0)}</div>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-8 mb-12">
          <div className="lg:col-span-1 space-y-6">
            <div className="card bg-base-200 shadow-sm">
              <div className="card-body">
                <h2 className="card-title">Configuration</h2>
                <dl className="mt-4 space-y-2 text-sm">
                  <div className="flex justify-between"><dt className="opacity-70">Type</dt><dd className="capitalize">{code.type.replace('_',' ')}</dd></div>
                  <div className="flex justify-between"><dt className="opacity-70">Per User Limit</dt><dd>{code.maxRedemptionsPerUser}</dd></div>
                  <div className="flex justify-between"><dt className="opacity-70">Global Limit</dt><dd>{code.maxGlobalRedemptions == null ? 'Unlimited' : code.maxGlobalRedemptions}</dd></div>
                  <div className="flex justify-between"><dt className="opacity-70">Valid From</dt><dd>{formatDate(code.validFrom)}</dd></div>
                  <div className="flex justify-between"><dt className="opacity-70">Valid Until</dt><dd>{formatDate(code.validUntil)}</dd></div>
                  <div className="flex justify-between"><dt className="opacity-70">Created</dt><dd>{formatDate(code.createdAt)}</dd></div>
                  <div className="flex justify-between"><dt className="opacity-70">Updated</dt><dd>{formatDate(code.updatedAt)}</dd></div>
                </dl>
              </div>
            </div>
          </div>
          <div className="lg:col-span-2">
            <div className="card bg-base-200 shadow-sm">
              <div className="card-body">
                <h2 className="card-title mb-4">Redemptions</h2>
                {isRedLoading ? (
                  <div className="flex justify-center items-center py-16"><span className="loading loading-spinner loading-lg" /></div>
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
                        {redemptions.map(r => (
                          <tr key={r.promotionCodeRedemptionId}>
                            <td className="text-xs">{new Date(r.redeemedAt).toLocaleString()}</td>
                            <td>
                              <Link href={`/users/${r.authorId}`} className="link link-primary">{r.authorDisplayName || 'User'}</Link>
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
                      <button className={`btn ${!pagination.hasPrev ? 'btn-disabled': ''}`} disabled={!pagination.hasPrev} onClick={() => setPage(p => p - 1)}>Prev</button>
                      <button className="btn btn-active">Page {pagination.page}</button>
                      <button className={`btn ${!pagination.hasNext ? 'btn-disabled': ''}`} disabled={!pagination.hasNext} onClick={() => setPage(p => p + 1)}>Next</button>
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
