import {
  pgTable,
  uuid,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { stories } from './stories';
import { authors } from './authors';

export const biographerProjects = pgTable('biographer_projects', {
  id: uuid('id').primaryKey().defaultRandom(),
  authorId: uuid('author_id')
    .notNull()
    .references(() => authors.authorId, { onDelete: 'cascade' }),
  storyId: uuid('story_id').references(() => stories.storyId, { onDelete: 'set null' }),
  generationSnapshot: jsonb('generation_snapshot').$type<Record<string, unknown> | null>(),
  title: text('title').notNull().default(''),
  subject: text('subject').notNull().default(''),
  purpose: text('purpose').notNull().default(''),
  locale: text('locale').notNull().default('en-US'),
  status: text('status').notNull().default('collecting'),
  revision: integer('revision').notNull().default(0),
  liveEnabled: boolean('live_enabled').notNull().default(true),
  liveSeconds: integer('live_seconds').notNull().default(0),
  allowanceSeconds: integer('allowance_seconds').notNull().default(10800),
  proposal: jsonb('proposal').$type<Record<string, unknown> | null>(),
  proposalRevision: integer('proposal_revision'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
export const biographerParticipants = pgTable(
  'biographer_participants',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => biographerProjects.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    role: text('role').notNull().default('owner'),
    consentAt: timestamp('consent_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex('biographer_owner_project_unique').on(t.projectId, t.role)],
);
export const biographerTurns = pgTable('biographer_turns', {
  id: uuid('id').primaryKey(),
  projectId: uuid('project_id')
    .notNull()
    .references(() => biographerProjects.id, { onDelete: 'cascade' }),
  participantId: uuid('participant_id')
    .notNull()
    .references(() => biographerParticipants.id, { onDelete: 'cascade' }),
  role: text('role').notNull(),
  text: text('text').notNull().default(''),
  originalText: text('original_text').notNull().default(''),
  revision: integer('revision').notNull().default(0),
  included: boolean('included').notNull().default(true),
  final: boolean('final').notNull().default(false),
  interrupted: boolean('interrupted').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
export const biographerSegments = pgTable(
  'biographer_segments',
  {
    id: uuid('id').primaryKey(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => biographerProjects.id, { onDelete: 'cascade' }),
    participantId: uuid('participant_id')
      .notNull()
      .references(() => biographerParticipants.id, { onDelete: 'cascade' }),
    turnId: uuid('turn_id').notNull(),
    sequence: integer('sequence').notNull(),
    objectPath: text('object_path').notNull(),
    contentType: text('content_type').notNull(),
    sha256: text('sha256').notNull(),
    bytes: integer('bytes').notNull(),
    durationMs: integer('duration_ms').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex('biographer_segment_sequence_unique').on(t.projectId, t.turnId, t.sequence)],
);
export const biographerSessions = pgTable('biographer_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id')
    .notNull()
    .references(() => biographerProjects.id, { onDelete: 'cascade' }),
  participantId: uuid('participant_id')
    .notNull()
    .references(() => biographerParticipants.id, { onDelete: 'cascade' }),
  ticketHash: text('ticket_hash').notNull().unique(),
  ticketExpiresAt: timestamp('ticket_expires_at', { withTimezone: true }).notNull(),
  consumedAt: timestamp('consumed_at', { withTimezone: true }),
  leaseId: uuid('lease_id').notNull(),
  leaseExpiresAt: timestamp('lease_expires_at', { withTimezone: true }),
  accountedAt: timestamp('accounted_at', { withTimezone: true }),
  reservedSeconds: integer('reserved_seconds').notNull().default(0),
  endedAt: timestamp('ended_at', { withTimezone: true }),
});
export const biographerEvents = pgTable('biographer_events', {
  eventId: uuid('event_id').primaryKey(),
  sessionId: uuid('session_id')
    .notNull()
    .references(() => biographerSessions.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
export const biographerAdminActions = pgTable('biographer_admin_actions', {
  requestId: uuid('request_id').primaryKey(),
  projectId: uuid('project_id')
    .notNull()
    .references(() => biographerProjects.id, { onDelete: 'cascade' }),
  actor: text('actor').notNull(),
  caller: text('caller').notNull(),
  operation: text('operation').notNull(),
  reason: text('reason').notNull(),
  payload: text('payload').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
export const biographerAssets = pgTable('biographer_assets', {
  id: uuid('id').primaryKey(),
  projectId: uuid('project_id')
    .notNull()
    .references(() => biographerProjects.id, { onDelete: 'cascade' }),
  participantId: uuid('participant_id')
    .notNull()
    .references(() => biographerParticipants.id, { onDelete: 'cascade' }),
  objectPath: text('object_path').notNull(),
  contentType: text('content_type').notNull(),
  caption: text('caption').notNull().default(''),
  included: boolean('included').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

/** Immutable source revision associated with one generated story. */
export const biographerBookVersions = pgTable(
  'biographer_book_versions',
  {
    storyId: uuid('story_id')
      .primaryKey()
      .references(() => stories.storyId, { onDelete: 'cascade' }),
    projectId: uuid('project_id')
      .notNull()
      .references(() => biographerProjects.id, { onDelete: 'cascade' }),
    revision: integer('revision').notNull(),
    snapshot: jsonb('snapshot').$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex('biographer_book_versions_revision_unique').on(t.projectId, t.revision)],
);
