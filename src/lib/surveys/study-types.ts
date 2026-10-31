/**
 * Shapes exchanged with the WebApp survey command API (docs/SURVEYS.md). Kept dependency-free so
 * client components and server code can share them.
 */
export const SURVEY_STUDY_COHORT_KEYS = ['C1', 'C2', 'C3'] as const;
export type SurveyStudyCohortKey = (typeof SURVEY_STUDY_COHORT_KEYS)[number];
/** Reminder campaigns default to starting this many days after the study opens. */
export const SURVEY_REMINDER_DELAY_DAYS = 7;
export type SurveyStudyStatus = 'draft' | 'active' | 'closed' | 'archived';

export interface SurveyRewardPolicy {
  rewardTypes: Array<'pdf' | 'audiobook'>;
  redemptionDeadline?: string | null;
  allowExistingAudiobook?: boolean;
}

export interface SurveyStudyCohort {
  cohortKey: string;
  surveyId?: string;
  version?: number;
  inviteCampaignId?: string | null;
  reminderCampaignId?: string | null;
}

export interface SurveyStudy {
  studyId: string;
  studyKey: string;
  title: string;
  status: SurveyStudyStatus;
  opensAt?: string | null;
  closesAt?: string | null;
  holdoutPercent?: number;
  rewardPolicy?: SurveyRewardPolicy | null;
  snapshotAt?: string | null;
  cohorts?: SurveyStudyCohort[];
}

export interface SurveyStudyDetail {
  study: SurveyStudy;
  cohorts: SurveyStudyCohort[];
  /** cohortKey -> { status -> count } (WebApp `getStudy`). */
  invitationCounts?: Record<string, number | Record<string, number>>;
  /** cohortKey -> number of holdout (never emailed) invitations. */
  holdoutCounts?: Record<string, number>;
}

export interface SurveyVersionSummary {
  surveyId: string;
  title?: string;
  versions: Array<{ version: number; status?: string; title?: string }>;
}

export interface SurveyAudiencePreview {
  totalAuthors: number;
  closedAccounts: number;
  cohorts: Record<
    string,
    { classified: number; emailEligible: number; suppressed: number; alreadyInvited: number }
  >;
  unclassified: Record<string, number>;
  duplicateEmails: number;
  reconciles: boolean;
}

/** `inserted` INCLUDES the holdout rows; emailable = inserted - holdout. */
export interface SurveyAudienceSnapshotResult {
  dryRun?: boolean;
  inserted: Record<string, number>;
  holdout?: Record<string, number>;
  skippedExisting?: number;
}

/** Emailable invitations for a cohort in a snapshot result (inserted minus holdout). */
export function emailableCount(result: SurveyAudienceSnapshotResult, cohortKey: string): number {
  return Math.max(0, (result.inserted[cohortKey] ?? 0) - (result.holdout?.[cohortKey] ?? 0));
}

/** Normalizes the WebApp `getStudy` payload (tolerates `{ study, cohorts }` or a flat study). */
export function normalizeStudyDetail(raw: unknown): SurveyStudyDetail {
  const value = (raw ?? {}) as Record<string, unknown>;
  const study = (value.study ?? value) as SurveyStudy;
  const cohorts = (value.cohorts ?? study.cohorts ?? []) as SurveyStudyCohort[];
  return {
    study,
    cohorts,
    invitationCounts: value.invitationCounts as SurveyStudyDetail['invitationCounts'],
    holdoutCounts: value.holdoutCounts as SurveyStudyDetail['holdoutCounts'],
  };
}

/**
 * Maps the WebApp `listStudies` payload (`{ studies: [{ study, cohorts }] }`, or a bare array) into
 * flat UI studies with their cohorts attached.
 */
export function normalizeStudyList(raw: unknown): SurveyStudy[] {
  const value = raw as { studies?: unknown } | unknown[] | null | undefined;
  const items = Array.isArray(value)
    ? value
    : Array.isArray(value?.studies)
      ? (value.studies as unknown[])
      : [];
  return items.map((item) => {
    const detail = normalizeStudyDetail(item);
    return { ...detail.study, cohorts: detail.cohorts };
  });
}
