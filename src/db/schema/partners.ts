import {
  pgTable,
  uuid,
  text,
  varchar,
  integer,
  timestamp,
  jsonb,
  index,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { partnerServiceScopeEnum, partnerStatusEnum, partnerTypeEnum } from './enums';

// -----------------------------------------------------------------------------
// Partner directory domain
// -----------------------------------------------------------------------------

export const partners = pgTable(
  'partners',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    name: text('name').notNull(),
    type: partnerTypeEnum('type').notNull(),
    logoUrl: text('logo_url').notNull(),
    websiteUrl: text('website_url'),
    email: text('email'),
    mobilePhone: varchar('mobile_phone', { length: 30 }),
    addressLine1: text('address_line1'),
    addressLine2: text('address_line2'),
    city: text('city'),
    postalCode: text('postal_code'),
    countryCode: varchar('country_code', { length: 2 }),
    shortDescription: jsonb('short_description')
      .notNull()
      .default(sql`'{}'::jsonb`),
    serviceScope: partnerServiceScopeEnum('service_scope'),
    status: partnerStatusEnum('status').notNull().default('active'),
    displayOrder: integer('display_order'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (table) => ({
    statusIdx: index('partners_status_idx').on(table.status),
    typeIdx: index('partners_type_idx').on(table.type),
    countryIdx: index('partners_country_idx').on(table.countryCode),
    cityIdx: index('partners_city_idx').on(table.city),
    displayOrderIdx: index('partners_display_order_idx').on(table.displayOrder),
  }),
);

export type Partner = typeof partners.$inferSelect;
export type NewPartner = typeof partners.$inferInsert;
