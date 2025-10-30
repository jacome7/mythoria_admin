/**
 * Notification Engine Client
 *
 * Client library for interacting with the mail marketing API via admin API routes.
 * These routes act as a proxy to the notification-engine service.
 */

import { z } from 'zod';

// Zod schema for mail marketing configuration
const mailMarketingConfigSchema = z.object({
  id: z.string(),
  paused: z.boolean(),
  batchSize: z.number().int().min(10).max(500),
  sendWindowStart: z.string().nullable(),
  sendWindowEnd: z.string().nullable(),
  timezone: z.string(),
  updatedAt: z.string(),
  updatedBy: z.string().nullable(),
});

// Zod schema for simplified status
const mailMarketingStatusSchema = z.object({
  paused: z.boolean(),
  batchSize: z.number().int(),
  hasSchedule: z.boolean(),
  timezone: z.string(),
  lastUpdated: z.string(),
  updatedBy: z.string().nullable(),
});

// TypeScript types
export type MailMarketingConfig = z.infer<typeof mailMarketingConfigSchema>;
export type MailMarketingStatus = z.infer<typeof mailMarketingStatusSchema>;

export interface MailMarketingConfigUpdate {
  paused?: boolean;
  batchSize?: number;
  sendWindowStart?: string | null;
  sendWindowEnd?: string | null;
  timezone?: string;
  updatedBy?: string;
}

export interface ValidationError {
  field: string;
  message: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  errors?: ValidationError[];
}

/**
 * Make a request to the admin API (which proxies to notification engine)
 */
async function makeRequest<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<ApiResponse<T>> {
  const url = `/api/mail-marketing${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    // Try to parse error response
    try {
      const errorData = (await response.json()) as ApiResponse<T>;
      return errorData;
    } catch {
      // If parsing fails, return generic error
      return {
        success: false,
        message: `HTTP ${response.status}: ${response.statusText}`,
      };
    }
  }

  return response.json();
}

/**
 * Get current mail marketing configuration
 */
export async function getMailMarketingConfig(): Promise<MailMarketingConfig> {
  const response = await makeRequest<MailMarketingConfig>('/config', {
    method: 'GET',
  });

  if (!response.success || !response.data) {
    throw new Error(response.message || 'Failed to get mail marketing config');
  }

  // Validate response data
  return mailMarketingConfigSchema.parse(response.data);
}

/**
 * Update mail marketing configuration
 */
export async function updateMailMarketingConfig(
  updates: MailMarketingConfigUpdate,
): Promise<MailMarketingConfig> {
  const response = await makeRequest<MailMarketingConfig>('/config', {
    method: 'PUT',
    body: JSON.stringify(updates),
  });

  if (!response.success) {
    // If validation errors exist, throw with details
    if (response.errors && response.errors.length > 0) {
      const errorMessages = response.errors.map((e) => `${e.field}: ${e.message}`).join(', ');
      throw new Error(`Validation failed: ${errorMessages}`);
    }
    throw new Error(response.message || 'Failed to update mail marketing config');
  }

  if (!response.data) {
    throw new Error('No data returned from update');
  }

  // Validate response data
  return mailMarketingConfigSchema.parse(response.data);
}

/**
 * Get simplified campaign status
 */
export async function getMailMarketingStatus(): Promise<MailMarketingStatus> {
  const response = await makeRequest<MailMarketingStatus>('/status', {
    method: 'GET',
  });

  if (!response.success || !response.data) {
    throw new Error(response.message || 'Failed to get mail marketing status');
  }

  // Validate response data
  return mailMarketingStatusSchema.parse(response.data);
}

/**
 * Pause the campaign
 */
export async function pauseCampaign(updatedBy: string): Promise<MailMarketingConfig> {
  return updateMailMarketingConfig({ paused: true, updatedBy });
}

/**
 * Resume the campaign
 */
export async function resumeCampaign(updatedBy: string): Promise<MailMarketingConfig> {
  return updateMailMarketingConfig({ paused: false, updatedBy });
}

/**
 * Update batch size
 */
export async function updateBatchSize(
  batchSize: number,
  updatedBy: string,
): Promise<MailMarketingConfig> {
  return updateMailMarketingConfig({ batchSize, updatedBy });
}

/**
 * Update send window
 */
export async function updateSendWindow(
  sendWindowStart: string | null,
  sendWindowEnd: string | null,
  timezone: string,
  updatedBy: string,
): Promise<MailMarketingConfig> {
  return updateMailMarketingConfig({
    sendWindowStart,
    sendWindowEnd,
    timezone,
    updatedBy,
  });
}

/**
 * Remove send window (allow sending anytime)
 */
export async function removeSendWindow(updatedBy: string): Promise<MailMarketingConfig> {
  return updateMailMarketingConfig({
    sendWindowStart: null,
    sendWindowEnd: null,
    updatedBy,
  });
}
