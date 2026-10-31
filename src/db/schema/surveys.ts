import { sql } from 'drizzle-orm';
import {
  pgTable,
  uuid,
  varchar,
  integer,
  timestamp,
  boolean,
  text,
  jsonb,
  doublePrecision,
  uniqueIndex,
  unique,
  index,
  check,
} from 'drizzle-orm/pg-core';
import { authors } from './authors';
import { stories } from './stories';
import { productGenerationRequests } from './analytics';

const time = (name: string) => timestamp(name, { withTimezone: true });

// -----------------------------------------------------------------------------
// Local JSON shapes. Kept self-contained (no imports from src/lib) because schema files
// are copied into other services by the schema sync scripts. The authoritative contracts
// live in `src/lib/surveys/definition-schema.ts`.
// -----------------------------------------------------------------------------

/** Immutable published survey definition (see `SurveyDefinition`). */
export type SurveyDefinitionJson = Record<string, unknown>;

/** Draft/submitted answer for a single question (see `AnswerValue`). */
export type SurveyAnswerValueJson =
  | { kind: 'choice'; optionIds: string[]; otherText?: string }
  | { kind: 'number'; value: number }
  | { kind: 'na'; optionId: string }
  | { kind: 'text'; text: string };

/** Answers keyed by question id (see `SurveyAnswers`). */
export type SurveyAnswersJson = Record<string, SurveyAnswerValueJson>;

export interface SurveyCohortSnapshot {
  publishedStoryCount: number;
  hasPaidPurchase: boolean;
  snapshotAt: string;
}

export type SurveyStatus = 'draft' | 'active' | 'archived';
export type SurveyStudyStatus = 'draft' | 'active' | 'closed' | 'archived';
export type SurveyInvitationStatus = 'not_started' | 'opened' | 'started' | 'submitted' | 'expired';
export type SurveyResponseStatus = 'in_progress' | 'submitted';
export type SurveyTextAnswerKind = 'free_text' | 'other_text';
export type SurveyRewardType = 'pdf' | 'audiobook';
export type SurveyRewardEntitlementStatus =
  'eligible' | 'pending_story' | 'selected' | 'processing' | 'delivered' | 'failed' | 'expired';

export const surveys = pgTable(
  'surveys',
  {
    surveyId: varchar('survey_id', { length: 64 }).primaryKey(),
    title: varchar('title', { length: 255 }).notNull(),
    purpose: text('purpose').notNull(),
    status: varchar('status', { length: 16 }).$type<SurveyStatus>().notNull().default('draft'),
    currentVersion: integer('current_version'),
    internalOnly: boolean('internal_only').notNull().default(false),
    createdAt: time('created_at').notNull().defaultNow(),
    updatedAt: time('updated_at').notNull().defaultNow(),
  },
  (t) => [check('surveys_status_check', sql`${t.status} in ('draft','active','archived')`)],
);

export const surveyVersions = pgTable(
  'survey_versions',
  {
    surveyVersionId: uuid('survey_version_id').primaryKey().defaultRandom(),
    surveyId: varchar('survey_id', { length: 64 })
      .notNull()
      .references(() => surveys.surveyId, { onDelete: 'restrict' }),
    version: integer('version').notNull(),
    schemaVersion: integer('schema_version').notNull(),
    definition: jsonb('definition').$type<SurveyDefinitionJson>().notNull(),
    definitionHash: varchar('definition_hash', { length: 64 }).notNull(),
    publishedAt: time('published_at').notNull().defaultNow(),
  },
  (t) => [uniqueIndex('survey_versions_survey_version_unique').on(t.surveyId, t.version)],
);

export const surveyStudies = pgTable(
  'survey_studies',
  {
    studyId: uuid('study_id').primaryKey().defaultRandom(),
    studyKey: varchar('study_key', { length: 64 }).notNull().unique(),
    title: varchar('title', { length: 255 }).notNull(),
    status: varchar('status', { length: 16 }).$type<SurveyStudyStatus>().notNull().default('draft'),
    opensAt: time('opens_at'),
    closesAt: time('closes_at'),
    rewardPolicy: jsonb('reward_policy').$type<Record<string, unknown>>(),
    holdoutPercent: integer('holdout_percent').notNull().default(0),
    createdBy: varchar('created_by', { length: 255 }),
    createdAt: time('created_at').notNull().defaultNow(),
    updatedAt: time('updated_at').notNull().defaultNow(),
    snapshotAt: time('snapshot_at'),
  },
  (t) => [
    check(
      'survey_studies_status_check',
      sql`${t.status} in ('draft','active','closed','archived')`,
    ),
    check('survey_studies_holdout_check', sql`${t.holdoutPercent} between 0 and 50`),
  ],
);

export const surveyStudyCohorts = pgTable(
  'survey_study_cohorts',
  {
    studyCohortId: uuid('study_cohort_id').primaryKey().defaultRandom(),
    studyId: uuid('study_id')
      .notNull()
      .references(() => surveyStudies.studyId, { onDelete: 'cascade' }),
    cohortKey: varchar('cohort_key', { length: 32 }).notNull(),
    surveyVersionId: uuid('survey_version_id')
      .notNull()
      .references(() => surveyVersions.surveyVersionId, { onDelete: 'restrict' }),
    // backoffice_db campaign ids (cross-database, so no FK).
    inviteCampaignId: varchar('invite_campaign_id', { length: 64 }),
    reminderCampaignId: varchar('reminder_campaign_id', { length: 64 }),
    createdAt: time('created_at').notNull().defaultNow(),
  },
  (t) => [uniqueIndex('survey_study_cohorts_study_cohort_unique').on(t.studyId, t.cohortKey)],
);

export const surveyInvitations = pgTable(
  'survey_invitations',
  {
    invitationId: uuid('invitation_id').primaryKey().defaultRandom(),
    studyId: uuid('study_id')
      .notNull()
      .references(() => surveyStudies.studyId, { onDelete: 'restrict' }),
    cohortKey: varchar('cohort_key', { length: 32 }).notNull(),
    surveyVersionId: uuid('survey_version_id')
      .notNull()
      .references(() => surveyVersions.surveyVersionId, { onDelete: 'restrict' }),
    // Cascade so account deletion removes survey participation with the author.
    authorId: uuid('author_id')
      .notNull()
      .references(() => authors.authorId, { onDelete: 'cascade' }),
    locale: varchar('locale', { length: 5 }).notNull(),
    isHoldout: boolean('is_holdout').notNull().default(false),
    cohortSnapshot: jsonb('cohort_snapshot').$type<SurveyCohortSnapshot>().notNull(),
    status: varchar('status', { length: 16 })
      .$type<SurveyInvitationStatus>()
      .notNull()
      .default('not_started'),
    openedAt: time('opened_at'),
    startedAt: time('started_at'),
    submittedAt: time('submitted_at'),
    expiredAt: time('expired_at'),
    createdAt: time('created_at').notNull().defaultNow(),
    updatedAt: time('updated_at').notNull().defaultNow(),
  },
  (t) => [
    // One cohort per person per study.
    uniqueIndex('survey_invitations_study_author_unique').on(t.studyId, t.authorId),
    index('survey_invitations_study_cohort_status_idx').on(t.studyId, t.cohortKey, t.status),
    index('survey_invitations_author_idx').on(t.authorId),
    check(
      'survey_invitations_status_check',
      sql`${t.status} in ('not_started','opened','started','submitted','expired')`,
    ),
  ],
);

export const surveyResponses = pgTable(
  'survey_responses',
  {
    responseId: uuid('response_id').primaryKey().defaultRandom(),
    invitationId: uuid('invitation_id')
      .notNull()
      .unique()
      .references(() => surveyInvitations.invitationId, { onDelete: 'cascade' }),
    surveyVersionId: uuid('survey_version_id')
      .notNull()
      .references(() => surveyVersions.surveyVersionId, { onDelete: 'restrict' }),
    authorId: uuid('author_id')
      .notNull()
      .references(() => authors.authorId, { onDelete: 'cascade' }),
    status: varchar('status', { length: 16 })
      .$type<SurveyResponseStatus>()
      .notNull()
      .default('in_progress'),
    draftAnswers: jsonb('draft_answers').$type<SurveyAnswersJson>().notNull().default({}),
    shownQuestionIds: text('shown_question_ids').array(),
    locale: varchar('locale', { length: 5 }).notNull(),
    // Idempotency key for submission retries.
    submissionKey: varchar('submission_key', { length: 128 }).unique(),
    startedAt: time('started_at').notNull().defaultNow(),
    lastSavedAt: time('last_saved_at'),
    submittedAt: time('submitted_at'),
    durationMs: integer('duration_ms'),
  },
  (t) => [
    index('survey_responses_version_status_idx').on(t.surveyVersionId, t.status),
    check('survey_responses_status_check', sql`${t.status} in ('in_progress','submitted')`),
  ],
);

/** Normalized, coded answers only. Free text lives in `survey_text_answers`. */
export const surveyAnswers = pgTable(
  'survey_answers',
  {
    answerId: uuid('answer_id').primaryKey().defaultRandom(),
    responseId: uuid('response_id')
      .notNull()
      .references(() => surveyResponses.responseId, { onDelete: 'cascade' }),
    surveyVersionId: uuid('survey_version_id')
      .notNull()
      .references(() => surveyVersions.surveyVersionId, { onDelete: 'restrict' }),
    questionId: varchar('question_id', { length: 64 }).notNull(),
    dimension: varchar('dimension', { length: 64 }).notNull(),
    optionId: varchar('option_id', { length: 64 }),
    valueNumeric: doublePrecision('value_numeric'),
    isNotApplicable: boolean('is_not_applicable').notNull().default(false),
    hasOtherText: boolean('has_other_text').notNull().default(false),
    // Shown but optional and unanswered; kept so denominators equal "shown".
    isSkipped: boolean('is_skipped').notNull().default(false),
    createdAt: time('created_at').notNull().defaultNow(),
  },
  (t) => [
    index('survey_answers_version_question_option_idx').on(
      t.surveyVersionId,
      t.questionId,
      t.optionId,
    ),
    index('survey_answers_response_idx').on(t.responseId),
    unique('survey_answers_response_question_option_unique')
      .on(t.responseId, t.questionId, t.optionId)
      .nullsNotDistinct(),
  ],
);

/** Restricted free text (free-text questions and "other" option text). */
export const surveyTextAnswers = pgTable(
  'survey_text_answers',
  {
    textAnswerId: uuid('text_answer_id').primaryKey().defaultRandom(),
    responseId: uuid('response_id')
      .notNull()
      .references(() => surveyResponses.responseId, { onDelete: 'cascade' }),
    surveyVersionId: uuid('survey_version_id')
      .notNull()
      .references(() => surveyVersions.surveyVersionId, { onDelete: 'restrict' }),
    questionId: varchar('question_id', { length: 64 }).notNull(),
    kind: varchar('kind', { length: 16 }).$type<SurveyTextAnswerKind>().notNull(),
    optionId: varchar('option_id', { length: 64 }),
    textValue: text('text_value').notNull(),
    createdAt: time('created_at').notNull().defaultNow(),
    redactedAt: time('redacted_at'),
  },
  (t) => [
    index('survey_text_answers_version_question_idx').on(t.surveyVersionId, t.questionId),
    check('survey_text_answers_kind_check', sql`${t.kind} in ('free_text','other_text')`),
  ],
);

export const surveyRewardEntitlements = pgTable(
  'survey_reward_entitlements',
  {
    entitlementId: uuid('entitlement_id').primaryKey().defaultRandom(),
    invitationId: uuid('invitation_id')
      .notNull()
      .unique()
      .references(() => surveyInvitations.invitationId, { onDelete: 'cascade' }),
    responseId: uuid('response_id')
      .notNull()
      .unique()
      .references(() => surveyResponses.responseId, { onDelete: 'cascade' }),
    authorId: uuid('author_id')
      .notNull()
      .references(() => authors.authorId, { onDelete: 'cascade' }),
    rewardType: varchar('reward_type', { length: 16 }).$type<SurveyRewardType>(),
    storyId: uuid('story_id').references(() => stories.storyId, { onDelete: 'set null' }),
    status: varchar('status', { length: 24 })
      .$type<SurveyRewardEntitlementStatus>()
      .notNull()
      .default('eligible'),
    productRunId: uuid('product_run_id').references(() => productGenerationRequests.runId, {
      onDelete: 'set null',
    }),
    expiresAt: time('expires_at'),
    selectedAt: time('selected_at'),
    redeemedAt: time('redeemed_at'),
    deliveredAt: time('delivered_at'),
    failedAt: time('failed_at'),
    lastError: varchar('last_error', { length: 255 }),
    attempts: integer('attempts').notNull().default(0),
    createdAt: time('created_at').notNull().defaultNow(),
    updatedAt: time('updated_at').notNull().defaultNow(),
  },
  (t) => [
    index('survey_reward_entitlements_author_status_idx').on(t.authorId, t.status),
    index('survey_reward_entitlements_status_idx').on(t.status),
    check(
      'survey_reward_entitlements_reward_type_check',
      sql`${t.rewardType} is null or ${t.rewardType} in ('pdf','audiobook')`,
    ),
    check(
      'survey_reward_entitlements_status_check',
      sql`${t.status} in ('eligible','pending_story','selected','processing','delivered','failed','expired')`,
    ),
  ],
);

export type Survey = typeof surveys.$inferSelect;
export type NewSurvey = typeof surveys.$inferInsert;
export type SurveyVersion = typeof surveyVersions.$inferSelect;
export type NewSurveyVersion = typeof surveyVersions.$inferInsert;
export type SurveyStudy = typeof surveyStudies.$inferSelect;
export type NewSurveyStudy = typeof surveyStudies.$inferInsert;
export type SurveyStudyCohort = typeof surveyStudyCohorts.$inferSelect;
export type NewSurveyStudyCohort = typeof surveyStudyCohorts.$inferInsert;
export type SurveyInvitation = typeof surveyInvitations.$inferSelect;
export type NewSurveyInvitation = typeof surveyInvitations.$inferInsert;
export type SurveyResponse = typeof surveyResponses.$inferSelect;
export type NewSurveyResponse = typeof surveyResponses.$inferInsert;
export type SurveyAnswerRow = typeof surveyAnswers.$inferSelect;
export type NewSurveyAnswerRow = typeof surveyAnswers.$inferInsert;
export type SurveyTextAnswer = typeof surveyTextAnswers.$inferSelect;
export type NewSurveyTextAnswer = typeof surveyTextAnswers.$inferInsert;
export type SurveyRewardEntitlement = typeof surveyRewardEntitlements.$inferSelect;
export type NewSurveyRewardEntitlement = typeof surveyRewardEntitlements.$inferInsert;
