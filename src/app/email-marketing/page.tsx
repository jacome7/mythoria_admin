'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAdminAuth } from '@/lib/hooks/useAdminAuth';
import {
  getMailMarketingConfig,
  updateMailMarketingConfig,
  triggerBatchSend,
  type MailMarketingConfig,
} from '@/lib/notificationEngineClient';
import EmailDeliverabilityHealth from '@/components/email-marketing/EmailDeliverabilityHealth';

interface LeadStats {
  totalLeads: number;
  readyCount: number;
  sentCount: number;
  openCount: number;
  clickCount: number;
  softBounceCount: number;
  hardBounceCount: number;
  unsubCount: number;
}

export default function EmailMarketingPage() {
  const { session, loading: authLoading } = useAdminAuth();
  const [config, setConfig] = useState<MailMarketingConfig | null>(null);
  const [stats, setStats] = useState<LeadStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isSendingBatch, setIsSendingBatch] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Batch size state
  const [batchSize, setBatchSize] = useState(100);

  // Fetch configuration
  const fetchConfig = useCallback(async () => {
    try {
      setError(null);
      const data = await getMailMarketingConfig();
      setConfig(data);
      setBatchSize(data.batchSize);
    } catch (err) {
      console.error('Error fetching config:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch configuration');
    }
  }, []);

  // Fetch statistics
  const fetchStats = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/leads/stats');
      if (response.ok) {
        const data = (await response.json()) as LeadStats;
        setStats(data);
      }
    } catch (err) {
      console.error('Error fetching stats:', err);
    }
  }, []);

  // Initial load
  useEffect(() => {
    if (!authLoading && session) {
      Promise.all([fetchConfig(), fetchStats()]).finally(() => setIsLoading(false));
    }
  }, [authLoading, session, fetchConfig, fetchStats]);

  // Poll stats every 10 seconds
  useEffect(() => {
    if (!authLoading && session) {
      const interval = setInterval(fetchStats, 10000);
      return () => clearInterval(interval);
    }
  }, [authLoading, session, fetchStats]);

  // Handle start/stop campaign
  const handleToggleCampaign = async () => {
    if (!config || !session?.user?.email) return;

    try {
      setIsUpdating(true);
      setError(null);
      setSuccessMessage(null);

      const newPausedState = !config.paused;
      const updated = await updateMailMarketingConfig({
        paused: newPausedState,
        updatedBy: session.user.email,
      });

      setConfig(updated);
      setSuccessMessage(newPausedState ? 'Campaign paused' : 'Campaign started');

      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      console.error('Error toggling campaign:', err);
      setError(err instanceof Error ? err.message : 'Failed to toggle campaign');
    } finally {
      setIsUpdating(false);
    }
  };

  // Handle batch size change
  const handleBatchSizeChange = async (newSize: number) => {
    if (!session?.user?.email) return;

    try {
      setIsUpdating(true);
      setError(null);
      setSuccessMessage(null);

      const updated = await updateMailMarketingConfig({
        batchSize: newSize,
        updatedBy: session.user.email,
      });

      setConfig(updated);
      setSuccessMessage('Batch size updated');

      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      console.error('Error updating batch size:', err);
      setError(err instanceof Error ? err.message : 'Failed to update batch size');
    } finally {
      setIsUpdating(false);
    }
  };

  // Handle batch size slider change (with debounce)
  useEffect(() => {
    if (!config || batchSize === config.batchSize) return;

    const timeoutId = setTimeout(() => {
      handleBatchSizeChange(batchSize);
    }, 1000); // 1 second debounce

    return () => clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batchSize]);

  // Handle force batch send
  const handleForceBatchSend = async () => {
    if (!session?.user?.email) return;

    try {
      setIsSendingBatch(true);
      setError(null);
      setSuccessMessage(null);

      const result = await triggerBatchSend();

      // Refresh stats after batch send
      await fetchStats();

      setSuccessMessage(
        `Batch sent successfully! ${result.emailsDispatched} emails dispatched to ${result.leadsSent} leads.`,
      );

      // Clear success message after 5 seconds
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err) {
      console.error('Error sending batch:', err);
      setError(err instanceof Error ? err.message : 'Failed to send batch');
    } finally {
      setIsSendingBatch(false);
    }
  };

  if (authLoading || isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="alert alert-error">
          <span>You must be logged in to access this page</span>
        </div>
      </div>
    );
  }

  // Calculate percentages
  const sentPercentage =
    stats?.sentCount && stats?.totalLeads
      ? ((stats.sentCount / stats.totalLeads) * 100).toFixed(1)
      : '0.0';
  const openPercentage =
    stats?.openCount && stats?.sentCount
      ? ((stats.openCount / stats.sentCount) * 100).toFixed(1)
      : '0.0';
  const clickPercentage =
    stats?.clickCount && stats?.sentCount
      ? ((stats.clickCount / stats.sentCount) * 100).toFixed(1)
      : '0.0';

  return (
    <div className="container mx-auto p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Email Marketing Campaign</h1>
        <p className="text-base-content/70">
          Manage your email marketing campaign settings and monitor performance
        </p>
      </div>

      {/* Alert Messages */}
      {error && (
        <div className="alert alert-error mb-4">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="stroke-current shrink-0 h-6 w-6"
            fill="none"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span>{error}</span>
        </div>
      )}

      {successMessage && (
        <div className="alert alert-success mb-4">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="stroke-current shrink-0 h-6 w-6"
            fill="none"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span>{successMessage}</span>
        </div>
      )}

      {/* Campaign Status Card */}
      <div className="card bg-base-100 shadow-xl mb-6">
        <div className="card-body">
          <h2 className="card-title mb-4">Campaign Control</h2>

          <div className="flex flex-col gap-6">
            {/* Status Badge */}
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium">Status:</span>
              {config?.paused ? (
                <div className="badge badge-warning gap-2">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    className="inline-block w-4 h-4 stroke-current"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M6 18L18 6M6 6l12 12"
                    ></path>
                  </svg>
                  Paused
                </div>
              ) : (
                <div className="badge badge-success gap-2">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    className="inline-block w-4 h-4 stroke-current"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M5 13l4 4L19 7"
                    ></path>
                  </svg>
                  Running
                </div>
              )}
            </div>

            {/* Start/Stop Button */}
            <div>
              <button
                className={`btn ${config?.paused ? 'btn-success' : 'btn-warning'} btn-lg`}
                onClick={handleToggleCampaign}
                disabled={isUpdating}
              >
                {isUpdating ? (
                  <>
                    <span className="loading loading-spinner loading-sm"></span>
                    Updating...
                  </>
                ) : config?.paused ? (
                  <>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      className="inline-block w-5 h-5 stroke-current"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                      ></path>
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      ></path>
                    </svg>
                    Start Campaign
                  </>
                ) : (
                  <>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      className="inline-block w-5 h-5 stroke-current"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z"
                      ></path>
                    </svg>
                    Stop Campaign
                  </>
                )}
              </button>
            </div>

            {/* Force Batch Send Button */}
            <div className="divider">Manual Override</div>
            <div>
              <button
                className="btn btn-primary btn-lg"
                onClick={handleForceBatchSend}
                disabled={isSendingBatch || isUpdating || config?.paused}
                title={config?.paused ? 'Campaign must be running to send batch' : 'Send batch now'}
              >
                {isSendingBatch ? (
                  <>
                    <span className="loading loading-spinner loading-sm"></span>
                    Sending Batch...
                  </>
                ) : (
                  <>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      className="inline-block w-5 h-5 stroke-current"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M13 10V3L4 14h7v7l9-11h-7z"
                      ></path>
                    </svg>
                    Force Batch Send Now
                  </>
                )}
              </button>
              <p className="text-sm text-base-content/60 mt-2">
                Manually trigger a batch send immediately, bypassing the scheduler. This will send
                emails to the next {batchSize} ready leads.
              </p>
            </div>

            {/* Batch Size Slider */}
            <div>
              <label className="label">
                <span className="label-text font-medium">
                  Batch Size: {batchSize} emails per batch
                </span>
              </label>
              <input
                type="range"
                min="10"
                max="500"
                step="10"
                value={batchSize}
                onChange={(e) => setBatchSize(Number(e.target.value))}
                className="range range-primary"
                disabled={isUpdating}
              />
              <div className="w-full flex justify-between text-xs px-2 mt-1">
                <span>10</span>
                <span>100</span>
                <span>250</span>
                <span>500</span>
              </div>
            </div>

            {/* Last Updated Info */}
            {config && (
              <div className="text-sm text-base-content/60">
                <p>Last updated: {new Date(config.updatedAt).toLocaleString()}</p>
                {config.updatedBy && <p>By: {config.updatedBy}</p>}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {/* To Send */}
        <div className="stat bg-base-100 shadow-xl rounded-lg">
          <div className="stat-figure text-primary">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              className="inline-block w-8 h-8 stroke-current"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
              ></path>
            </svg>
          </div>
          <div className="stat-title">To Send</div>
          <div className="stat-value text-primary">{(stats?.readyCount ?? 0).toLocaleString()}</div>
          <div className="stat-desc">Leads ready for sending</div>
        </div>

        {/* Sent */}
        <div className="stat bg-base-100 shadow-xl rounded-lg">
          <div className="stat-figure text-secondary">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              className="inline-block w-8 h-8 stroke-current"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
              ></path>
            </svg>
          </div>
          <div className="stat-title">Sent</div>
          <div className="stat-value text-secondary">{(stats?.sentCount ?? 0).toLocaleString()}</div>
          <div className="stat-desc">{sentPercentage}% of total leads</div>
        </div>

        {/* Opens */}
        <div className="stat bg-base-100 shadow-xl rounded-lg">
          <div className="stat-figure text-success">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              className="inline-block w-8 h-8 stroke-current"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              ></path>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
              ></path>
            </svg>
          </div>
          <div className="stat-title">Opens</div>
          <div className="stat-value text-success">{(stats?.openCount ?? 0).toLocaleString()}</div>
          <div className="stat-desc">{openPercentage}% open rate</div>
        </div>

        {/* Clicks */}
        <div className="stat bg-base-100 shadow-xl rounded-lg">
          <div className="stat-figure text-accent">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              className="inline-block w-8 h-8 stroke-current"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122"
              ></path>
            </svg>
          </div>
          <div className="stat-title">Clicks</div>
          <div className="stat-value text-accent">{(stats?.clickCount ?? 0).toLocaleString()}</div>
          <div className="stat-desc">{clickPercentage}% click rate</div>
        </div>
      </div>

      {/* Additional Stats */}
      <div className="card bg-base-100 shadow-xl">
        <div className="card-body">
          <h2 className="card-title mb-4">Campaign Metrics</h2>

          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Metric</th>
                  <th>Count</th>
                  <th>Percentage</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Total Leads</td>
                  <td>{(stats?.totalLeads ?? 0).toLocaleString()}</td>
                  <td>100%</td>
                </tr>
                <tr>
                  <td>Ready to Send</td>
                  <td>{(stats?.readyCount ?? 0).toLocaleString()}</td>
                  <td>
                    {stats?.totalLeads
                      ? ((stats.readyCount / stats.totalLeads) * 100).toFixed(1)
                      : '0.0'}
                    %
                  </td>
                </tr>
                <tr>
                  <td>Sent</td>
                  <td>{(stats?.sentCount ?? 0).toLocaleString()}</td>
                  <td>{sentPercentage}%</td>
                </tr>
                <tr>
                  <td>Opened</td>
                  <td>{(stats?.openCount ?? 0).toLocaleString()}</td>
                  <td>{openPercentage}%</td>
                </tr>
                <tr>
                  <td>Clicked</td>
                  <td>{(stats?.clickCount ?? 0).toLocaleString()}</td>
                  <td>{clickPercentage}%</td>
                </tr>
                <tr>
                  <td>Soft Bounces</td>
                  <td>{(stats?.softBounceCount ?? 0).toLocaleString()}</td>
                  <td>
                    {stats?.sentCount
                      ? ((stats.softBounceCount / stats.sentCount) * 100).toFixed(1)
                      : '0.0'}
                    %
                  </td>
                </tr>
                <tr>
                  <td>Hard Bounces</td>
                  <td>{(stats?.hardBounceCount ?? 0).toLocaleString()}</td>
                  <td>
                    {stats?.sentCount
                      ? ((stats.hardBounceCount / stats.sentCount) * 100).toFixed(1)
                      : '0.0'}
                    %
                  </td>
                </tr>
                <tr>
                  <td>Unsubscribed</td>
                  <td>{(stats?.unsubCount ?? 0).toLocaleString()}</td>
                  <td>
                    {stats?.sentCount
                      ? ((stats.unsubCount / stats.sentCount) * 100).toFixed(1)
                      : '0.0'}
                    %
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Email Deliverability Health (Google Postmaster) */}
      <EmailDeliverabilityHealth className="mt-6" />
    </div>
  );
}
