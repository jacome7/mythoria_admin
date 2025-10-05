import {
  pgTable,
  uuid,
  timestamp,
  integer,
  varchar,
  jsonb,
  decimal,
  index,
} from 'drizzle-orm/pg-core';
import { aiActionType } from './enums';

// -----------------------------------------------------------------------------
// Token Usage Tracking Table
// -----------------------------------------------------------------------------

export const tokenUsageTracking = pgTable(
  'token_usage_tracking',
  {
    tokenUsageId: uuid('token_usage_id').defaultRandom().primaryKey().notNull(),
    authorId: uuid('author_id').notNull(), // Not a foreign key - cross-database reference
    storyId: uuid('story_id').notNull(), // Not a foreign key - cross-database reference
    action: aiActionType().notNull(),
    aiModel: varchar('ai_model', { length: 100 }).notNull(),
    inputTokens: integer('input_tokens').notNull(),
    outputTokens: integer('output_tokens').notNull(),
    estimatedCostInEuros: decimal('estimated_cost_in_euros', { precision: 10, scale: 6 }).notNull(),
    inputPromptJson: jsonb('input_prompt_json').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    // Indexes for performance optimization
    storyIdIdx: index('token_usage_story_id_idx').on(table.storyId),
    authorIdIdx: index('token_usage_author_id_idx').on(table.authorId),
    createdAtIdx: index('token_usage_created_at_idx').on(table.createdAt),
    authorIdCreatedAtIdx: index('token_usage_author_id_created_at_idx').on(
      table.authorId,
      table.createdAt,
    ),
    actionIdx: index('token_usage_action_idx').on(table.action),
    aiModelIdx: index('token_usage_ai_model_idx').on(table.aiModel),
  }),
);

// -----------------------------------------------------------------------------
// Token Usage Tracking Types
// -----------------------------------------------------------------------------

export type InsertTokenUsage = typeof tokenUsageTracking.$inferInsert;
export type SelectTokenUsage = typeof tokenUsageTracking.$inferSelect;
