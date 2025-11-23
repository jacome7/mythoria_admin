import {
  pgTable,
  uuid,
  text,
  varchar,
  integer,
  boolean,
  timestamp,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// -----------------------------------------------------------------------------
// FAQ (Frequently Asked Questions) domain
// -----------------------------------------------------------------------------

/**
 * FAQ Sections - Defines logical categories for grouping FAQ entries
 * Examples: "Pricing & Credits", "Story Creation", "Technical Support"
 */
export const faqSections = pgTable(
  'faq_sections',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    sectionKey: text('section_key').notNull().unique(),
    defaultLabel: text('default_label').notNull(),
    description: text('description'),
    iconName: text('icon_name'),
    sortOrder: integer('sort_order').notNull().default(0),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (table) => ({
    sectionKeyIdx: uniqueIndex('faq_sections_section_key_idx').on(table.sectionKey),
    sortOrderIdx: index('faq_sections_sort_order_idx').on(table.sortOrder),
    isActiveIdx: index('faq_sections_is_active_idx').on(table.isActive),
  }),
);

/**
 * FAQ Entries - Stores individual FAQ questions and answers with localization
 * One row per FAQ per locale (e.g., same faq_key can have en-US, pt-PT, es-ES versions)
 */
export const faqEntries = pgTable(
  'faq_entries',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    sectionId: uuid('section_id')
      .notNull()
      .references(() => faqSections.id, { onDelete: 'cascade' }),
    faqKey: text('faq_key').notNull(),
    locale: varchar('locale', { length: 10 }).notNull(),
    title: text('title').notNull(),
    contentMdx: text('content_mdx').notNull(),
    questionSortOrder: integer('question_sort_order').notNull().default(0),
    isPublished: boolean('is_published').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (table) => ({
    // Unique constraint: only one FAQ per key per locale
    faqKeyLocaleIdx: uniqueIndex('faq_entries_faq_key_locale_idx').on(table.faqKey, table.locale),
    // Composite index for fast section queries by locale
    localeSectionSortIdx: index('faq_entries_locale_section_sort_idx').on(
      table.locale,
      table.sectionId,
      table.questionSortOrder,
    ),
    // Individual indexes for filtering
    sectionIdIdx: index('faq_entries_section_id_idx').on(table.sectionId),
    localeIdx: index('faq_entries_locale_idx').on(table.locale),
    faqKeyIdx: index('faq_entries_faq_key_idx').on(table.faqKey),
    isPublishedIdx: index('faq_entries_is_published_idx').on(table.isPublished),
    // Full-text search indexes (PostgreSQL native)
    titleSearchIdx: index('faq_entries_title_search_idx').using(
      'gin',
      sql`to_tsvector('english', ${table.title})`,
    ),
    contentSearchIdx: index('faq_entries_content_search_idx').using(
      'gin',
      sql`to_tsvector('english', ${table.contentMdx})`,
    ),
  }),
);

// Export types for type-safe queries
export type FaqSection = typeof faqSections.$inferSelect;
export type InsertFaqSection = typeof faqSections.$inferInsert;
export type FaqEntry = typeof faqEntries.$inferSelect;
export type InsertFaqEntry = typeof faqEntries.$inferInsert;
