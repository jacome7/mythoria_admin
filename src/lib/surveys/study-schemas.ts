import { z } from 'zod';
import { NOTIFICATION_PREFERENCES } from '@/lib/schemas/campaigns';
import { SURVEY_STUDY_COHORT_KEYS } from '@/lib/surveys/study-types';

export const REWARD_TYPES = ['pdf', 'audiobook'] as const;

export const rewardPolicySchema = z.object({
  rewardTypes: z.array(z.enum(REWARD_TYPES)).min(1),
  redemptionDeadline: z.string().datetime().nullable().optional(),
  allowExistingAudiobook: z.boolean().optional(),
});

export const studyCohortInputSchema = z.object({
  cohortKey: z.enum(SURVEY_STUDY_COHORT_KEYS),
  surveyId: z.string().min(1).max(64),
  version: z.number().int().min(1),
});

const studyFields = {
  studyKey: z
    .string()
    .min(3)
    .max(64)
    .regex(/^[a-z0-9][a-z0-9_-]*$/, 'Use lowercase letters, digits, "-" or "_"'),
  title: z.string().min(1).max(255),
  opensAt: z.string().datetime(),
  closesAt: z.string().datetime(),
  holdoutPercent: z.number().int().min(0).max(50),
  rewardPolicy: rewardPolicySchema,
  cohorts: z
    .array(studyCohortInputSchema)
    .min(1)
    .refine((cohorts) => new Set(cohorts.map((c) => c.cohortKey)).size === cohorts.length, {
      message: 'Each cohort can only be configured once',
    }),
};

export const createStudySchema = z
  .object(studyFields)
  .refine((data) => new Date(data.closesAt) > new Date(data.opensAt), {
    path: ['closesAt'],
    message: 'closesAt must be after opensAt',
  });

export type CreateStudyInput = z.infer<typeof createStudySchema>;

export const updateStudySchema = z
  .object({
    title: studyFields.title.optional(),
    opensAt: studyFields.opensAt.optional(),
    closesAt: studyFields.closesAt.optional(),
    holdoutPercent: studyFields.holdoutPercent.optional(),
    rewardPolicy: studyFields.rewardPolicy.optional(),
    cohorts: studyFields.cohorts.optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: 'Nothing to update' });

export const studyStatusSchema = z.object({
  status: z.enum(['active', 'closed', 'archived']),
});

const notificationPreferencesSchema = z.array(z.enum(NOTIFICATION_PREFERENCES)).min(1).optional();

export const previewAudienceSchema = z.object({
  notificationPreferences: notificationPreferencesSchema,
});

export const snapshotAudienceSchema = z.object({
  cohortKeys: z.array(z.enum(SURVEY_STUDY_COHORT_KEYS)).min(1),
  notificationPreferences: notificationPreferencesSchema,
  dryRun: z.boolean().optional(),
});

export const createCampaignsSchema = z.object({
  cohortKeys: z.array(z.enum(SURVEY_STUDY_COHORT_KEYS)).min(1).optional(),
});
