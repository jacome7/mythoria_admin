/**
 * Email Deliverability Health Component
 *
 * Displays Google Postmaster Tools metrics including:
 * - Domain reputation badge
 * - User-reported spam rate
 * - Authentication success rates (SPF, DKIM, DMARC)
 * - Encryption rates
 * - Delivery errors summary
 * - IP reputation distribution
 */

'use client';

import { useState } from 'react';
import type { FormattedTrafficStats, ReputationCategory } from '@/types/postmaster';

interface EmailDeliverabilityHealthProps {
  className?: string;
}

interface ApiResponse {
  success: boolean;
  data?: FormattedTrafficStats;
  cached?: boolean;
  error?: string;
  message?: string;
}

export default function EmailDeliverabilityHealth({ className }: EmailDeliverabilityHealthProps) {
  const [data, setData] = useState<FormattedTrafficStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCached, setIsCached] = useState(false);

  const fetchData = async (refresh = false) => {
    try {
      setIsLoading(true);
      setError(null);

      const url = refresh
        ? '/api/postmaster/traffic-stats?refresh=true'
        : '/api/postmaster/traffic-stats';

      const response = await fetch(url);
      const result: ApiResponse = await response.json();

      if (!response.ok || !result.success) {
        // Handle specific error cases
        if (response.status === 204) {
          setError(
            'Insufficient data. Email volume may be too low or domain not verified in Postmaster Tools.',
          );
          setData(null);
        } else if (response.status === 503) {
          setError('Postmaster API not configured. Please contact your administrator.');
          setData(null);
        } else {
          setError(result.message || result.error || 'Failed to fetch deliverability data');
          setData(null);
        }
        return;
      }

      setData(result.data || null);
      setIsCached(result.cached || false);
    } catch (err) {
      console.error('Error fetching deliverability data:', err);
      setError('Failed to fetch deliverability data. Please try again.');
      setData(null);
    } finally {
      setIsLoading(false);
    }
  };

  const getReputationBadgeClass = (reputation: ReputationCategory): string => {
    switch (reputation) {
      case 'HIGH':
        return 'badge-success';
      case 'MEDIUM':
        return 'badge-warning';
      case 'LOW':
      case 'BAD':
        return 'badge-error';
      default:
        return 'badge-ghost';
    }
  };

  const getReputationLabel = (reputation: ReputationCategory): string => {
    switch (reputation) {
      case 'HIGH':
        return 'High';
      case 'MEDIUM':
        return 'Medium';
      case 'LOW':
        return 'Low';
      case 'BAD':
        return 'Bad';
      default:
        return 'Unknown';
    }
  };

  const formatPercentage = (value: number | null): string => {
    return value !== null ? `${value}%` : 'N/A';
  };

  return (
    <div className={`card bg-base-100 shadow-xl ${className || ''}`}>
      <div className="card-body">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="card-title">Email Deliverability Health</h2>
            <p className="text-sm text-base-content/70">
              Data from{' '}
              <a
                href="https://postmaster.google.com"
                target="_blank"
                rel="noopener noreferrer"
                className="link link-primary"
              >
                Google Postmaster Tools
              </a>
            </p>
          </div>
          <div className="flex gap-2">
            <button
              className="btn btn-sm btn-primary"
              onClick={() => fetchData(false)}
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <span className="loading loading-spinner loading-xs"></span>
                  Loading...
                </>
              ) : (
                <>
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
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    ></path>
                  </svg>
                  Load Data
                </>
              )}
            </button>
            {data && (
              <button
                className="btn btn-sm btn-ghost"
                onClick={() => fetchData(true)}
                disabled={isLoading}
                title="Refresh data (bypass cache)"
              >
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
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  ></path>
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Error State */}
        {error && (
          <div className="alert alert-warning">
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
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <span>{error}</span>
          </div>
        )}

        {/* Data Display */}
        {data && (
          <>
            {/* Cache indicator */}
            {isCached && (
              <div className="text-xs text-base-content/50 mb-2">
                📦 Cached data (refresh to get latest)
              </div>
            )}

            {/* Date */}
            <div className="text-sm text-base-content/70 mb-4">Data from: {data.date}</div>

            {/* Domain Reputation */}
            <div className="mb-6">
              <div className="flex items-center gap-3 mb-2">
                <span className="font-semibold">Domain Reputation:</span>
                <div className={`badge badge-lg ${getReputationBadgeClass(data.domainReputation)}`}>
                  {getReputationLabel(data.domainReputation)}
                </div>
              </div>
            </div>

            {/* Key Metrics Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
              {/* User Spam Rate */}
              <div className="stat bg-base-200 rounded-lg p-4">
                <div className="stat-title text-xs">User-Reported Spam</div>
                <div className="stat-value text-2xl">{formatPercentage(data.userSpamRate)}</div>
                {data.userSpamRateRange && (
                  <div className="stat-desc text-xs">
                    Range: {data.userSpamRateRange.lower}% - {data.userSpamRateRange.upper}%
                  </div>
                )}
              </div>

              {/* SPF Success */}
              <div className="stat bg-base-200 rounded-lg p-4">
                <div className="stat-title text-xs">SPF Success</div>
                <div className="stat-value text-2xl text-success">
                  {formatPercentage(data.authenticationRates.spf)}
                </div>
                <div className="stat-desc text-xs">Authentication rate</div>
              </div>

              {/* DKIM Success */}
              <div className="stat bg-base-200 rounded-lg p-4">
                <div className="stat-title text-xs">DKIM Success</div>
                <div className="stat-value text-2xl text-success">
                  {formatPercentage(data.authenticationRates.dkim)}
                </div>
                <div className="stat-desc text-xs">Authentication rate</div>
              </div>

              {/* DMARC Success */}
              <div className="stat bg-base-200 rounded-lg p-4">
                <div className="stat-title text-xs">DMARC Success</div>
                <div className="stat-value text-2xl text-success">
                  {formatPercentage(data.authenticationRates.dmarc)}
                </div>
                <div className="stat-desc text-xs">Alignment rate</div>
              </div>

              {/* Inbound Encryption */}
              <div className="stat bg-base-200 rounded-lg p-4">
                <div className="stat-title text-xs">Inbound TLS</div>
                <div className="stat-value text-2xl text-info">
                  {formatPercentage(data.encryptionRates.inbound)}
                </div>
                <div className="stat-desc text-xs">Encrypted incoming</div>
              </div>

              {/* Delivery Errors */}
              <div className="stat bg-base-200 rounded-lg p-4">
                <div className="stat-title text-xs">Delivery Errors</div>
                <div
                  className={`stat-value text-2xl ${
                    data.deliveryErrors.totalErrorRate > 5 ? 'text-error' : 'text-warning'
                  }`}
                >
                  {formatPercentage(data.deliveryErrors.totalErrorRate)}
                </div>
                <div className="stat-desc text-xs">
                  {data.deliveryErrors.permanent.length + data.deliveryErrors.temporary.length}{' '}
                  error types
                </div>
              </div>
            </div>

            {/* IP Reputation Distribution */}
            {(data.ipReputation.high > 0 ||
              data.ipReputation.medium > 0 ||
              data.ipReputation.low > 0 ||
              data.ipReputation.bad > 0) && (
              <div className="mb-4">
                <h3 className="font-semibold mb-2">IP Reputation Distribution</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {data.ipReputation.high > 0 && (
                    <div className="badge badge-success gap-2">High: {data.ipReputation.high}</div>
                  )}
                  {data.ipReputation.medium > 0 && (
                    <div className="badge badge-warning gap-2">
                      Medium: {data.ipReputation.medium}
                    </div>
                  )}
                  {data.ipReputation.low > 0 && (
                    <div className="badge badge-error gap-2">Low: {data.ipReputation.low}</div>
                  )}
                  {data.ipReputation.bad > 0 && (
                    <div className="badge badge-error gap-2">Bad: {data.ipReputation.bad}</div>
                  )}
                </div>
              </div>
            )}

            {/* Delivery Errors Detail */}
            {(data.deliveryErrors.permanent.length > 0 ||
              data.deliveryErrors.temporary.length > 0) && (
              <div className="collapse collapse-arrow bg-base-200">
                <input type="checkbox" />
                <div className="collapse-title font-medium">
                  View Delivery Error Details (
                  {data.deliveryErrors.permanent.length + data.deliveryErrors.temporary.length})
                </div>
                <div className="collapse-content">
                  {data.deliveryErrors.permanent.length > 0 && (
                    <div className="mb-3">
                      <div className="font-semibold text-error mb-1">Permanent Errors:</div>
                      <ul className="list-disc list-inside text-sm">
                        {data.deliveryErrors.permanent.map((err, idx) => (
                          <li key={idx}>
                            {err.errorType}: {(err.errorRatio * 100).toFixed(2)}%
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {data.deliveryErrors.temporary.length > 0 && (
                    <div>
                      <div className="font-semibold text-warning mb-1">Temporary Errors:</div>
                      <ul className="list-disc list-inside text-sm">
                        {data.deliveryErrors.temporary.map((err, idx) => (
                          <li key={idx}>
                            {err.errorType}: {(err.errorRatio * 100).toFixed(2)}%
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}

        {/* Empty State */}
        {!data && !error && !isLoading && (
          <div className="text-center py-8 text-base-content/50">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              className="inline-block w-16 h-16 stroke-current mb-4"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              ></path>
            </svg>
            <p>Click &ldquo;Load Data&rdquo; to view email deliverability metrics</p>
          </div>
        )}
      </div>
    </div>
  );
}
