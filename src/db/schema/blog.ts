import { pgTable, uuid, varchar, text, timestamp, pgEnum } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// -----------------------------------------------------------------------------
// Blog schema (simple multilingual blog)
// -----------------------------------------------------------------------------

export const blogStatusEnum = pgEnum('blog_status', ['draft', 'published', 'archived']);

export const blogPosts = pgTable('blog_posts', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  slugBase: varchar('slug_base', { length: 140 }).notNull().unique(),
  status: blogStatusEnum('status').notNull().default('draft'),
  heroImageUrl: text('hero_image_url'),
  publishedAt: timestamp('published_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .default(sql`now()`),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .default(sql`now()`),
});

export const blogPostTranslations = pgTable('blog_post_translations', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  postId: uuid('post_id')
    .notNull()
    .references(() => blogPosts.id, { onDelete: 'cascade' }),
  locale: varchar('locale', { length: 10 }).notNull(),
  slug: varchar('slug', { length: 160 }).notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  summary: varchar('summary', { length: 1000 }).notNull(),
  contentMdx: text('content_mdx').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .default(sql`now()`),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .default(sql`now()`),
});
