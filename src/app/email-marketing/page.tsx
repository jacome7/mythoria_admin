'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAdminAuth } from '@/lib/hooks/useAdminAuth';
import { campaignClient } from '@/lib/campaignClient';
import CampaignListTable from '@/components/email-campaigns/CampaignListTable';
import CampaignStatusBadge from '@/components/email-campaigns/CampaignStatusBadge';
import CreateCampaignModal from '@/components/email-campaigns/CreateCampaignModal';
import DeleteCampaignModal from '@/components/email-campaigns/DeleteCampaignModal';
import GlobalSettingsPanel from '@/components/email-campaigns/GlobalSettingsPanel';
import type { MarketingCampaign, CampaignStatus } from '@/db/schema/campaigns';
import type { CreateCampaignInput } from '@/lib/schemas/campaigns';
import { FiPlus, FiRefreshCw, FiFilter } from 'react-icons/fi';

const STATUS_FILTERS: (CampaignStatus | 'all')[] = [
  'all',
  'draft',
  'active',
  'paused',
  'completed',
  'cancelled',
];

export default function EmailMarketingPage() {
  const { session, loading: authLoading } = useAdminAuth();
  const router = useRouter();

  const [campaigns, setCampaigns] = useState<MarketingCampaign[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<CampaignStatus | 'all'>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modals
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<MarketingCampaign | null>(null);

  const limit = 20;

  const fetchCampaigns = useCallback(async () => {
    try {
      setError(null);
      const status = statusFilter === 'all' ? undefined : statusFilter;
      const data = await campaignClient.list(page, limit, status);
      setCampaigns(data.campaigns);
      setTotal(data.total);
    } catch (err) {
      console.error('Error fetching campaigns:', err);
      setError(err instanceof Error ? err.message : 'Failed to load campaigns');
    } finally {
      setIsLoading(false);
    }
  }, [page, statusFilter]);

  useEffect(() => {
    if (!authLoading && session) {
      setIsLoading(true);
      fetchCampaigns();
    }
  }, [authLoading, session, fetchCampaigns]);

  // Handlers
  async function handleCreate(data: CreateCampaignInput) {
    await campaignClient.create(data);
    await fetchCampaigns();
  }

  async function handleActivate(id: string) {
    await campaignClient.activate(id);
    await fetchCampaigns();
  }

  async function handleDuplicate(id: string) {
    const duplicated = await campaignClient.duplicate(id);
    await fetchCampaigns();
    router.push(`/email-campaigns/${duplicated.id}`);
  }

  async function handlePause(id: string) {
    await campaignClient.pause(id);
    await fetchCampaigns();
  }

  async function handleCancel(id: string) {
    await campaignClient.cancel(id);
    await fetchCampaigns();
  }

  async function handleDelete(id: string) {
    await campaignClient.delete(id);
    setDeleteTarget(null);
    await fetchCampaigns();
  }

  function handleEdit(id: string) {
    router.push(/email-campaigns/ + id);
  }

  const totalPages = Math.ceil(total / limit);

  if (authLoading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <span className="loading loading-spinner loading-lg" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold">Email Campaigns</h1>
          <p className="text-base-content/60 text-sm mt-1">Manage multi-campaign email marketing</p>
        </div>
        <div className="flex gap-2">
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => {
              setIsLoading(true);
              fetchCampaigns();
            }}
            disabled={isLoading}
          >
            <FiRefreshCw className={isLoading ? 'animate-spin' : ''} />
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => setIsCreateOpen(true)}>
            <FiPlus /> New Campaign
          </button>
        </div>
      </div>

      {/* Global settings + status filter row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        {/* Status filter */}
        <div className="lg:col-span-2">
          <div className="card bg-base-100 shadow-sm border border-base-200">
            <div className="card-body py-3 px-4">
              <div className="flex items-center gap-2 flex-wrap">
                <FiFilter className="text-base-content/50 shrink-0" />
                {STATUS_FILTERS.map((s) => (
                  <button
                    key={s}
                    className={'btn btn-xs ' + (statusFilter === s ? 'btn-primary' : 'btn-ghost')}
                    onClick={() => {
                      setPage(1);
                      setStatusFilter(s);
                    }}
                  >
                    {s === 'all' ? 'All' : <CampaignStatusBadge status={s} size="xs" />}
                  </button>
                ))}
                <span className="text-xs text-base-content/50 ml-auto">
                  {total} campaign{total !== 1 ? 's' : ''}
                </span>
              </div>
            </div>
          </div>
        </div>

        <GlobalSettingsPanel />
      </div>

      {/* Error */}
      {error && (
        <div className="alert alert-error mb-4">
          <span>{error}</span>
        </div>
      )}

      {/* Campaign table */}
      <div className="card bg-base-100 shadow-sm border border-base-200">
        <div className="card-body p-0">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <span className="loading loading-spinner loading-md" />
            </div>
          ) : (
            <CampaignListTable
              campaigns={campaigns}
              onEdit={handleEdit}
              onDuplicate={handleDuplicate}
              onActivate={handleActivate}
              onPause={handlePause}
              onCancel={handleCancel}
              onDelete={(c) => setDeleteTarget(c)}
            />
          )}
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center mt-4">
          <div className="join">
            <button
              className="join-item btn btn-sm"
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Previous
            </button>
            <button className="join-item btn btn-sm btn-disabled">
              Page {page} of {totalPages}
            </button>
            <button
              className="join-item btn btn-sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Modals */}
      <CreateCampaignModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onCreate={handleCreate}
      />
      <DeleteCampaignModal
        campaign={deleteTarget}
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
}
