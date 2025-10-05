import {
  pgTable,
  serial,
  varchar,
  text,
  timestamp,
  pgEnum,
  jsonb,
  uuid,
  boolean,
  index,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// -----------------------------------------------------------------------------
// Ticket enums
// -----------------------------------------------------------------------------
export const ticketStatusEnum = pgEnum('ticket_status', [
  'open',
  'in_progress',
  'resolved',
  'closed',
]);
export const ticketPriorityEnum = pgEnum('ticket_priority', ['low', 'medium', 'high']);

// -----------------------------------------------------------------------------
// Tickets table
// -----------------------------------------------------------------------------
export const tickets = pgTable(
  'tickets',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id'), // nullable for anonymous requests
    category: varchar('category', { length: 50 }).notNull(), // 'contact', 'print_request', 'payment_request'
    subject: varchar('subject', { length: 255 }).notNull(),
    description: text('description').notNull(),
    status: ticketStatusEnum('status').default('open').notNull(),
    priority: ticketPriorityEnum('priority').default('medium').notNull(),
    metadata: jsonb('metadata'), // store request-specific data
    createdAt: timestamp('created_at', { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  },
  (table) => ({
    statusIdx: index('idx_tickets_status').on(table.status),
    categoryIdx: index('idx_tickets_category').on(table.category),
    createdAtIdx: index('idx_tickets_created_at').on(table.createdAt),
  }),
);

// -----------------------------------------------------------------------------
// Ticket comments table
// -----------------------------------------------------------------------------
export const ticketComments = pgTable(
  'ticket_comments',
  {
    id: serial('id').primaryKey(),
    ticketId: uuid('ticket_id')
      .references(() => tickets.id, { onDelete: 'cascade' })
      .notNull(),
    authorId: uuid('author_id'), // admin who commented
    body: text('body').notNull(),
    isInternal: boolean('is_internal').default(false).notNull(), // internal notes vs customer-visible
    createdAt: timestamp('created_at', { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
  },
  (table) => ({
    ticketIdIdx: index('idx_ticket_comments_ticket_id').on(table.ticketId),
  }),
);

// -----------------------------------------------------------------------------
// Ticket notification config table
// -----------------------------------------------------------------------------
export const ticketNotificationConfig = pgTable('ticket_notification_config', {
  id: serial('id').primaryKey(),
  category: varchar('category', { length: 50 }).notNull(),
  ticketEvent: varchar('ticket_event', { length: 50 }).notNull(), // 'created', 'resolved', 'closed'
  sendToCustomer: boolean('send_to_customer').default(true).notNull(),
  emailTemplate: varchar('email_template', { length: 100 }).notNull(),
  enabled: boolean('enabled').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .default(sql`now()`)
    .notNull(),
});

// -----------------------------------------------------------------------------
// Types for TypeScript
// -----------------------------------------------------------------------------
export type Ticket = typeof tickets.$inferSelect;
export type NewTicket = typeof tickets.$inferInsert;
export type TicketComment = typeof ticketComments.$inferSelect;
export type NewTicketComment = typeof ticketComments.$inferInsert;
export type TicketNotificationConfig = typeof ticketNotificationConfig.$inferSelect;
export type NewTicketNotificationConfig = typeof ticketNotificationConfig.$inferInsert;

// Ticket status enum values for TypeScript
export type TicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed';
export type TicketPriority = 'low' | 'medium' | 'high';
