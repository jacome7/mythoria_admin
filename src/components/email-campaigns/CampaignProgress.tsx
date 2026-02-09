'use client';

import type { CampaignProgress as CampaignProgressType } from '@/lib/campaignClient';
import type { MarketingCampaignBatch } from '@/db/schema/campaigns';
import { FiBarChart2, FiClock, FiCheckCircle, FiXCircle } from 'react-icons/fi';

interface CampaignProgressProps {
  progress: CampaignProgressType;
  batches: MarketingCampaignBatch[];
  totalBatches: number;
}

export default function CampaignProgress({
  progress,
  batches,
  totalBatches,
}: CampaignProgressProps) {
  const sentPercent = progress.total > 0 ? Math.round((progress.sent / progress.total) * 100) : 0;

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="stat bg-base-100 border border-base-200 rounded-lg py-3 px-4">
          <div className="stat-title text-xs">Sent</div>
          <div className="stat-value text-lg text-success">{progress.sent.toLocaleString()}</div>
        </div>
        <div className="stat bg-base-100 border border-base-200 rounded-lg py-3 px-4">
          <div className="stat-title text-xs">Failed</div>
          <div className="stat-value text-lg text-error">{progress.failed.toLocaleString()}</div>
        </div>
        <div className="stat bg-base-100 border border-base-200 rounded-lg py-3 px-4">
          <div className="stat-title text-xs">Skipped</div>
          <div className="stat-value text-lg text-warning">{progress.skipped.toLocaleString()}</div>
        </div>
        <div className="stat bg-base-100 border border-base-200 rounded-lg py-3 px-4">
          <div className="stat-title text-xs">Total Processed</div>
          <div className="stat-value text-lg">{progress.total.toLocaleString()}</div>
        </div>
      </div>

      {/* Progress bar */}
      {progress.total > 0 && (
        <div>
          <div className="flex justify-between text-xs text-base-content/60 mb-1">
            <span>Delivery progress</span>
            <span>{sentPercent}%</span>
          </div>
          <progress className="progress progress-success w-full" value={sentPercent} max="100" />
        </div>
      )}

      {/* Batch history */}
      {batches.length > 0 && (
        <div>
          <h4 className="text-sm font-medium mb-2 flex items-center gap-1.5">
            <FiBarChart2 className="text-base-content/60" />
            Batch History ({totalBatches} total)
          </h4>
          <div className="overflow-x-auto">
            <table className="table table-xs">
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Requested</th>
                  <th>Started</th>
                  <th>Completed</th>
                  <th>Processed</th>
                  <th>Sent</th>
                  <th>Failed</th>
                  <th>Skipped</th>
                </tr>
              </thead>
              <tbody>
                {batches.map((batch) => {
                  const stats = batch.statsJson as {
                    processed: number;
                    sent: number;
                    failed: number;
                    skipped: number;
                  } | null;

                  return (
                    <tr key={batch.id}>
                      <td>
                        <BatchStatusBadge status={batch.status} />
                      </td>
                      <td className="text-xs">
                        {batch.requestedAt ? new Date(batch.requestedAt).toLocaleString() : '-'}
                      </td>
                      <td className="text-xs">
                        {batch.startedAt ? new Date(batch.startedAt).toLocaleString() : '-'}
                      </td>
                      <td className="text-xs">
                        {batch.completedAt ? new Date(batch.completedAt).toLocaleString() : '-'}
                      </td>
                      <td className="text-xs">{stats?.processed ?? '-'}</td>
                      <td className="text-xs text-success">{stats?.sent ?? '-'}</td>
                      <td className="text-xs text-error">{stats?.failed ?? '-'}</td>
                      <td className="text-xs text-warning">{stats?.skipped ?? '-'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {batches.length === 0 && progress.total === 0 && (
        <p className="text-sm text-base-content/50 text-center py-4">
          No batches sent yet. Activate the campaign to start sending.
        </p>
      )}
    </div>
  );
}

function BatchStatusBadge({ status }: { status: string }) {
  const config: Record<string, { icon: React.ReactNode; className: string }> = {
    queued: { icon: <FiClock />, className: 'badge-ghost' },
    running: {
      icon: <span className="loading loading-spinner loading-xs" />,
      className: 'badge-info',
    },
    completed: { icon: <FiCheckCircle />, className: 'badge-success' },
    failed: { icon: <FiXCircle />, className: 'badge-error' },
  };

  const c = config[status] ?? config.queued;
  return (
    <span className={`badge badge-xs gap-1 ${c.className}`}>
      {c.icon} {status}
    </span>
  );
}
