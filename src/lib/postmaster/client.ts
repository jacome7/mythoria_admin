/**
 * Google Postmaster Tools API Client
 *
 * This client authenticates using a service account with domain-wide delegation
 * to access Google Postmaster Tools data for monitoring email deliverability.
 *
 * Prerequisites:
 * 1. Service account with domain-wide delegation enabled
 * 2. Postmaster Tools API scope added to workspace admin console:
 *    https://www.googleapis.com/auth/postmaster.readonly
 * 3. Domain verified in Postmaster Tools (https://postmaster.google.com)
 * 4. Impersonation user must have access to the domain in Postmaster Tools
 */

import { google } from 'googleapis';
import { readFileSync } from 'fs';
import { resolve, isAbsolute } from 'path';
import type {
  TrafficStats,
  FormattedTrafficStats,
  ReputationCategory,
  DeliveryError,
} from '@/types/postmaster';

export interface PostmasterConfig {
  domain: string;
  serviceAccountEmail: string;
  serviceAccountKeyPath: string;
  impersonateEmail: string;
}

interface ServiceAccountKey {
  client_email: string;
  private_key: string;
  [key: string]: unknown;
}

export class PostmasterClient {
  private config: PostmasterConfig;
  private auth: InstanceType<typeof google.auth.JWT> | null = null;

  constructor(config?: Partial<PostmasterConfig>) {
    // Load config from environment with optional overrides
    this.config = {
      domain: config?.domain || process.env.POSTMASTER_DOMAIN || 'mythoria.pt',
      serviceAccountEmail:
        config?.serviceAccountEmail || process.env.POSTMASTER_SERVICE_ACCOUNT_EMAIL || '',
      serviceAccountKeyPath:
        config?.serviceAccountKeyPath || process.env.POSTMASTER_SERVICE_ACCOUNT_KEY || '',
      impersonateEmail: config?.impersonateEmail || process.env.POSTMASTER_IMPERSONATE_EMAIL || '',
    };

    this.validateConfig();
  }

  private validateConfig(): void {
    const { domain, serviceAccountEmail, serviceAccountKeyPath, impersonateEmail } = this.config;

    if (!domain) {
      throw new Error('POSTMASTER_DOMAIN is required');
    }
    if (!serviceAccountEmail) {
      throw new Error('POSTMASTER_SERVICE_ACCOUNT_EMAIL is required');
    }
    if (!serviceAccountKeyPath) {
      throw new Error('POSTMASTER_SERVICE_ACCOUNT_KEY is required');
    }
    if (!impersonateEmail) {
      throw new Error('POSTMASTER_IMPERSONATE_EMAIL is required');
    }
  }

  /**
   * Initialize authentication with service account and domain-wide delegation
   */
  private async initializeAuth(): Promise<void> {
    if (this.auth) {
      return; // Already initialized
    }

    try {
      const { serviceAccountKeyPath, impersonateEmail } = this.config;

      // Resolve the key file path
      let keyPath = serviceAccountKeyPath;
      if (!isAbsolute(keyPath)) {
        // Resolve relative to project root
        keyPath = resolve(process.cwd(), keyPath);
      }

      // Read and parse service account key
      const keyFileContent = readFileSync(keyPath, 'utf-8');
      const serviceAccountKey: ServiceAccountKey = JSON.parse(keyFileContent);

      // Create JWT auth client with Postmaster API scope
      this.auth = new google.auth.JWT({
        email: serviceAccountKey.client_email,
        key: serviceAccountKey.private_key,
        scopes: ['https://www.googleapis.com/auth/postmaster.readonly'],
        subject: impersonateEmail, // Domain-wide delegation
      });

      console.log('[PostmasterClient] Initialized with domain:', this.config.domain);
    } catch (error) {
      console.error('[PostmasterClient] Failed to initialize:', error);
      throw new Error(
        `Failed to initialize Postmaster API client: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Get traffic statistics for the latest available date
   */
  async getLatestTrafficStats(): Promise<TrafficStats | null> {
    await this.initializeAuth();

    try {
      const postmaster = google.gmailpostmastertools({
        version: 'v1',
        auth: this.auth!,
      });

      // List traffic stats (sorted by date descending by default)
      const response = await postmaster.domains.trafficStats.list({
        parent: `domains/${this.config.domain}`,
        pageSize: 1, // Only get the latest
      });

      const stats = response.data.trafficStats;

      if (!stats || stats.length === 0) {
        console.warn('[PostmasterClient] No traffic stats available for domain');
        return null;
      }

      return stats[0] as TrafficStats;
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'code' in error) {
        const gaxiosError = error as { code: number; message: string };

        if (gaxiosError.code === 404) {
          console.warn('[PostmasterClient] Domain not found or not verified in Postmaster Tools');
          return null;
        }
        if (gaxiosError.code === 403) {
          console.error(
            '[PostmasterClient] Access denied - check domain-wide delegation and scopes',
          );
          throw new Error('Access denied to Postmaster Tools API. Check domain-wide delegation.');
        }
      }

      console.error('[PostmasterClient] Error fetching traffic stats:', error);
      throw error;
    }
  }

  /**
   * Get traffic statistics for a specific date
   * @param date - Date in YYYYMMDD format (e.g., '20250131')
   */
  async getTrafficStatsForDate(date: string): Promise<TrafficStats | null> {
    await this.initializeAuth();

    try {
      const postmaster = google.gmailpostmastertools({
        version: 'v1',
        auth: this.auth!,
      });

      const name = `domains/${this.config.domain}/trafficStats/${date}`;
      const response = await postmaster.domains.trafficStats.get({ name });

      return response.data as TrafficStats;
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'code' in error) {
        const gaxiosError = error as { code: number };
        if (gaxiosError.code === 404) {
          console.warn(`[PostmasterClient] No data available for date ${date}`);
          return null;
        }
      }

      console.error('[PostmasterClient] Error fetching traffic stats for date:', error);
      throw error;
    }
  }

  /**
   * Format traffic stats for display
   */
  formatTrafficStats(stats: TrafficStats): FormattedTrafficStats {
    // Extract date from resource name (e.g., domains/mythoria.pt/trafficStats/20250131)
    const dateMatch = stats.name.match(/\/trafficStats\/(\d{8})$/);
    const dateStr = dateMatch ? dateMatch[1] : '';
    const date = dateStr
      ? `${dateStr.substring(0, 4)}-${dateStr.substring(4, 6)}-${dateStr.substring(6, 8)}`
      : 'Unknown';

    // Calculate IP reputation distribution
    const ipReputation = {
      high: 0,
      medium: 0,
      low: 0,
      bad: 0,
    };

    if (stats.ipReputations) {
      stats.ipReputations.forEach((ip) => {
        const count = parseInt(ip.ipCount || '0', 10);
        switch (ip.reputation) {
          case 'HIGH':
            ipReputation.high += count;
            break;
          case 'MEDIUM':
            ipReputation.medium += count;
            break;
          case 'LOW':
            ipReputation.low += count;
            break;
          case 'BAD':
            ipReputation.bad += count;
            break;
        }
      });
    }

    // Categorize delivery errors
    const permanentErrors: DeliveryError[] = [];
    const temporaryErrors: DeliveryError[] = [];
    let totalErrorRate = 0;

    if (stats.deliveryErrors) {
      stats.deliveryErrors.forEach((err) => {
        totalErrorRate += err.errorRatio || 0;
        if (err.errorClass === 'PERMANENT_ERROR') {
          permanentErrors.push(err);
        } else if (err.errorClass === 'TEMPORARY_ERROR') {
          temporaryErrors.push(err);
        }
      });
    }

    return {
      date,
      domainReputation: stats.domainReputation || 'REPUTATION_CATEGORY_UNSPECIFIED',
      userSpamRate: stats.userReportedSpamRatio
        ? parseFloat((stats.userReportedSpamRatio * 100).toFixed(2))
        : null,
      userSpamRateRange:
        stats.userReportedSpamRatioLowerBound && stats.userReportedSpamRatioUpperBound
          ? {
              lower: parseFloat((stats.userReportedSpamRatioLowerBound * 100).toFixed(2)),
              upper: parseFloat((stats.userReportedSpamRatioUpperBound * 100).toFixed(2)),
            }
          : null,
      authenticationRates: {
        spf: stats.spfSuccessRatio ? parseFloat((stats.spfSuccessRatio * 100).toFixed(1)) : null,
        dkim: stats.dkimSuccessRatio ? parseFloat((stats.dkimSuccessRatio * 100).toFixed(1)) : null,
        dmarc: stats.dmarcSuccessRatio
          ? parseFloat((stats.dmarcSuccessRatio * 100).toFixed(1))
          : null,
      },
      encryptionRates: {
        inbound: stats.inboundEncryptionRatio
          ? parseFloat((stats.inboundEncryptionRatio * 100).toFixed(1))
          : null,
        outbound: stats.outboundEncryptionRatio
          ? parseFloat((stats.outboundEncryptionRatio * 100).toFixed(1))
          : null,
      },
      deliveryErrors: {
        permanent: permanentErrors,
        temporary: temporaryErrors,
        totalErrorRate: parseFloat((totalErrorRate * 100).toFixed(2)),
      },
      ipReputation,
    };
  }

  /**
   * Get reputation badge color for UI
   */
  getReputationColor(reputation: ReputationCategory): string {
    switch (reputation) {
      case 'HIGH':
        return 'success'; // Green
      case 'MEDIUM':
        return 'warning'; // Yellow
      case 'LOW':
        return 'error'; // Red
      case 'BAD':
        return 'error'; // Red
      default:
        return 'ghost'; // Gray
    }
  }

  /**
   * Get human-readable reputation label
   */
  getReputationLabel(reputation: ReputationCategory): string {
    switch (reputation) {
      case 'HIGH':
        return 'High';
      case 'MEDIUM':
        return 'Medium';
      case 'LOW':
        return 'Low';
      case 'BAD':
        return 'Bad';
      case 'REPUTATION_CATEGORY_UNSPECIFIED':
        return 'Unknown';
      default:
        return 'Unknown';
    }
  }
}

// Singleton instance for reuse
let postmasterClient: PostmasterClient | null = null;

export function getPostmasterClient(config?: Partial<PostmasterConfig>): PostmasterClient {
  if (!postmasterClient) {
    postmasterClient = new PostmasterClient(config);
  }
  return postmasterClient;
}
