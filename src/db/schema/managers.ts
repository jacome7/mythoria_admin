import { pgTable, uuid, varchar, timestamp } from 'drizzle-orm/pg-core';

// -----------------------------------------------------------------------------
// Managers domain (backoffice_db)
// -----------------------------------------------------------------------------

// Admin managers who can access the admin portal
export const managers = pgTable('managers', {
  managerId: uuid('manager_id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 120 }).notNull(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  mobilePhone: varchar('mobile_phone', { length: 30 }),
  role: varchar('role', { length: 100 }), // Initially empty, can be expanded later
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------
export type Manager = typeof managers.$inferSelect;
export type NewManager = typeof managers.$inferInsert;
