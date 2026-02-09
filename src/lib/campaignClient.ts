import type {
  CreateCampaignInput,
  UpdateCampaignInput,
  CampaignAssetInput,
  SampleSendInput,
  AudienceEstimateInput,
} from '@/lib/schemas/campaigns';
import type {
  MarketingCampaign,
  MarketingCampaignAsset,
  MarketingCampaignBatch,
  CampaignStatus,
} from '@/db/schema/campaigns';

// -----------------------------------------------------------------------------
// Response types
// -----------------------------------------------------------------------------
export interface CampaignListResponse {
  campaigns: MarketingCampaign[];
  total: number;
  page: number;
  limit: number;
}

export interface CampaignDetailResponse extends MarketingCampaign {
  assets: MarketingCampaignAsset[];
  progress: CampaignProgress;
  batchHistory: {
    batches: MarketingCampaignBatch[];
    total: number;
    page: number;
    limit: number;
  };
}

export interface CampaignProgress {
  sent: number;
  failed: number;
  skipped: number;
  queued: number;
  total: number;
}

export interface AudienceCount {
  users: number;
  leads: number;
  total: number;
}

// -----------------------------------------------------------------------------
// API client
// -----------------------------------------------------------------------------
const BASE_URL = '/api/email-campaigns';

async function request<T>(url: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
    },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || `Request failed with status ${response.status}`);
  }

  return data as T;
}

export const campaignClient = {
  // ---------------------------------------------------------------------------
  // Campaign CRUD
  // ---------------------------------------------------------------------------
  async list(page = 1, limit = 20, status?: CampaignStatus): Promise<CampaignListResponse> {
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (status) params.set('status', status);
    return request<CampaignListResponse>(`${BASE_URL}?${params}`);
  },

  async get(id: string): Promise<CampaignDetailResponse> {
    return request<CampaignDetailResponse>(`${BASE_URL}/${id}`);
  },

  async create(data: CreateCampaignInput): Promise<MarketingCampaign> {
    return request<MarketingCampaign>(BASE_URL, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async update(
    id: string,
    data: UpdateCampaignInput & { assets?: CampaignAssetInput[] },
  ): Promise<CampaignDetailResponse> {
    return request<CampaignDetailResponse>(`${BASE_URL}/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  async delete(id: string): Promise<{ success: boolean }> {
    return request<{ success: boolean }>(`${BASE_URL}/${id}`, {
      method: 'DELETE',
    });
  },

  async duplicate(id: string): Promise<MarketingCampaign> {
    return request<MarketingCampaign>(`${BASE_URL}/${id}/duplicate`, {
      method: 'POST',
    });
  },

  // ---------------------------------------------------------------------------
  // State transitions
  // ---------------------------------------------------------------------------
  async activate(id: string): Promise<MarketingCampaign> {
    return request<MarketingCampaign>(`${BASE_URL}/${id}/activate`, {
      method: 'POST',
    });
  },

  async pause(id: string): Promise<MarketingCampaign> {
    return request<MarketingCampaign>(`${BASE_URL}/${id}/pause`, {
      method: 'POST',
    });
  },

  async cancel(id: string): Promise<MarketingCampaign> {
    return request<MarketingCampaign>(`${BASE_URL}/${id}/cancel`, {
      method: 'POST',
    });
  },

  // ---------------------------------------------------------------------------
  // Sending
  // ---------------------------------------------------------------------------
  async sendBatch(id: string): Promise<unknown> {
    return request<unknown>(`${BASE_URL}/${id}/send-batch`, {
      method: 'POST',
    });
  },

  async sendSample(id: string, data: SampleSendInput): Promise<unknown> {
    return request<unknown>(`${BASE_URL}/${id}/send-sample`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // ---------------------------------------------------------------------------
  // Analytics
  // ---------------------------------------------------------------------------
  async getAudienceCount(id: string, overrides?: AudienceEstimateInput): Promise<AudienceCount> {
    if (overrides) {
      return request<AudienceCount>(`${BASE_URL}/${id}/audience-count`, {
        method: 'POST',
        body: JSON.stringify(overrides),
      });
    }
    return request<AudienceCount>(`${BASE_URL}/${id}/audience-count`);
  },

  async getProgress(id: string): Promise<CampaignProgress> {
    return request<CampaignProgress>(`${BASE_URL}/${id}/progress`);
  },

  // ---------------------------------------------------------------------------
  // Global mail marketing config (proxy to notification engine)
  // ---------------------------------------------------------------------------
  async getGlobalConfig(): Promise<unknown> {
    return request<unknown>('/api/mail-marketing/config');
  },

  async updateGlobalConfig(data: Record<string, unknown>): Promise<unknown> {
    return request<unknown>('/api/mail-marketing/config', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  // ---------------------------------------------------------------------------
  // AI email asset generation
  // ---------------------------------------------------------------------------
  async generateAssets(
    id: string,
    data: {
      sourceLocale: string;
      subject: string;
      bodyDescription: string;
      templateName: string;
      targetLocales?: string[];
    },
  ): Promise<{ success: boolean; jobId: string; estimatedDuration: number }> {
    return request<{ success: boolean; jobId: string; estimatedDuration: number }>(
      `${BASE_URL}/${id}/generate-assets`,
      {
        method: 'POST',
        body: JSON.stringify(data),
      },
    );
  },

  async getGenerateAssetsJobStatus(
    id: string,
    jobId: string,
  ): Promise<{
    success: boolean;
    job: {
      id: string;
      type: string;
      status: string;
      progress: number;
      elapsedTime: number;
      remainingTime: number;
      estimatedDuration: number;
      result?: {
        assets: Record<string, { subject: string; htmlBody: string; textBody: string }>;
      };
      error?: string;
    };
  }> {
    return request(`${BASE_URL}/${id}/generate-assets?jobId=${encodeURIComponent(jobId)}`);
  },
};
