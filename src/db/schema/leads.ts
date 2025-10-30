import { pgTable, uuid, varchar, timestamp, index, pgEnum } from 'drizzle-orm/pg-core';

// -----------------------------------------------------------------------------
// Email Marketing Leads domain
// -----------------------------------------------------------------------------

// Email status enum for lead tracking through the email marketing funnel
export const emailStatusEnum = pgEnum('email_status', [
  'ready',
  'sent',
  'open',
  'click',
  'soft_bounce',
  'hard_bounce',
  'unsub',
]);

// Leads table for email marketing campaigns
export const leads = pgTable(
  'leads',
  {
    // UUID v4 primary key - used in tracking URLs to avoid exposing PII
    id: uuid('id').primaryKey().defaultRandom(),

    // Contact information
    // Name preserved with original casing, optional
    name: varchar('name', { length: 255 }),

    // Email normalized to lowercase, unique
    // Normalization rules (applied during import):
    // - Always lowercase
    // - Remove "+tag" suffix (e.g., user+tag@domain.com -> user@domain.com)
    // - Remove dots in local part for Gmail/Googlemail only
    email: varchar('email', { length: 255 }).notNull().unique(),

    // Mobile phone - accepts any format, optional
    mobilePhone: varchar('mobile_phone', { length: 30 }),

    // Language code in format like 'pt-PT', 'en-US'
    // Not constrained to current locales to allow future expansion
    language: varchar('language', { length: 10 }).notNull(),

    // Email campaign tracking
    lastEmailSentAt: timestamp('last_email_sent_at', { withTimezone: true }),
    emailStatus: emailStatusEnum('email_status').notNull().default('ready'),
  },
  (table) => ({
    // Indexes for performance optimization
    // Unique constraint on email already creates an index
    emailIdx: index('leads_email_idx').on(table.email),
    emailStatusIdx: index('leads_email_status_idx').on(table.emailStatus),
    lastEmailSentAtIdx: index('leads_last_email_sent_at_idx').on(table.lastEmailSentAt),
    // Composite index for batch sending queries (status + sent_at)
    statusSentAtIdx: index('leads_status_sent_at_idx').on(table.emailStatus, table.lastEmailSentAt),
  }),
);

// Type exports for use in services
export type Lead = typeof leads.$inferSelect;
export type NewLead = typeof leads.$inferInsert;
