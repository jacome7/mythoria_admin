import { pgTable, uuid, timestamp, integer, index } from 'drizzle-orm/pg-core';
import { authors } from './authors';
import { creditEventTypeEnum } from './enums';

// -----------------------------------------------------------------------------
// Credits domain (imported from webapp schema for admin purposes)
// -----------------------------------------------------------------------------

// Credit Ledger - Insert only table for all credit operations
export const creditLedger = pgTable(
  'credit_ledger',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    authorId: uuid('author_id')
      .notNull()
      .references(() => authors.authorId, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    amount: integer('amount').notNull(), // Can be positive or negative
    creditEventType: creditEventTypeEnum('credit_event_type').notNull(),
    purchaseId: uuid('purchase_id'), // FK to purchases table (to be created later)
    storyId: uuid('story_id'), // Can be null - references stories.storyId but not enforced here to avoid circular deps
  },
  (table) => ({
    // Indexes for performance optimization
    authorIdIdx: index('credit_ledger_author_id_idx').on(table.authorId),
    authorIdCreatedAtIdx: index('credit_ledger_author_id_created_at_idx').on(
      table.authorId,
      table.createdAt,
    ),
    creditEventTypeIdx: index('credit_ledger_event_type_idx').on(table.creditEventType),
    createdAtIdx: index('credit_ledger_created_at_idx').on(table.createdAt),
    storyIdIdx: index('credit_ledger_story_id_idx').on(table.storyId),
  }),
);

// Materialized view for author credit balances
export const authorCreditBalances = pgTable('author_credit_balances', {
  authorId: uuid('author_id')
    .primaryKey()
    .references(() => authors.authorId, { onDelete: 'cascade' }),
  totalCredits: integer('total_credits').notNull().default(0),
  lastUpdated: timestamp('last_updated', { withTimezone: true }).defaultNow().notNull(),
});

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------
export type CreditLedgerEntry = typeof creditLedger.$inferSelect;
export type NewCreditLedgerEntry = typeof creditLedger.$inferInsert;

export type AuthorCreditBalance = typeof authorCreditBalances.$inferSelect;
export type NewAuthorCreditBalance = typeof authorCreditBalances.$inferInsert;
