import { z } from 'zod';

// -----------------------------------------------------------------------------
// Shared constants
// -----------------------------------------------------------------------------
export const SUPPORTED_LOCALES = ['en-US', 'pt-PT', 'es-ES', 'fr-FR', 'de-DE'] as const;

export const CAMPAIGN_STATUSES = ['draft', 'active', 'paused', 'completed', 'cancelled'] as const;
export const GENERAL_AUDIENCE_SOURCES = ['users', 'leads', 'both'] as const;
export const SURVEY_AUDIENCE_SOURCE = 'survey_invitations' as const;
export const AUDIENCE_SOURCES = [...GENERAL_AUDIENCE_SOURCES, SURVEY_AUDIENCE_SOURCE] as const;
export const SURVEY_COHORT_KEYS = ['C1', 'C2', 'C3'] as const;
export const SURVEY_AUDIENCE_MODES = ['invite', 'reminder'] as const;
export const CAMPAIGN_CHANNELS = ['email'] as const;
export const NOTIFICATION_PREFERENCES = ['essential', 'inspiration', 'news'] as const;
export const CAMPAIGN_ATTACHMENT_TYPES = ['none', 'selfprint'] as const;

// -----------------------------------------------------------------------------
// Filter tree schema
// -----------------------------------------------------------------------------
const filterConditionSchema = z.object({
  field: z.string().min(1),
  operator: z.enum(['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'between', 'in', 'not_in', 'is_null']),
  value: z.union([z.string(), z.number(), z.boolean(), z.array(z.string()), z.null()]),
});

export type FilterCondition = z.infer<typeof filterConditionSchema>;

export const filterTreeSchema: z.ZodType<FilterTree> = z.lazy(() =>
  z.object({
    logic: z.enum(['and', 'or']),
    conditions: z.array(z.union([filterConditionSchema, filterTreeSchema])),
  }),
);

export interface FilterTree {
  logic: 'and' | 'or';
  conditions: (FilterCondition | FilterTree)[];
}

/** Adds an issue when both dates are set and the end is not strictly after the start. */
function refineDateWindow(
  data: { startAt?: string | null; endAt?: string | null },
  ctx: z.RefinementCtx,
) {
  if (
    data.startAt &&
    data.endAt &&
    new Date(data.endAt).getTime() <= new Date(data.startAt).getTime()
  ) {
    ctx.addIssue({
      code: 'custom',
      path: ['endAt'],
      message: 'End date must be after the start date.',
    });
  }
}

// -----------------------------------------------------------------------------
// Create campaign schema
// -----------------------------------------------------------------------------
export const createCampaignSchema = z
  .object({
    title: z.string().min(1).max(255),
    description: z.string().max(5000).nullable().optional(),
    audienceSource: z.enum(AUDIENCE_SOURCES),
    userNotificationPreferences: z
      .array(z.enum(NOTIFICATION_PREFERENCES))
      .min(1)
      .nullable()
      .optional(),
    filterTree: filterTreeSchema.nullable().optional(),
    dailySendLimit: z.number().int().min(1).nullable().optional(),
    attachmentType: z.enum(CAMPAIGN_ATTACHMENT_TYPES).optional(),
    skipPrintQa: z.boolean().optional(),
    startAt: z.string().datetime().nullable().optional(),
    endAt: z.string().datetime().nullable().optional(),
    // Survey campaigns (audienceSource = 'survey_invitations').
    surveyStudyId: z.string().uuid().nullable().optional(),
    surveyCohortKey: z.enum(SURVEY_COHORT_KEYS).nullable().optional(),
    surveyAudienceMode: z.enum(SURVEY_AUDIENCE_MODES).nullable().optional(),
  })
  .superRefine((data, ctx) => {
    refineDateWindow(data, ctx);
    if (data.attachmentType === 'selfprint' && data.audienceSource === 'leads') {
      ctx.addIssue({
        code: 'custom',
        path: ['audienceSource'],
        message:
          "Self-print attachments require at least one real user — 'leads' audience is not allowed.",
      });
    }
    const hasSurveyFields =
      data.surveyStudyId != null || data.surveyCohortKey != null || data.surveyAudienceMode != null;
    if (data.audienceSource === SURVEY_AUDIENCE_SOURCE) {
      for (const field of ['surveyStudyId', 'surveyCohortKey', 'surveyAudienceMode'] as const) {
        if (data[field] == null) {
          ctx.addIssue({
            code: 'custom',
            path: [field],
            message: 'Survey campaigns require a study, a cohort and an audience mode.',
          });
        }
      }
      if (data.attachmentType === 'selfprint') {
        ctx.addIssue({
          code: 'custom',
          path: ['attachmentType'],
          message: 'Survey campaigns cannot carry self-print attachments.',
        });
      }
    } else if (hasSurveyFields) {
      ctx.addIssue({
        code: 'custom',
        path: ['audienceSource'],
        message: "Survey fields require audienceSource 'survey_invitations'.",
      });
    }
  });

export type CreateCampaignInput = z.infer<typeof createCampaignSchema>;

// -----------------------------------------------------------------------------
// Update campaign schema
// -----------------------------------------------------------------------------
export const updateCampaignSchema = z
  .object({
    title: z.string().min(1).max(255).optional(),
    description: z.string().max(5000).nullable().optional(),
    // Survey audience source and survey fields are set at creation only and cannot be edited.
    audienceSource: z.enum(GENERAL_AUDIENCE_SOURCES).optional(),
    userNotificationPreferences: z
      .array(z.enum(NOTIFICATION_PREFERENCES))
      .min(1)
      .nullable()
      .optional(),
    filterTree: filterTreeSchema.nullable().optional(),
    dailySendLimit: z.number().int().min(1).nullable().optional(),
    attachmentType: z.enum(CAMPAIGN_ATTACHMENT_TYPES).optional(),
    skipPrintQa: z.boolean().optional(),
    startAt: z.string().datetime().nullable().optional(),
    endAt: z.string().datetime().nullable().optional(),
  })
  .superRefine((data, ctx) => {
    refineDateWindow(data, ctx);
    if (data.attachmentType === 'selfprint' && data.audienceSource === 'leads') {
      ctx.addIssue({
        code: 'custom',
        path: ['audienceSource'],
        message:
          "Self-print attachments require at least one real user — 'leads' audience is not allowed.",
      });
    }
  });

export type UpdateCampaignInput = z.infer<typeof updateCampaignSchema>;

// -----------------------------------------------------------------------------
// Audience estimate schema (draft overrides)
// -----------------------------------------------------------------------------
export const audienceEstimateSchema = z.object({
  audienceSource: z.enum(AUDIENCE_SOURCES).optional(),
  userNotificationPreferences: z.array(z.enum(NOTIFICATION_PREFERENCES)).nullable().optional(),
  filterTree: filterTreeSchema.nullable().optional(),
  attachmentType: z.enum(CAMPAIGN_ATTACHMENT_TYPES).optional(),
});

export type AudienceEstimateInput = z.infer<typeof audienceEstimateSchema>;

// -----------------------------------------------------------------------------
// Campaign asset schema
// -----------------------------------------------------------------------------
export const campaignAssetSchema = z.object({
  language: z.string().min(2).max(10),
  subject: z.string().min(1).max(1000),
  htmlBody: z.string().min(1),
  textBody: z.string().min(1),
});

export type CampaignAssetInput = z.infer<typeof campaignAssetSchema>;

// -----------------------------------------------------------------------------
// Sample send schema
// -----------------------------------------------------------------------------
export const sampleSendSchema = z.object({
  locale: z.string().min(2).max(10),
  email: z.string().email(),
  variables: z.record(z.string(), z.unknown()).optional(),
});

export type SampleSendInput = z.infer<typeof sampleSendSchema>;

// -----------------------------------------------------------------------------
// Pagination schema
// -----------------------------------------------------------------------------
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(CAMPAIGN_STATUSES).optional(),
});

export type PaginationInput = z.infer<typeof paginationSchema>;
