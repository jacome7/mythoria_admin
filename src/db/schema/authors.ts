import { pgTable, uuid, varchar, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { addressTypeEnum } from './enums';

// -----------------------------------------------------------------------------
// Authors domain
// -----------------------------------------------------------------------------

// Authors (formerly users)
export const authors = pgTable("authors", {
  authorId: uuid("author_id").primaryKey().defaultRandom(),
  clerkUserId: varchar("clerk_user_id", { length: 255 }).notNull().unique(), // Clerk User ID
  displayName: varchar("display_name", { length: 120 }).notNull(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  fiscalNumber: varchar("fiscal_number", { length: 40 }),
  mobilePhone: varchar("mobile_phone", { length: 30 }),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  preferredLocale: varchar("preferred_locale", { length: 5 }).default('en'), // CHAR(5)
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  // Indexes for performance optimization - unique constraints already create indexes
  clerkUserIdIdx: index("authors_clerk_user_id_idx").on(table.clerkUserId),
  emailIdx: index("authors_email_idx").on(table.email),
  lastLoginAtIdx: index("authors_last_login_at_idx").on(table.lastLoginAt),
  createdAtIdx: index("authors_created_at_idx").on(table.createdAt),
}));

// Leads (email collection for app launch notifications)
export const leads = pgTable("leads", {
  leadId: uuid("lead_id").primaryKey().defaultRandom(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  notifiedAt: timestamp("notified_at", { withTimezone: true }), // Track when we notified them
});

// Addresses
export const addresses = pgTable("addresses", {
  addressId: uuid("address_id").primaryKey().defaultRandom(),
  authorId: uuid("author_id").notNull().references(() => authors.authorId, { onDelete: 'cascade' }),
  type: addressTypeEnum("type").notNull(),
  line1: varchar("line1", { length: 255 }).notNull(),
  line2: varchar("line2", { length: 255 }),
  city: varchar("city", { length: 120 }).notNull(),
  stateRegion: varchar("state_region", { length: 120 }),
  postalCode: varchar("postal_code", { length: 20 }),
  country: varchar("country", { length: 2 }).notNull(), // CHAR(2)
  phone: varchar("phone", { length: 30 }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  // Indexes for performance optimization
  authorIdIdx: index("addresses_author_id_idx").on(table.authorId),
  typeIdx: index("addresses_type_idx").on(table.type),
}));

// Events
export const events = pgTable("events", {
  eventId: uuid("event_id").primaryKey().defaultRandom(),
  authorId: uuid("author_id").references(() => authors.authorId, { onDelete: 'set null' }), // Who performed the action
  eventType: varchar("event_type", { length: 100 }).notNull(), // e.g., 'story.created', 'user.login'
  payload: jsonb("payload"), // Event-specific data
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  // Indexes for performance optimization
  authorIdIdx: index("events_author_id_idx").on(table.authorId),
  eventTypeIdx: index("events_event_type_idx").on(table.eventType),
  createdAtIdx: index("events_created_at_idx").on(table.createdAt),
}));

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------
export type Author = typeof authors.$inferSelect;
export type NewAuthor = typeof authors.$inferInsert;

export type Address = typeof addresses.$inferSelect;
export type NewAddress = typeof addresses.$inferInsert;

export type Lead = typeof leads.$inferSelect;
export type NewLead = typeof leads.$inferInsert;

export type Event = typeof events.$inferSelect;
export type NewEvent = typeof events.$inferInsert;
