import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  jsonb,
  boolean,
  integer,
  index,
} from 'drizzle-orm/pg-core';
import { authors } from './authors';
import { paymentProviderEnum, paymentOrderStatusEnum, paymentEventTypeEnum } from './enums';

// -----------------------------------------------------------------------------
// Payments domain
// -----------------------------------------------------------------------------

// Payment methods
export const paymentMethods = pgTable(
  'payment_methods',
  {
    paymentMethodId: uuid('payment_method_id').primaryKey().defaultRandom(),
    authorId: uuid('author_id')
      .notNull()
      .references(() => authors.authorId, { onDelete: 'cascade' }),
    provider: paymentProviderEnum('provider').notNull(),
    providerRef: varchar('provider_ref', { length: 255 }).notNull(), // Stripe PM ID, PayPal token, etc.
    brand: varchar('brand', { length: 60 }), // "Visa", "Mastercard", …
    last4: varchar('last4', { length: 4 }), // CHAR(4)
    expMonth: integer('exp_month'),
    expYear: integer('exp_year'),
    billingDetails: jsonb('billing_details'),
    isDefault: boolean('is_default').default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    // Indexes for performance optimization
    authorIdIdx: index('payment_methods_author_id_idx').on(table.authorId),
    providerIdx: index('payment_methods_provider_idx').on(table.provider),
    isDefaultIdx: index('payment_methods_is_default_idx').on(table.isDefault),
  }),
);

// Credits
export const credits = pgTable('credits', {
  creditId: uuid('credit_id').primaryKey().defaultRandom(),
  authorId: uuid('author_id')
    .notNull()
    .references(() => authors.authorId, { onDelete: 'cascade' }),
  balance: integer('balance').notNull().default(0),
  lastUpdatedAt: timestamp('last_updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// Payments
export const payments = pgTable(
  'payments',
  {
    paymentId: uuid('payment_id').primaryKey().defaultRandom(),
    authorId: uuid('author_id')
      .notNull()
      .references(() => authors.authorId, { onDelete: 'cascade' }),
    paymentMethodId: uuid('payment_method_id').references(() => paymentMethods.paymentMethodId),
    shippingCodeId: uuid('shipping_code_id'), // Will reference shippingCodes.shippingCodeId - foreign key defined in relations
    amount: integer('amount').notNull(), // Assuming amount in cents
    currency: varchar('currency', { length: 3 }).notNull().default('usd'), // ISO currency code
    status: varchar('status', { length: 50 }).notNull(), // e.g., 'pending', 'succeeded', 'failed'
    providerPaymentId: varchar('provider_payment_id', { length: 255 }), // Stripe Payment Intent ID, etc.
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    // Indexes for performance optimization
    authorIdIdx: index('payments_author_id_idx').on(table.authorId),
    statusIdx: index('payments_status_idx').on(table.status),
    createdAtIdx: index('payments_created_at_idx').on(table.createdAt),
    authorIdCreatedAtIdx: index('payments_author_id_created_at_idx').on(
      table.authorId,
      table.createdAt,
    ),
  }),
);

// Payment Orders for Revolut Pay integration
export const paymentOrders = pgTable(
  'payment_orders',
  {
    orderId: uuid('order_id').primaryKey().defaultRandom(),
    authorId: uuid('author_id')
      .notNull()
      .references(() => authors.authorId, { onDelete: 'cascade' }),
    amount: integer('amount').notNull(), // Amount in cents
    currency: varchar('currency', { length: 3 }).notNull().default('eur'),
    status: paymentOrderStatusEnum('status').notNull().default('pending'),
    provider: paymentProviderEnum('provider').notNull(),
    providerOrderId: varchar('provider_order_id', { length: 255 }), // Revolut order ID
    providerPublicId: varchar('provider_public_id', { length: 255 }), // Revolut public ID for frontend
    creditBundle: jsonb('credit_bundle').notNull(), // { credits: number, price: number, bonusCredits?: number }
    metadata: jsonb('metadata'), // Additional data
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
  },
  (table) => ({
    authorIdIdx: index('payment_orders_author_id_idx').on(table.authorId),
    statusIdx: index('payment_orders_status_idx').on(table.status),
    providerOrderIdIdx: index('payment_orders_provider_order_id_idx').on(table.providerOrderId),
    createdAtIdx: index('payment_orders_created_at_idx').on(table.createdAt),
  }),
);

// Payment Events for audit trail
export const paymentEvents = pgTable(
  'payment_events',
  {
    eventId: uuid('event_id').primaryKey().defaultRandom(),
    orderId: uuid('order_id')
      .notNull()
      .references(() => paymentOrders.orderId, { onDelete: 'cascade' }),
    eventType: paymentEventTypeEnum('event_type').notNull(),
    data: jsonb('data'), // Event-specific data
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    orderIdIdx: index('payment_events_order_id_idx').on(table.orderId),
    eventTypeIdx: index('payment_events_event_type_idx').on(table.eventType),
    createdAtIdx: index('payment_events_created_at_idx').on(table.createdAt),
  }),
);

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------
export type PaymentMethod = typeof paymentMethods.$inferSelect;
export type NewPaymentMethod = typeof paymentMethods.$inferInsert;

export type Credit = typeof credits.$inferSelect;
export type NewCredit = typeof credits.$inferInsert;

export type Payment = typeof payments.$inferSelect;
export type NewPayment = typeof payments.$inferInsert;

export type PaymentOrder = typeof paymentOrders.$inferSelect;
export type NewPaymentOrder = typeof paymentOrders.$inferInsert;

export type PaymentEvent = typeof paymentEvents.$inferSelect;
export type NewPaymentEvent = typeof paymentEvents.$inferInsert;
