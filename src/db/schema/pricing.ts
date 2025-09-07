import { pgTable, uuid, varchar, integer, boolean, timestamp } from "drizzle-orm/pg-core";

// -----------------------------------------------------------------------------
// Pricing domain
// -----------------------------------------------------------------------------

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
export type Pricing = typeof pricing.$inferSelect;
export type NewPricing = typeof pricing.$inferInsert;
