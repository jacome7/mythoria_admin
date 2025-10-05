import {
  pgTable,
  uuid,
  text,
  varchar,
  timestamp,
  jsonb,
  index,
  primaryKey,
  foreignKey,
} from 'drizzle-orm/pg-core';
import { runStatus, stepStatus } from './enums';

// -----------------------------------------------------------------------------
// Story Generation Runs Table
// -----------------------------------------------------------------------------

export const storyGenerationRuns = pgTable(
  'story_generation_runs',
  {
    runId: uuid('run_id').defaultRandom().primaryKey().notNull(),
    storyId: uuid('story_id').notNull(), // No foreign key - cross-database reference
    gcpWorkflowExecution: text('gcp_workflow_execution'),
    status: runStatus().default('queued').notNull(),
    currentStep: varchar('current_step', { length: 120 }),
    errorMessage: text('error_message'),
    startedAt: timestamp('started_at', { withTimezone: true, mode: 'string' }),
    endedAt: timestamp('ended_at', { withTimezone: true, mode: 'string' }),
    metadata: jsonb(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    // Indexes for performance optimization
    storyIdIdx: index('story_generation_runs_story_id_idx').on(table.storyId),
    statusIdx: index('story_generation_runs_status_idx').on(table.status),
    createdAtIdx: index('story_generation_runs_created_at_idx').on(table.createdAt),
  }),
);

// -----------------------------------------------------------------------------
// Story Generation Steps Table
// -----------------------------------------------------------------------------

export const storyGenerationSteps = pgTable(
  'story_generation_steps',
  {
    runId: uuid('run_id').notNull(),
    stepName: varchar('step_name', { length: 120 }).notNull(),
    status: stepStatus().default('pending').notNull(),
    detailJson: jsonb('detail_json'),
    startedAt: timestamp('started_at', { withTimezone: true, mode: 'string' }),
    endedAt: timestamp('ended_at', { withTimezone: true, mode: 'string' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    // Primary key
    primaryKey({
      columns: [table.runId, table.stepName],
      name: 'story_generation_steps_run_id_step_name_pk',
    }),
    // Foreign key to story_generation_runs within same database
    foreignKey({
      columns: [table.runId],
      foreignColumns: [storyGenerationRuns.runId],
      name: 'story_generation_steps_run_id_story_generation_runs_run_id_fk',
    }).onDelete('cascade'),
    // Indexes for performance optimization
    index('story_generation_steps_run_id_idx').on(table.runId),
    index('story_generation_steps_status_idx').on(table.status),
  ],
);

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export type InsertStoryGenerationRun = typeof storyGenerationRuns.$inferInsert;
export type SelectStoryGenerationRun = typeof storyGenerationRuns.$inferSelect;

export type InsertStoryGenerationStep = typeof storyGenerationSteps.$inferInsert;
export type SelectStoryGenerationStep = typeof storyGenerationSteps.$inferSelect;
