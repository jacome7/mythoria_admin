import type { CreateStudyInput } from '@/lib/surveys/study-schemas';
import {
  normalizeStudyList,
  type SurveyAudiencePreview,
  type SurveyAudienceSnapshotResult,
  type SurveyStudy,
  type SurveyStudyDetail,
  type SurveyVersionSummary,
} from '@/lib/surveys/study-types';

/** Browser client for /api/admin/surveys/studies/**. */
const BASE = '/api/admin/surveys/studies';

/** Error thrown by the browser client; keeps the HTTP status and the WebApp error code. */
export class SurveyClientError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
  ) {
    super(message);
    this.name = 'SurveyClientError';
  }
}

export const REWARD_POLICY_REQUIRED_HINT = 'Set a redemption deadline before activating';

/** Turns an error response into a user-facing message (409 reward_policy_required gets a hint). */
export function describeSurveyError(status: number, code: string | undefined, message?: string) {
  if (status === 409 && code === 'reward_policy_required') {
    return `${REWARD_POLICY_REQUIRED_HINT}${message ? ` (${message})` : ''}.`;
  }
  return message || `Request failed with status ${status}`;
}

async function request<T>(url: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers ?? {}) },
  });
  const payload = (await response.json().catch(() => ({}))) as {
    data?: T;
    error?: string;
    code?: string;
  };
  if (!response.ok) {
    throw new SurveyClientError(
      describeSurveyError(response.status, payload.code, payload.error),
      response.status,
      payload.code,
    );
  }
  return payload.data as T;
}

function post<T>(url: string, body: unknown = {}): Promise<T> {
  return request<T>(url, { method: 'POST', body: JSON.stringify(body) });
}

export interface StudyCampaignRow {
  id: string;
  title: string;
  status: string;
  cohortKey: string | null;
  mode: 'invite' | 'reminder' | null;
  startAt: string | null;
  endAt: string | null;
}

export type StudyDetailWithCampaigns = SurveyStudyDetail & { campaigns: StudyCampaignRow[] };

export interface CreateCampaignsResult {
  cohorts: Array<{
    cohortKey: string;
    invite: { campaignId: string; created: boolean; linked: boolean };
    reminder: { campaignId: string; created: boolean; linked: boolean };
  }>;
}

export const surveyStudyClient = {
  /** Lists studies, mapping the WebApp `{ study, cohorts }` items into flat UI studies. */
  list: async (): Promise<SurveyStudy[]> => normalizeStudyList(await request<unknown>(BASE)),
  catalog: () =>
    request<SurveyVersionSummary[] | { surveys: SurveyVersionSummary[] }>(`${BASE}/catalog`),
  get: (studyId: string) => request<StudyDetailWithCampaigns>(`${BASE}/${studyId}`),
  create: (input: CreateStudyInput) => post<SurveyStudyDetail>(BASE, input),
  setStatus: (studyId: string, status: 'active' | 'closed' | 'archived') =>
    post<SurveyStudyDetail>(`${BASE}/${studyId}/status`, { status }),
  preview: (studyId: string, notificationPreferences?: string[]) =>
    post<SurveyAudiencePreview>(`${BASE}/${studyId}/preview`, { notificationPreferences }),
  snapshot: (
    studyId: string,
    input: { cohortKeys: string[]; notificationPreferences?: string[]; dryRun?: boolean },
  ) => post<SurveyAudienceSnapshotResult>(`${BASE}/${studyId}/snapshot`, input),
  createCampaigns: (studyId: string, cohortKeys?: string[]) =>
    post<CreateCampaignsResult>(`${BASE}/${studyId}/create-campaigns`, { cohortKeys }),
};

/** Accepts both `[...]` and `{ key: [...] }` list payloads from the WebApp. */
export function unwrapList<T>(value: T[] | Record<string, unknown> | undefined, key: string): T[] {
  if (Array.isArray(value)) return value;
  const inner = value?.[key];
  return Array.isArray(inner) ? (inner as T[]) : [];
}
