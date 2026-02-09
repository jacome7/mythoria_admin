'use client';

import type { CampaignStatus } from '@/db/schema/campaigns';

const STATUS_CONFIG: Record<CampaignStatus, { label: string; className: string }> = {
  draft: { label: 'Draft', className: 'badge-ghost' },
  active: { label: 'Active', className: 'badge-success' },
  paused: { label: 'Paused', className: 'badge-warning' },
  completed: { label: 'Completed', className: 'badge-info' },
  cancelled: { label: 'Cancelled', className: 'badge-error' },
};

interface CampaignStatusBadgeProps {
  status: CampaignStatus;
  size?: 'xs' | 'sm' | 'md' | 'lg';
}

export default function CampaignStatusBadge({ status, size = 'sm' }: CampaignStatusBadgeProps) {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.draft;
  return <span className={`badge badge-${size} ${config.className}`}>{config.label}</span>;
}
