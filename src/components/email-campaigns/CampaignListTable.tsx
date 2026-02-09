'use client';

import { useState } from 'react';
import CampaignStatusBadge from './CampaignStatusBadge';
import type {
  MarketingCampaign,
  CampaignStatus,
  CampaignAudienceSource,
} from '@/db/schema/campaigns';
import { FiEdit2, FiPlay, FiPause, FiXCircle, FiTrash2, FiUsers, FiCopy } from 'react-icons/fi';

const AUDIENCE_LABELS: Record<CampaignAudienceSource, string> = {
  users: 'Users',
  leads: 'Leads',
  both: 'Both',
};

interface CampaignListTableProps {
  campaigns: MarketingCampaign[];
  onEdit: (id: string) => void;
  onDuplicate: (id: string) => Promise<void>;
  onActivate: (id: string) => Promise<void>;
  onPause: (id: string) => Promise<void>;
  onCancel: (id: string) => Promise<void>;
  onDelete: (campaign: MarketingCampaign) => void;
}

export default function CampaignListTable({
  campaigns,
  onEdit,
  onDuplicate,
  onActivate,
  onPause,
  onCancel,
  onDelete,
}: CampaignListTableProps) {
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  async function handleAction(id: string, action: () => Promise<void>) {
    setLoadingAction(id);
    try {
      await action();
    } finally {
      setLoadingAction(null);
    }
  }

  function canActivate(status: CampaignStatus) {
    return status === 'draft' || status === 'paused';
  }

  function canPause(status: CampaignStatus) {
    return status === 'active';
  }

  function canCancel(status: CampaignStatus) {
    return status === 'draft' || status === 'active' || status === 'paused';
  }

  function canDelete(status: CampaignStatus) {
    return status === 'draft' || status === 'cancelled';
  }

  if (campaigns.length === 0) {
    return (
      <div className="text-center py-12 text-base-content/60">
        <FiUsers className="mx-auto text-4xl mb-3 opacity-40" />
        <p className="text-lg font-medium">No campaigns yet</p>
        <p className="text-sm mt-1">Create your first campaign to get started.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="table table-zebra w-full">
        <thead>
          <tr>
            <th>Status</th>
            <th>Title</th>
            <th>Audience</th>
            <th>Created</th>
            <th>Updated</th>
            <th className="text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {campaigns.map((campaign) => (
            <tr
              key={campaign.id}
              className="hover cursor-pointer"
              onClick={() => onEdit(campaign.id)}
            >
              <td>
                <CampaignStatusBadge status={campaign.status} />
              </td>
              <td>
                <div className="font-medium">{campaign.title}</div>
                {campaign.description && (
                  <div className="text-xs text-base-content/60 truncate max-w-xs">
                    {campaign.description}
                  </div>
                )}
              </td>
              <td>
                <span className="badge badge-sm badge-outline">
                  {AUDIENCE_LABELS[campaign.audienceSource]}
                </span>
              </td>
              <td className="text-sm text-base-content/70">
                {new Date(campaign.createdAt).toLocaleDateString()}
              </td>
              <td className="text-sm text-base-content/70">
                {new Date(campaign.updatedAt).toLocaleDateString()}
              </td>
              <td>
                <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                  <button
                    className="btn btn-ghost btn-xs tooltip"
                    data-tip="Edit"
                    onClick={() => onEdit(campaign.id)}
                  >
                    <FiEdit2 />
                  </button>

                  <button
                    className="btn btn-ghost btn-xs tooltip"
                    data-tip="Duplicate"
                    disabled={loadingAction === campaign.id}
                    onClick={() => handleAction(campaign.id, () => onDuplicate(campaign.id))}
                  >
                    <FiCopy />
                  </button>

                  {canActivate(campaign.status) && (
                    <button
                      className="btn btn-ghost btn-xs text-success tooltip"
                      data-tip="Activate"
                      disabled={loadingAction === campaign.id}
                      onClick={() => handleAction(campaign.id, () => onActivate(campaign.id))}
                    >
                      <FiPlay />
                    </button>
                  )}

                  {canPause(campaign.status) && (
                    <button
                      className="btn btn-ghost btn-xs text-warning tooltip"
                      data-tip="Pause"
                      disabled={loadingAction === campaign.id}
                      onClick={() => handleAction(campaign.id, () => onPause(campaign.id))}
                    >
                      <FiPause />
                    </button>
                  )}

                  {canCancel(campaign.status) && (
                    <button
                      className="btn btn-ghost btn-xs text-error tooltip"
                      data-tip="Cancel"
                      disabled={loadingAction === campaign.id}
                      onClick={() => handleAction(campaign.id, () => onCancel(campaign.id))}
                    >
                      <FiXCircle />
                    </button>
                  )}

                  {canDelete(campaign.status) && (
                    <button
                      className="btn btn-ghost btn-xs text-error tooltip"
                      data-tip="Delete"
                      disabled={loadingAction === campaign.id}
                      onClick={() => onDelete(campaign)}
                    >
                      <FiTrash2 />
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
