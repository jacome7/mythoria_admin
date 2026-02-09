'use client';

import CampaignStatusBadge from './CampaignStatusBadge';
import type { CampaignStatus } from '@/db/schema/campaigns';
import { FiPlay, FiPause, FiXCircle, FiArrowLeft, FiSend, FiCopy } from 'react-icons/fi';
import Link from 'next/link';

interface CampaignDetailHeaderProps {
  title: string;
  status: CampaignStatus;
  isDraft: boolean;
  onActivate: () => Promise<void>;
  onPause: () => Promise<void>;
  onCancel: () => Promise<void>;
  onSendBatch: () => Promise<void>;
  onDuplicate: () => Promise<void>;
  isLoading: boolean;
}

export default function CampaignDetailHeader({
  title,
  status,
  isDraft,
  onActivate,
  onPause,
  onCancel,
  onSendBatch,
  onDuplicate,
  isLoading,
}: CampaignDetailHeaderProps) {
  const canActivate = status === 'draft' || status === 'paused';
  const canPause = status === 'active';
  const canCancel = status === 'draft' || status === 'active' || status === 'paused';
  const canSend = status === 'active';

  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
      <div className="flex items-center gap-3">
        <Link href="/email-marketing" className="btn btn-ghost btn-sm btn-circle">
          <FiArrowLeft />
        </Link>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold">{title}</h1>
            <CampaignStatusBadge status={status} size="md" />
          </div>
          {isDraft && (
            <p className="text-xs text-base-content/50 mt-0.5">
              Edit metadata, filters, and assets before activating.
            </p>
          )}
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        <button className="btn btn-sm btn-ghost" onClick={onDuplicate} disabled={isLoading}>
          <FiCopy /> Duplicate
        </button>

        {canSend && (
          <button
            className="btn btn-sm btn-outline btn-info"
            onClick={onSendBatch}
            disabled={isLoading}
          >
            <FiSend /> Send Batch
          </button>
        )}

        {canActivate && (
          <button className="btn btn-sm btn-success" onClick={onActivate} disabled={isLoading}>
            <FiPlay /> {status === 'paused' ? 'Resume' : 'Activate'}
          </button>
        )}

        {canPause && (
          <button className="btn btn-sm btn-warning" onClick={onPause} disabled={isLoading}>
            <FiPause /> Pause
          </button>
        )}

        {canCancel && (
          <button
            className="btn btn-sm btn-error btn-outline"
            onClick={onCancel}
            disabled={isLoading}
          >
            <FiXCircle /> Cancel
          </button>
        )}
      </div>
    </div>
  );
}
