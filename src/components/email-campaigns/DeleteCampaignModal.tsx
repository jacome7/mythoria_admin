'use client';

import { useState } from 'react';
import type { MarketingCampaign } from '@/db/schema/campaigns';
import { FiAlertTriangle } from 'react-icons/fi';

interface DeleteCampaignModalProps {
  campaign: MarketingCampaign | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (id: string) => Promise<void>;
}

export default function DeleteCampaignModal({
  campaign,
  isOpen,
  onClose,
  onConfirm,
}: DeleteCampaignModalProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    if (!campaign) return;
    setIsDeleting(true);
    setError(null);

    try {
      await onConfirm(campaign.id);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete campaign');
    } finally {
      setIsDeleting(false);
    }
  }

  if (!isOpen || !campaign) return null;

  return (
    <dialog className="modal modal-open">
      <div className="modal-box max-w-md">
        <div className="flex items-center gap-3 mb-4">
          <FiAlertTriangle className="text-error text-2xl shrink-0" />
          <h3 className="font-bold text-lg">Delete Campaign</h3>
        </div>

        <p className="text-base-content/80 mb-2">
          Are you sure you want to delete <strong>{campaign.title}</strong>?
        </p>
        <p className="text-sm text-base-content/60 mb-4">
          This action is irreversible. All associated assets, batch records, and recipient data will
          be permanently removed.
        </p>

        {error && (
          <div className="alert alert-error mb-4">
            <span>{error}</span>
          </div>
        )}

        <div className="modal-action">
          <button className="btn btn-ghost" onClick={onClose} disabled={isDeleting}>
            Cancel
          </button>
          <button className="btn btn-error" onClick={handleDelete} disabled={isDeleting}>
            {isDeleting ? <span className="loading loading-spinner loading-sm" /> : 'Delete'}
          </button>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop" onClick={onClose}>
        <button>close</button>
      </form>
    </dialog>
  );
}
