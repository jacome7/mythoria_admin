import { index, pgTable, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';

export const staffPrintDestinations = pgTable(
  'staff_print_destinations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ownerEmail: varchar('owner_email', { length: 255 }).notNull(),
    label: varchar('label', { length: 80 }).notNull(),
    name: varchar('recipient_name', { length: 120 }).notNull(),
    email: varchar('recipient_email', { length: 255 }).notNull(),
    phone_number: varchar('phone_number', { length: 30 }).notNull(),
    street1: varchar('street1', { length: 255 }).notNull(),
    street2: varchar('street2', { length: 255 }),
    city: varchar('city', { length: 120 }).notNull(),
    postcode: varchar('postcode', { length: 20 }).notNull(),
    state_code: varchar('state_code', { length: 120 }),
    country_code: varchar('country_code', { length: 2 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('staff_print_destinations_owner_label_unique').on(table.ownerEmail, table.label),
    index('staff_print_destinations_owner_created_idx').on(table.ownerEmail, table.createdAt),
  ],
);
