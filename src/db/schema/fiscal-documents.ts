import {
  decimal,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

import { authors } from './authors';
import { paymentOrders } from './payments';
import {
  fiscalDocumentCustomerModeEnum,
  fiscalDocumentProviderEnum,
  fiscalDocumentStatusEnum,
} from './enums';

export const keyInvoiceCustomers = pgTable(
  'keyinvoice_customers',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    authorId: uuid('author_id')
      .notNull()
      .references(() => authors.authorId, { onDelete: 'cascade' }),
    vatin: varchar('vatin', { length: 40 }).notNull(),
    keyInvoiceClientId: varchar('keyinvoice_client_id', { length: 80 }).notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    email: varchar('email', { length: 255 }),
    phone: varchar('phone', { length: 40 }),
    countryCode: varchar('country_code', { length: 2 }),
    address: text('address'),
    postalCode: varchar('postal_code', { length: 40 }),
    locality: varchar('locality', { length: 120 }),
    lastSyncedAt: timestamp('last_synced_at', { withTimezone: true }).defaultNow().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    authorIdIdx: index('keyinvoice_customers_author_id_idx').on(table.authorId),
    vatinIdx: uniqueIndex('keyinvoice_customers_vatin_idx').on(table.vatin),
    keyInvoiceClientIdIdx: uniqueIndex('keyinvoice_customers_client_id_idx').on(
      table.keyInvoiceClientId,
    ),
  }),
);

export const fiscalDocuments = pgTable(
  'fiscal_documents',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orderId: uuid('order_id')
      .notNull()
      .references(() => paymentOrders.orderId, { onDelete: 'cascade' }),
    authorId: uuid('author_id')
      .notNull()
      .references(() => authors.authorId, { onDelete: 'cascade' }),
    provider: fiscalDocumentProviderEnum('provider').notNull().default('keyinvoice'),
    status: fiscalDocumentStatusEnum('status').notNull().default('pending'),
    docType: varchar('doc_type', { length: 20 }).notNull(),
    docSeries: varchar('doc_series', { length: 80 }),
    docNum: varchar('doc_num', { length: 80 }),
    fullDocNumber: varchar('full_doc_number', { length: 160 }),
    atDocCodeId: varchar('at_doc_code_id', { length: 255 }),
    grossTotal: decimal('gross_total', { precision: 12, scale: 2 }),
    netTotal: decimal('net_total', { precision: 12, scale: 2 }),
    taxTotal: decimal('tax_total', { precision: 12, scale: 2 }),
    vatRate: decimal('vat_rate', { precision: 5, scale: 2 }),
    taxId: varchar('tax_id', { length: 80 }),
    customerMode: fiscalDocumentCustomerModeEnum('customer_mode').notNull(),
    keyInvoiceCustomerId: uuid('keyinvoice_customer_id').references(() => keyInvoiceCustomers.id, {
      onDelete: 'set null',
    }),
    keyInvoiceClientId: varchar('keyinvoice_client_id', { length: 80 }),
    finalConsumerVatNumber: varchar('final_consumer_vat_number', { length: 20 }),
    stripeCheckoutSessionId: varchar('stripe_checkout_session_id', { length: 255 }),
    stripePaymentIntentId: varchar('stripe_payment_intent_id', { length: 255 }),
    pdfStoragePath: varchar('pdf_storage_path', { length: 500 }),
    pdfSha256: varchar('pdf_sha256', { length: 64 }),
    lastError: text('last_error'),
    attemptCount: integer('attempt_count').notNull().default(0),
    nextRetryAt: timestamp('next_retry_at', { withTimezone: true }),
    issuedAt: timestamp('issued_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    orderIdIdx: uniqueIndex('fiscal_documents_order_id_idx').on(table.orderId),
    authorIdIdx: index('fiscal_documents_author_id_idx').on(table.authorId),
    statusIdx: index('fiscal_documents_status_idx').on(table.status),
    nextRetryAtIdx: index('fiscal_documents_next_retry_at_idx').on(table.nextRetryAt),
    docIdentityIdx: index('fiscal_documents_keyinvoice_doc_idx').on(
      table.docType,
      table.docSeries,
      table.docNum,
    ),
  }),
);

export const fiscalDocumentEvents = pgTable(
  'fiscal_document_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    fiscalDocumentId: uuid('fiscal_document_id').references(() => fiscalDocuments.id, {
      onDelete: 'cascade',
    }),
    orderId: uuid('order_id')
      .notNull()
      .references(() => paymentOrders.orderId, { onDelete: 'cascade' }),
    eventType: varchar('event_type', { length: 100 }).notNull(),
    requestPayload: jsonb('request_payload'),
    responsePayload: jsonb('response_payload'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
  },
  (table) => ({
    fiscalDocumentIdIdx: index('fiscal_document_events_document_id_idx').on(table.fiscalDocumentId),
    orderIdIdx: index('fiscal_document_events_order_id_idx').on(table.orderId),
    eventTypeIdx: index('fiscal_document_events_event_type_idx').on(table.eventType),
    createdAtIdx: index('fiscal_document_events_created_at_idx').on(table.createdAt),
  }),
);

export type KeyInvoiceCustomer = typeof keyInvoiceCustomers.$inferSelect;
export type NewKeyInvoiceCustomer = typeof keyInvoiceCustomers.$inferInsert;

export type FiscalDocument = typeof fiscalDocuments.$inferSelect;
export type NewFiscalDocument = typeof fiscalDocuments.$inferInsert;

export type FiscalDocumentEvent = typeof fiscalDocumentEvents.$inferSelect;
export type NewFiscalDocumentEvent = typeof fiscalDocumentEvents.$inferInsert;
