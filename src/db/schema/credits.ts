import { pgTable, uuid, timestamp, integer, index, decimal, boolean, varchar } from "drizzle-orm/pg-core";
import { authors } from './authors';
import { creditEventTypeEnum } from './enums';

// -----------------------------------------------------------------------------
// Credits domain (imported from webapp schema for admin purposes)
// -----------------------------------------------------------------------------

// Credit Ledger - Insert only table for all credit operations
export const creditLedger = pgTable("credit_ledger", {
  id: uuid("id").primaryKey().defaultRandom(),
  authorId: uuid("author_id").notNull().references(() => authors.authorId, { onDelete: 'cascade' }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  amount: integer("amount").notNull(), // Can be positive or negative
  creditEventType: creditEventTypeEnum("credit_event_type").notNull(),
  purchaseId: uuid("purchase_id"), // FK to purchases table (to be created later)
  storyId: uuid("story_id"), // Can be null - references stories.storyId but not enforced here to avoid circular deps
}, (table) => ({
  // Indexes for performance optimization
  authorIdIdx: index("credit_ledger_author_id_idx").on(table.authorId),
  authorIdCreatedAtIdx: index("credit_ledger_author_id_created_at_idx").on(table.authorId, table.createdAt),
  creditEventTypeIdx: index("credit_ledger_event_type_idx").on(table.creditEventType),
  createdAtIdx: index("credit_ledger_created_at_idx").on(table.createdAt),
  storyIdIdx: index("credit_ledger_story_id_idx").on(table.storyId),
}));

// Materialized view for author credit balances
export const authorCreditBalances = pgTable("author_credit_balances", {
  authorId: uuid("author_id").primaryKey().references(() => authors.authorId, { onDelete: 'cascade' }),
  totalCredits: integer("total_credits").notNull().default(0),
  lastUpdated: timestamp("last_updated", { withTimezone: true }).defaultNow().notNull(),
});

// Credit Packages - Available credit bundles for purchase
export const creditPackages = pgTable("credit_packages", {
  id: uuid("id").primaryKey().defaultRandom(),
  credits: integer("credits").notNull(),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  popular: boolean("popular").notNull().default(false),
  bestValue: boolean("best_value").notNull().default(false),
  icon: varchar("icon", { length: 50 }).notNull().default("FaShoppingCart"),
  key: varchar("key", { length: 50 }).notNull().unique(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  // Indexes for performance optimization
  isActiveIdx: index("credit_packages_is_active_idx").on(table.isActive),
}));

// Pricing - Service pricing configuration (existing table)
export const pricing = pgTable("pricing", {
  id: uuid("id").primaryKey().defaultRandom(),
  serviceCode: varchar("service_code", { length: 50 }).notNull().unique(),
  credits: integer("credits").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------
export type CreditLedgerEntry = typeof creditLedger.$inferSelect;
export type NewCreditLedgerEntry = typeof creditLedger.$inferInsert;

export type AuthorCreditBalance = typeof authorCreditBalances.$inferSelect;
export type NewAuthorCreditBalance = typeof authorCreditBalances.$inferInsert;

export type CreditPackage = typeof creditPackages.$inferSelect;
export type NewCreditPackage = typeof creditPackages.$inferInsert;

export type PricingService = typeof pricing.$inferSelect;
export type NewPricingService = typeof pricing.$inferInsert;
