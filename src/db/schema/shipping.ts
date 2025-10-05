import { pgTable, uuid, varchar, timestamp } from 'drizzle-orm/pg-core';
import { stories } from './stories';
import { addresses } from './authors';

// -----------------------------------------------------------------------------
// Shipping domain
// -----------------------------------------------------------------------------

// Shipping codes (printed orders)
export const shippingCodes = pgTable('shipping_codes', {
  shippingCodeId: uuid('shipping_code_id').primaryKey().defaultRandom(),
  storyId: uuid('story_id')
    .notNull()
    .references(() => stories.storyId, { onDelete: 'cascade' }),
  addressId: uuid('address_id')
    .notNull()
    .references(() => addresses.addressId, { onDelete: 'cascade' }),
  carrier: varchar('carrier', { length: 120 }),
  trackingCode: varchar('tracking_code', { length: 120 }).notNull(),
  shippedAt: timestamp('shipped_at', { withTimezone: true }),
  deliveredAt: timestamp('delivered_at', { withTimezone: true }),
});

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------
export type ShippingCode = typeof shippingCodes.$inferSelect;
export type NewShippingCode = typeof shippingCodes.$inferInsert;
