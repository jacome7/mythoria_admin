import { pgTable, uuid, varchar, integer, timestamp, boolean, jsonb, index } from 'drizzle-orm/pg-core';
import { authors } from './authors';

// -----------------------------------------------------------------------------
// Promotion / Voucher Codes (Partner now, future referral & book QR)
// -----------------------------------------------------------------------------

// Keep implementation intentionally simple (as per requirements) – no counters, no complex status transitions.
// We rely on redemption counting queries; if performance becomes an issue we can add cached counters later.

export const promotionCodes = pgTable('promotion_codes', {
  promotionCodeId: uuid('promotion_code_id').primaryKey().defaultRandom(),
  code: varchar('code', { length: 64 }).notNull().unique(), // Stored uppercase
  // Basic categorization – future proof but minimal for now
  type: varchar('type', { length: 20 }).notNull().default('partner'), // 'partner' | 'referral' | 'book_qr'
  creditAmount: integer('credit_amount').notNull(),
  maxGlobalRedemptions: integer('max_global_redemptions'), // null => unlimited
  maxRedemptionsPerUser: integer('max_redemptions_per_user').notNull().default(1),
  validFrom: timestamp('valid_from', { withTimezone: true }),
  validUntil: timestamp('valid_until', { withTimezone: true }),
  // Referral linking (null for partner codes phase 1)
  referrerAuthorId: uuid('referrer_author_id').references(() => authors.authorId, { onDelete: 'set null' }),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  active: boolean('active').notNull().default(true),
});

export const promotionCodeRedemptions = pgTable('promotion_code_redemptions', {
  promotionCodeRedemptionId: uuid('promotion_code_redemption_id').primaryKey().defaultRandom(),
  promotionCodeId: uuid('promotion_code_id').notNull().references(() => promotionCodes.promotionCodeId, { onDelete: 'cascade' }),
  authorId: uuid('author_id').notNull().references(() => authors.authorId, { onDelete: 'cascade' }),
  redeemedAt: timestamp('redeemed_at', { withTimezone: true }).defaultNow().notNull(),
  creditsGranted: integer('credits_granted').notNull(),
  creditLedgerEntryId: uuid('credit_ledger_entry_id'), // Optional FK to credit_ledger.id (not enforced to keep decoupled)
}, (table) => ({
  promotionCodeIdx: index('promotion_code_redemptions_code_idx').on(table.promotionCodeId),
  authorIdx: index('promotion_code_redemptions_author_idx').on(table.authorId),
}));

// Types
export type PromotionCode = typeof promotionCodes.$inferSelect;
export type NewPromotionCode = typeof promotionCodes.$inferInsert;
export type PromotionCodeRedemption = typeof promotionCodeRedemptions.$inferSelect;
export type NewPromotionCodeRedemption = typeof promotionCodeRedemptions.$inferInsert;
