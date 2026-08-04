import {
  bigint,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { authors } from './authors';
import { stories } from './stories';

export interface AnalyticsConsent {
  analyticsStorage: 'granted';
  adUserData: 'granted' | 'denied';
  adPersonalization: 'granted' | 'denied';
}

export const analyticsAttributions = pgTable(
  'analytics_attributions',
  {
    attributionId: uuid('attribution_id').primaryKey().defaultRandom(),
    authorId: uuid('author_id').references(() => authors.authorId, { onDelete: 'set null' }),
    clientId: varchar('client_id', { length: 100 }).notNull(),
    sessionId: bigint('session_id', { mode: 'number' }),
    consent: jsonb('consent').$type<AnalyticsConsent>().notNull(),
    landingSlug: varchar('landing_slug', { length: 160 }),
    primaryIntent: varchar('primary_intent', { length: 120 }),
    utmSource: varchar('utm_source', { length: 255 }),
    utmMedium: varchar('utm_medium', { length: 255 }),
    utmCampaign: varchar('utm_campaign', { length: 255 }),
    utmId: varchar('utm_id', { length: 255 }),
    utmTerm: varchar('utm_term', { length: 255 }),
    utmContent: varchar('utm_content', { length: 255 }),
    gclid: varchar('gclid', { length: 255 }),
    gbraid: varchar('gbraid', { length: 255 }),
    wbraid: varchar('wbraid', { length: 255 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    linkedAt: timestamp('linked_at', { withTimezone: true }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  },
  (table) => ({
    authorIdIdx: index('analytics_attributions_author_id_idx').on(table.authorId),
    expiresAtIdx: index('analytics_attributions_expires_at_idx').on(table.expiresAt),
  }),
);

export const analyticsOutbox = pgTable(
  'analytics_outbox',
  {
    outboxId: uuid('outbox_id').primaryKey().defaultRandom(),
    dedupeKey: varchar('dedupe_key', { length: 255 }).notNull(),
    eventName: varchar('event_name', { length: 40 }).notNull(),
    authorId: uuid('author_id').references(() => authors.authorId, { onDelete: 'set null' }),
    clientId: varchar('client_id', { length: 100 }),
    userId: varchar('user_id', { length: 255 }),
    sessionId: bigint('session_id', { mode: 'number' }),
    consent: jsonb('consent').$type<AnalyticsConsent>(),
    params: jsonb('params').$type<Record<string, unknown>>().notNull(),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).defaultNow().notNull(),
    availableAt: timestamp('available_at', { withTimezone: true }).defaultNow().notNull(),
    attempts: integer('attempts').default(0).notNull(),
    claimToken: uuid('claim_token'),
    claimedAt: timestamp('claimed_at', { withTimezone: true }),
    deliveredAt: timestamp('delivered_at', { withTimezone: true }),
    skippedAt: timestamp('skipped_at', { withTimezone: true }),
    lastError: text('last_error'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    dedupeKeyUnique: uniqueIndex('analytics_outbox_dedupe_key_unique').on(table.dedupeKey),
    pendingIdx: index('analytics_outbox_pending_idx').on(
      table.deliveredAt,
      table.skippedAt,
      table.availableAt,
    ),
    claimIdx: index('analytics_outbox_claim_idx').on(
      table.deliveredAt,
      table.skippedAt,
      table.availableAt,
      table.claimedAt,
    ),
  }),
);

export const storyGenerationRequests = pgTable(
  'story_generation_requests',
  {
    runId: uuid('run_id').primaryKey(),
    storyId: uuid('story_id')
      .notNull()
      .references(() => stories.storyId, { onDelete: 'cascade' }),
    authorId: uuid('author_id')
      .notNull()
      .references(() => authors.authorId, { onDelete: 'cascade' }),
    idempotencyKey: varchar('idempotency_key', { length: 255 }).notNull(),
    creditsSpent: integer('credits_spent').notNull(),
    attributionId: uuid('attribution_id').references(() => analyticsAttributions.attributionId, {
      onDelete: 'set null',
    }),
    clientId: varchar('client_id', { length: 100 }),
    sessionId: bigint('session_id', { mode: 'number' }),
    consent: jsonb('consent').$type<AnalyticsConsent>(),
    status: varchar('status', { length: 32 }).default('queued').notNull(),
    publishAttempts: integer('publish_attempts').default(0).notNull(),
    availableAt: timestamp('available_at', { withTimezone: true }).defaultNow().notNull(),
    messageId: varchar('message_id', { length: 255 }),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    terminalAt: timestamp('terminal_at', { withTimezone: true }),
    compensatedAt: timestamp('compensated_at', { withTimezone: true }),
    lastError: text('last_error'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    idempotencyKeyUnique: uniqueIndex('story_generation_requests_idempotency_key_unique').on(
      table.idempotencyKey,
    ),
    pendingIdx: index('story_generation_requests_pending_idx').on(table.status, table.availableAt),
    storyIdx: index('story_generation_requests_story_id_idx').on(table.storyId),
  }),
);

export type AnalyticsAttribution = typeof analyticsAttributions.$inferSelect;
export type NewAnalyticsAttribution = typeof analyticsAttributions.$inferInsert;
export type AnalyticsOutboxEntry = typeof analyticsOutbox.$inferSelect;
export type NewAnalyticsOutboxEntry = typeof analyticsOutbox.$inferInsert;
export type StoryGenerationRequest = typeof storyGenerationRequests.$inferSelect;
export type NewStoryGenerationRequest = typeof storyGenerationRequests.$inferInsert;
