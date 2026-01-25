import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  text,
  jsonb,
  integer,
  primaryKey,
  boolean,
  index,
} from 'drizzle-orm/pg-core';
import { eq, isNotNull } from 'drizzle-orm';
import { authors } from './authors';
import {
  storyStatusEnum,
  runStatusEnum,
  targetAudienceEnum,
  novelStyleEnum,
  graphicalStyleEnum,
  literaryPersonaEnum,
  accessLevelEnum,
  collaboratorRoleEnum,
  audiobookStatusEnum,
} from './enums';

// -----------------------------------------------------------------------------
// Stories domain
// -----------------------------------------------------------------------------

// Stories
export const stories = pgTable(
  'stories',
  {
    storyId: uuid('story_id').primaryKey().defaultRandom(),
    authorId: uuid('author_id')
      .notNull()
      .references(() => authors.authorId, { onDelete: 'cascade' }),
    title: varchar('title', { length: 255 }).notNull(),
    plotDescription: text('plot_description'),
    storyLanguage: varchar('story_language', { length: 5 }).default('en-US').notNull(),
    synopsis: text('synopsis'),
    place: text('place'), // Setting of the story (real or imaginary)
    additionalRequests: text('additionalRequests'), // Optional text area for mentioning products, companies, or specific details to include.
    imageGenerationInstructions: text('image_generation_instructions'), // Custom instructions for AI image generation
    targetAudience: targetAudienceEnum('target_audience'),
    novelStyle: novelStyleEnum('novel_style'),
    graphicalStyle: graphicalStyleEnum('graphical_style'),
    literaryPersona: literaryPersonaEnum('literary_persona'),
    status: storyStatusEnum('status').default('draft'),
    features: jsonb('features'), // {"ebook":true,"printed":false,"audiobook":true}
    deliveryAddress: jsonb('delivery_address'), // Delivery address for printed books
    customAuthor: text('custom_author'), // Custom author name(s) for the story
    dedicationMessage: text('dedication_message'), // Personalized dedication message
    audiobookUri: jsonb('audiobook_uri'), // JSON object with internal GS links to each chapter audio file
    audiobookStatus: audiobookStatusEnum('audiobook_status'), // Status of audiobook generation
    coverUri: text('cover_uri'), // Internal Google Storage link to front cover image
    backcoverUri: text('backcover_uri'), // Internal Google Storage link to back cover image
    hasAudio: boolean('has_audio').default(false), // Whether story has audio narration
    interiorPdfUri: text('interior_pdf_uri'), // Internal Google Storage link to interior PDF for printing
    coverPdfUri: text('cover_pdf_uri'), // Internal Google Storage link to cover spread PDF for printing

    // Sharing functionality fields
    slug: text('slug'), // Human-readable slug for public URLs
    isPublic: boolean('is_public').default(false), // Whether story is publicly accessible
    isFeatured: boolean('is_featured').default(false), // Whether story is featured in gallery
    featureImageUri: text('feature_image_uri'), // URL for the featured story image
    chapterCount: integer('chapter_count').default(6).notNull(),
    // Story generation workflow convenience columns
    storyGenerationStatus: runStatusEnum('story_generation_status'),
    storyGenerationCompletedPercentage: integer('story_generation_completed_percentage').default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    // Indexes for performance optimization
    statusIdx: index('stories_status_idx').on(table.status),
    statusCreatedAtIdx: index('stories_status_created_at_idx').on(table.status, table.createdAt),
    authorIdUpdatedAtIdx: index('stories_author_id_updated_at_idx').on(
      table.authorId,
      table.updatedAt,
    ),
    authorIdCreatedAtIdx: index('stories_author_id_created_at_idx').on(
      table.authorId,
      table.createdAt,
    ),
    authorIdStatusIdx: index('stories_author_id_status_idx').on(table.authorId, table.status),
    isPublicIdx: index('stories_is_public_idx').on(table.isPublic).where(eq(table.isPublic, true)),
    isFeaturedIdx: index('stories_is_featured_idx')
      .on(table.isFeatured)
      .where(eq(table.isFeatured, true)),
    slugIdx: index('stories_slug_idx').on(table.slug).where(isNotNull(table.slug)),
  }),
);

// Story versions
export const storyVersions = pgTable('story_versions', {
  storyVersionId: uuid('story_version_id').primaryKey().defaultRandom(),
  storyId: uuid('story_id')
    .notNull()
    .references(() => stories.storyId, { onDelete: 'cascade' }),
  versionNumber: integer('version_number').notNull(),
  textJsonb: jsonb('text_jsonb').notNull(), // Store story content snapshot
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// Share links for private story access
export const shareLinks = pgTable(
  'share_links',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    storyId: uuid('story_id')
      .notNull()
      .references(() => stories.storyId, { onDelete: 'cascade' }),
    accessLevel: accessLevelEnum('access_level').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revoked: boolean('revoked').default(false).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    // Indexes for performance optimization
    storyIdIdx: index('share_links_story_id_idx').on(table.storyId),
    expiresAtIdx: index('share_links_expires_at_idx').on(table.expiresAt),
    revokedIdx: index('share_links_revoked_idx').on(table.revoked),
  }),
);

// Story collaborators for shared editing
export const storyCollaborators = pgTable(
  'story_collaborators',
  {
    storyId: uuid('story_id')
      .notNull()
      .references(() => stories.storyId, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => authors.authorId, { onDelete: 'cascade' }),
    role: collaboratorRoleEnum('role').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.storyId, table.userId] }),
    // Additional indexes for performance
    userIdIdx: index('story_collaborators_user_id_idx').on(table.userId),
  }),
);

// Story chapters with versioning support
export const chapters = pgTable(
  'chapters',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    storyId: uuid('story_id')
      .notNull()
      .references(() => stories.storyId, { onDelete: 'cascade' }),
    authorId: uuid('author_id')
      .notNull()
      .references(() => authors.authorId, { onDelete: 'cascade' }),
    version: integer('version').notNull(),
    chapterNumber: integer('chapter_number').notNull(),
    title: varchar('title', { length: 255 }).notNull(),
    imageUri: text('image_uri'), // Google Storage link to chapter image
    imageThumbnailUri: text('image_thumbnail_uri'), // Google Storage link to chapter thumbnail
    htmlContent: text('html_content').notNull(), // Full HTML content for the chapter
    audioUri: text('audio_uri'), // Google Storage link to audio narration
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    // Indexes for performance optimization
    idIdx: index('chapters_id_idx').on(table.id),
    storyIdIdx: index('chapters_story_id_idx').on(table.storyId),
    versionIdx: index('chapters_version_idx').on(table.version),
    chapterNumberIdx: index('chapters_chapter_number_idx').on(table.chapterNumber),
    // Composite indexes for frequent queries
    storyIdVersionIdx: index('chapters_story_id_version_idx').on(table.storyId, table.version),
    storyIdChapterNumberVersionIdx: index('chapters_story_id_chapter_number_version_idx').on(
      table.storyId,
      table.chapterNumber,
      table.version,
    ),
  }),
);

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------
export type Story = typeof stories.$inferSelect;
export type NewStory = typeof stories.$inferInsert;

export type StoryVersion = typeof storyVersions.$inferSelect;
export type NewStoryVersion = typeof storyVersions.$inferInsert;

export type ShareLink = typeof shareLinks.$inferSelect;
export type NewShareLink = typeof shareLinks.$inferInsert;

export type StoryCollaborator = typeof storyCollaborators.$inferSelect;
export type NewStoryCollaborator = typeof storyCollaborators.$inferInsert;

export type Chapter = typeof chapters.$inferSelect;
export type NewChapter = typeof chapters.$inferInsert;
