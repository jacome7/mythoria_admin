import { pgTable, uuid, varchar, integer, boolean, timestamp, decimal } from 'drizzle-orm/pg-core';

// -----------------------------------------------------------------------------
// Credit Packages domain
// -----------------------------------------------------------------------------

export const creditPackages = pgTable('credit_packages', {
  id: uuid('id').primaryKey().defaultRandom(),
  credits: integer('credits').notNull(),
  price: decimal('price', { precision: 10, scale: 2 }).notNull(),
  popular: boolean('popular').notNull().default(false),
  bestValue: boolean('best_value').notNull().default(false),
  icon: varchar('icon', { length: 50 }).notNull().default('FaShoppingCart'),
  key: varchar('key', { length: 50 }).notNull().unique(),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------
export type CreditPackage = typeof creditPackages.$inferSelect;
export type NewCreditPackage = typeof creditPackages.$inferInsert;
