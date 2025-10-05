'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAdminAuth } from '@/lib/hooks/useAdminAuth';

interface PromotionCodeRow {
  promotionCodeId: string;
  code: string;
  type: string;
  creditAmount: number;
  maxGlobalRedemptions: number | null;
  maxRedemptionsPerUser: number;
  totalRedemptions: number;
  remainingGlobal: number | null;
  validFrom: string | null;
  validUntil: string | null;
  active: boolean;
  createdAt: string;
}

interface PaginationData {
  page: number;
  limit: number;
  totalCount: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

interface ListResponse {
  data: PromotionCodeRow[];
  pagination: PaginationData;
}

function formatDateRange(from: string | null, until: string | null) {
  if (!from && !until) return '—';
  const fmt = (d: string) =>
    new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  if (from && until) return `${fmt(from)} → ${fmt(until)}`;
  if (from) return `From ${fmt(from)}`;
  if (until) return `Until ${fmt(until)}`;
  return '—';
}

function statusLabel(row: PromotionCodeRow) {
  const now = Date.now();
  if (!row.active) return <span className="badge badge-outline">Inactive</span>;
  if (row.validFrom && new Date(row.validFrom).getTime() > now)
    return <span className="badge badge-info">Scheduled</span>;
  if (row.validUntil && new Date(row.validUntil).getTime() < now)
    return <span className="badge badge-error">Expired</span>;
  return <span className="badge badge-success">Active</span>;
}

export default function PromotionCodesPage() {
  const { session, loading } = useAdminAuth();
  const router = useRouter();
  const [codes, setCodes] = useState<PromotionCodeRow[]>([]);
  const [pagination, setPagination] = useState<PaginationData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'partner' | 'referral' | 'book_qr'>('all');
  const [activeFilter, setActiveFilter] = useState<'all' | 'true' | 'false'>('all');

  const fetchCodes = useCallback(async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams({ page: page.toString(), limit: '50' });
      if (search) params.set('search', search);
      if (typeFilter !== 'all') params.set('type', typeFilter);
      if (activeFilter !== 'all') params.set('active', activeFilter);
      const res = await fetch(`/api/admin/promotion-codes?${params.toString()}`);
      if (res.ok) {
        const json: ListResponse = await res.json();
        setCodes(json.data);
        setPagination(json.pagination);
      }
    } catch (e) {
      console.error('Error fetching promotion codes', e);
    } finally {
      setIsLoading(false);
    }
  }, [page, search, typeFilter, activeFilter]);

  useEffect(() => {
    if (!loading && session?.user) {
      fetchCodes();
    }
  }, [loading, session, fetchCodes]);

  const handleRowClick = (id: string) => {
    router.push(`/promotion-codes/${id}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <span className="loading loading-spinner loading-lg" />
      </div>
    );
  }
  if (!session?.user) return null;

  return (
    <div className="min-h-screen flex flex-col">
      <main className="flex-1 container mx-auto px-4 py-6 md:py-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold">Promotion Codes</h1>
            <p className="text-gray-500 text-sm mt-1">Manage voucher & referral codes</p>
          </div>
          <div>
            <Link href="/promotion-codes/new" className="btn btn-primary">
              Create Code
            </Link>
          </div>
        </div>

        <div className="bg-base-100 p-4 rounded-lg shadow-sm mb-6 flex flex-col md:flex-row gap-4">
          <input
            className="input input-bordered w-full md:max-w-xs"
            placeholder="Search code..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value.toUpperCase());
              setPage(1);
            }}
          />
          <select
            className="select select-bordered"
            value={typeFilter}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
              setTypeFilter(e.target.value as 'all' | 'partner' | 'referral' | 'book_qr');
              setPage(1);
            }}
          >
            <option value="all">All Types</option>
            <option value="partner">Partner</option>
            <option value="referral">Referral</option>
            <option value="book_qr">Book QR</option>
          </select>
          <select
            className="select select-bordered"
            value={activeFilter}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
              setActiveFilter(e.target.value as 'all' | 'true' | 'false');
              setPage(1);
            }}
          >
            <option value="all">Any Status</option>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>
        </div>

        <div className="bg-base-100 rounded-lg shadow-sm">
          {isLoading ? (
            <div className="flex justify-center items-center py-16">
              <span className="loading loading-spinner loading-lg" />
            </div>
          ) : codes.length === 0 ? (
            <div className="p-10 text-center text-gray-500">No promotion codes found</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="table table-zebra w-full">
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Type</th>
                    <th>Credit</th>
                    <th>Usage</th>
                    <th>Validity</th>
                    <th>Status</th>
                    <th>Created</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {codes.map((c) => {
                    const usage =
                      c.maxGlobalRedemptions != null
                        ? `${c.totalRedemptions}/${c.maxGlobalRedemptions}`
                        : c.totalRedemptions;
                    return (
                      <tr
                        key={c.promotionCodeId}
                        className="hover cursor-pointer"
                        onClick={() => handleRowClick(c.promotionCodeId)}
                      >
                        <td className="font-mono text-sm">{c.code}</td>
                        <td className="capitalize">{c.type.replace('_', ' ')}</td>
                        <td>{c.creditAmount}</td>
                        <td>{usage}</td>
                        <td className="text-xs">{formatDateRange(c.validFrom, c.validUntil)}</td>
                        <td>{statusLabel(c)}</td>
                        <td className="text-xs">{new Date(c.createdAt).toLocaleDateString()}</td>
                        <td>
                          <Link
                            href={`/promotion-codes/${c.promotionCodeId}`}
                            className="btn btn-sm btn-outline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            View
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {pagination && pagination.totalPages > 1 && (
          <div className="flex justify-center mt-8">
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
      </main>
    </div>
  );
}
