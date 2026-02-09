import { z } from 'zod';

// -----------------------------------------------------------------------------
// Shared constants
// -----------------------------------------------------------------------------
export const SUPPORTED_LOCALES = ['en-US', 'pt-PT', 'es-ES', 'fr-FR', 'de-DE'] as const;

export const CAMPAIGN_STATUSES = ['draft', 'active', 'paused', 'completed', 'cancelled'] as const;
export const AUDIENCE_SOURCES = ['users', 'leads', 'both'] as const;
export const CAMPAIGN_CHANNELS = ['email'] as const;
export const NOTIFICATION_PREFERENCES = ['essential', 'inspiration', 'news'] as const;

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

// -----------------------------------------------------------------------------
// Create campaign schema
// -----------------------------------------------------------------------------
export const createCampaignSchema = z.object({
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
  startAt: z.string().datetime().nullable().optional(),
  endAt: z.string().datetime().nullable().optional(),
});

export type CreateCampaignInput = z.infer<typeof createCampaignSchema>;

// -----------------------------------------------------------------------------
// Update campaign schema
// -----------------------------------------------------------------------------
export const updateCampaignSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().max(5000).nullable().optional(),
  audienceSource: z.enum(AUDIENCE_SOURCES).optional(),
  userNotificationPreferences: z
    .array(z.enum(NOTIFICATION_PREFERENCES))
    .min(1)
    .nullable()
    .optional(),
  filterTree: filterTreeSchema.nullable().optional(),
  dailySendLimit: z.number().int().min(1).nullable().optional(),
  startAt: z.string().datetime().nullable().optional(),
  endAt: z.string().datetime().nullable().optional(),
});

export type UpdateCampaignInput = z.infer<typeof updateCampaignSchema>;

// -----------------------------------------------------------------------------
// Audience estimate schema (draft overrides)
// -----------------------------------------------------------------------------
export const audienceEstimateSchema = z.object({
  audienceSource: z.enum(AUDIENCE_SOURCES).optional(),
  userNotificationPreferences: z.array(z.enum(NOTIFICATION_PREFERENCES)).nullable().optional(),
  filterTree: filterTreeSchema.nullable().optional(),
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
