import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  jsonb,
  integer,
  boolean,
  index,
  uniqueIndex,
  pgEnum,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// -----------------------------------------------------------------------------
// Campaign enums
// -----------------------------------------------------------------------------
export const campaignStatusEnum = pgEnum('campaign_status', [
  'draft',
  'active',
  'paused',
  'completed',
  'cancelled',
]);

export const campaignAudienceSourceEnum = pgEnum('campaign_audience_source', [
  'users',
  'leads',
  'both',
]);

export const campaignChannelEnum = pgEnum('campaign_channel', ['email']);

export const campaignBatchStatusEnum = pgEnum('campaign_batch_status', [
  'queued',
  'running',
  'completed',
  'failed',
]);

export const campaignRecipientStatusEnum = pgEnum('campaign_recipient_status', [
  'queued',
  'sent',
  'failed',
  'skipped',
]);

export const campaignRecipientTypeEnum = pgEnum('campaign_recipient_type', ['user', 'lead']);

// -----------------------------------------------------------------------------
// Marketing campaigns table
// -----------------------------------------------------------------------------
export const marketingCampaigns = pgTable(
  'marketing_campaigns',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    title: varchar('title', { length: 255 }).notNull(),
    description: text('description'),
    status: campaignStatusEnum('status').default('draft').notNull(),
    audienceSource: campaignAudienceSourceEnum('audience_source').notNull(),
    userNotificationPreferences: varchar('user_notification_preferences', { length: 20 }).array(),
    filterTree: jsonb('filter_tree'),
    dailySendLimit: integer('daily_send_limit'),
    startAt: timestamp('start_at', { withTimezone: true }),
    endAt: timestamp('end_at', { withTimezone: true }),
    createdBy: varchar('created_by', { length: 255 }).notNull(),
    updatedBy: varchar('updated_by', { length: 255 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
  },
  (table) => ({
    statusIdx: index('idx_campaigns_status').on(table.status),
    createdAtIdx: index('idx_campaigns_created_at').on(table.createdAt),
  }),
);

// -----------------------------------------------------------------------------
// Marketing campaign assets table (per-locale templates)
// -----------------------------------------------------------------------------
export const marketingCampaignAssets = pgTable(
  'marketing_campaign_assets',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    campaignId: uuid('campaign_id')
      .references(() => marketingCampaigns.id, { onDelete: 'cascade' })
      .notNull(),
    channel: campaignChannelEnum('channel').notNull(),
    language: varchar('language', { length: 10 }).notNull(),
    subject: text('subject').notNull(),
    htmlBody: text('html_body').notNull(),
    textBody: text('text_body').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
  },
  (table) => ({
    campaignLocaleUnique: uniqueIndex('uq_campaign_channel_language').on(
      table.campaignId,
      table.channel,
      table.language,
    ),
    campaignIdIdx: index('idx_campaign_assets_campaign_id').on(table.campaignId),
  }),
);

// -----------------------------------------------------------------------------
// Marketing campaign batches table
// -----------------------------------------------------------------------------
export const marketingCampaignBatches = pgTable(
  'marketing_campaign_batches',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    campaignId: uuid('campaign_id')
      .references(() => marketingCampaigns.id, { onDelete: 'cascade' })
      .notNull(),
    status: campaignBatchStatusEnum('status').default('queued').notNull(),
    requestedBy: varchar('requested_by', { length: 255 }),
    requestedAt: timestamp('requested_at', { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
    startedAt: timestamp('started_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    statsJson: jsonb('stats_json').$type<{
      processed: number;
      sent: number;
      failed: number;
      skipped: number;
    }>(),
    assetSnapshotHash: varchar('asset_snapshot_hash', { length: 128 }),
    sampleSend: boolean('sample_send').default(false).notNull(),
  },
  (table) => ({
    campaignIdIdx: index('idx_campaign_batches_campaign_id').on(table.campaignId),
    statusIdx: index('idx_campaign_batches_status').on(table.status),
  }),
);

// -----------------------------------------------------------------------------
// Marketing campaign recipients table
// -----------------------------------------------------------------------------
export const marketingCampaignRecipients = pgTable(
  'marketing_campaign_recipients',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    batchId: uuid('batch_id')
      .references(() => marketingCampaignBatches.id, { onDelete: 'cascade' })
      .notNull(),
    campaignId: uuid('campaign_id')
      .references(() => marketingCampaigns.id, { onDelete: 'cascade' })
      .notNull(),
    recipientType: campaignRecipientTypeEnum('recipient_type').notNull(),
    recipientId: uuid('recipient_id').notNull(),
    email: varchar('email', { length: 255 }).notNull(),
    language: varchar('language', { length: 10 }).notNull(),
    status: campaignRecipientStatusEnum('status').default('queued').notNull(),
    lastError: text('last_error'),
    processedAt: timestamp('processed_at', { withTimezone: true }),
  },
  (table) => ({
    campaignRecipientUnique: uniqueIndex('uq_campaign_recipient').on(
      table.campaignId,
      table.recipientId,
    ),
    campaignStatusIdx: index('idx_campaign_recipients_campaign_status').on(
      table.campaignId,
      table.status,
    ),
    campaignProcessedIdx: index('idx_campaign_recipients_campaign_processed').on(
      table.campaignId,
      table.processedAt,
    ),
  }),
);

// -----------------------------------------------------------------------------
// TypeScript types
// -----------------------------------------------------------------------------
export type MarketingCampaign = typeof marketingCampaigns.$inferSelect;
export type NewMarketingCampaign = typeof marketingCampaigns.$inferInsert;
export type MarketingCampaignAsset = typeof marketingCampaignAssets.$inferSelect;
export type NewMarketingCampaignAsset = typeof marketingCampaignAssets.$inferInsert;
export type MarketingCampaignBatch = typeof marketingCampaignBatches.$inferSelect;
export type NewMarketingCampaignBatch = typeof marketingCampaignBatches.$inferInsert;
export type MarketingCampaignRecipient = typeof marketingCampaignRecipients.$inferSelect;
export type NewMarketingCampaignRecipient = typeof marketingCampaignRecipients.$inferInsert;

export type CampaignStatus = (typeof campaignStatusEnum.enumValues)[number];
export type CampaignAudienceSource = (typeof campaignAudienceSourceEnum.enumValues)[number];
export type CampaignChannel = (typeof campaignChannelEnum.enumValues)[number];
export type CampaignBatchStatus = (typeof campaignBatchStatusEnum.enumValues)[number];
export type CampaignRecipientStatus = (typeof campaignRecipientStatusEnum.enumValues)[number];
export type CampaignRecipientType = (typeof campaignRecipientTypeEnum.enumValues)[number];
