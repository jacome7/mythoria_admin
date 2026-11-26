import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  numeric,
  integer,
  jsonb,
  text,
} from 'drizzle-orm/pg-core';

// Read-only mirrors of WebApp-owned mythoria_db tables. Admin must not migrate these.
export const printFulfillmentsRead = pgTable('print_fulfillments', {
  printRequestId: uuid('print_request_id').primaryKey(),
  ticketId: uuid('ticket_id'),
  provider: varchar('provider', { length: 12 }).notNull(),
  status: varchar('status', { length: 24 }).notNull(),
  copies: integer('copies').notNull(),
  vendor: jsonb('vendor'),
  emailVariables: jsonb('email_variables').notNull(),
  shippingSnapshot: jsonb('shipping_snapshot').notNull(),
  proof: jsonb('proof'),
  proofSentAt: timestamp('proof_sent_at', { withTimezone: true }),
  quote: jsonb('quote'),
  holdReason: text('hold_reason'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
});

export const printFulfillmentCostsRead = pgTable('print_fulfillment_costs', {
  printRequestId: uuid('print_request_id').primaryKey(),
  luluJobId: varchar('lulu_job_id').notNull(),
  jobCreatedAt: timestamp('job_created_at', { withTimezone: true }).notNull(),
  amountExclTax: numeric('amount_excl_tax').notNull(),
  currency: varchar('currency').notNull(),
  amountEur: numeric('amount_eur'),
});
