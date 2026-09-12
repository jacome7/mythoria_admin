import { sql } from 'drizzle-orm';
import {
  pgTable,
  uuid,
  varchar,
  integer,
  timestamp,
  boolean,
  text,
  jsonb,
  uniqueIndex,
  index,
  check,
} from 'drizzle-orm/pg-core';
import { authors } from './authors';
import { paymentOrders } from './payments';

const time = (name: string) => timestamp(name, { withTimezone: true });
export const referralOwners = pgTable(
  'referral_owners',
  {
    referralOwnerId: uuid('referral_owner_id').primaryKey().defaultRandom(),
    displayName: varchar('display_name', { length: 120 }).notNull(),
    legalName: varchar('legal_name', { length: 255 }),
    contactEmailNormalized: varchar('contact_email_normalized', { length: 255 }).notNull(),
    countryCode: varchar('country_code', { length: 2 }),
    preferredLocale: varchar('preferred_locale', { length: 5 }).notNull(),
    status: varchar('status', { length: 20 }).notNull().default('active'),
    createdByActorType: varchar('created_by_actor_type', { length: 20 }).notNull(),
    createdByActorId: varchar('created_by_actor_id', { length: 255 }).notNull(),
    createdAt: time('created_at').notNull().defaultNow(),
    updatedAt: time('updated_at').notNull().defaultNow(),
    suspendedAt: time('suspended_at'),
    closedAt: time('closed_at'),
    legalHoldUntil: time('legal_hold_until'),
  },
  (t) => [
    check('referral_owner_status_check', sql`${t.status} in ('active','suspended','closed')`),
  ],
);

export const referralMemberships = pgTable(
  'referral_owner_memberships',
  {
    membershipId: uuid('membership_id').primaryKey().defaultRandom(),
    referralOwnerId: uuid('referral_owner_id')
      .notNull()
      .references(() => referralOwners.referralOwnerId, { onDelete: 'restrict' }),
    emailNormalized: varchar('email_normalized', { length: 255 }).notNull(),
    clerkUserId: varchar('clerk_user_id', { length: 255 }),
    role: varchar('role', { length: 20 }).notNull().default('owner'),
    status: varchar('status', { length: 20 }).notNull().default('invited'),
    invitedAt: time('invited_at').notNull().defaultNow(),
    activatedAt: time('activated_at'),
    lastLoginAt: time('last_login_at'),
    createdAt: time('created_at').notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('referral_membership_email_unique').on(t.referralOwnerId, t.emailNormalized),
    uniqueIndex('referral_membership_clerk_unique')
      .on(t.referralOwnerId, t.clerkUserId)
      .where(sql`${t.clerkUserId} is not null`),
    check('referral_membership_status_check', sql`${t.status} in ('invited','active','suspended')`),
    check('referral_membership_role_check', sql`${t.role} in ('owner','viewer')`),
  ],
);

export const referralCodes = pgTable(
  'referral_codes',
  {
    referralCodeId: uuid('referral_code_id').primaryKey().defaultRandom(),
    referralOwnerId: uuid('referral_owner_id')
      .notNull()
      .unique()
      .references(() => referralOwners.referralOwnerId, { onDelete: 'restrict' }),
    code: varchar('code', { length: 32 }).notNull().unique(),
    active: boolean('active').notNull().default(true),
    validFrom: time('valid_from'),
    validUntil: time('valid_until'),
    firstVisitedAt: time('first_visited_at'),
    createdAt: time('created_at').notNull().defaultNow(),
    updatedAt: time('updated_at').notNull().defaultNow(),
  },
  (t) => [check('referral_code_format_check', sql`${t.code} ~ '^[A-Z0-9][A-Z0-9_-]{4,31}$'`)],
);

export const referralTerms = pgTable(
  'referral_terms_versions',
  {
    termsVersionId: uuid('terms_version_id').primaryKey().defaultRandom(),
    referralOwnerId: uuid('referral_owner_id')
      .notNull()
      .references(() => referralOwners.referralOwnerId, { onDelete: 'restrict' }),
    commissionRateBps: integer('commission_rate_bps').notNull(),
    effectiveFrom: time('effective_from').notNull(),
    effectiveUntil: time('effective_until'),
    programPolicyVersion: varchar('program_policy_version', { length: 50 }).notNull(),
    createdByActorType: varchar('created_by_actor_type', { length: 20 }).notNull(),
    createdByActorId: varchar('created_by_actor_id', { length: 255 }).notNull(),
    reason: text('reason'),
    createdAt: time('created_at').notNull().defaultNow(),
  },
  (t) => [
    check('referral_rate_check', sql`${t.commissionRateBps} between 0 and 10000`),
    check(
      'referral_terms_period_check',
      sql`${t.effectiveUntil} is null or ${t.effectiveUntil} > ${t.effectiveFrom}`,
    ),
  ],
);

export const referralVisits = pgTable(
  'referral_visits',
  {
    referralVisitId: uuid('referral_visit_id').primaryKey().defaultRandom(),
    anonymousVisitorId: uuid('anonymous_visitor_id').notNull(),
    referralCodeId: uuid('referral_code_id')
      .notNull()
      .references(() => referralCodes.referralCodeId, { onDelete: 'restrict' }),
    landingPath: varchar('landing_path', { length: 500 }),
    locale: varchar('locale', { length: 5 }),
    referrerHostname: varchar('referrer_hostname', { length: 255 }),
    utmSource: varchar('utm_source', { length: 100 }),
    utmMedium: varchar('utm_medium', { length: 100 }),
    utmCampaign: varchar('utm_campaign', { length: 100 }),
    visitedAt: time('visited_at').notNull().defaultNow(),
    expiresAt: time('expires_at').notNull(),
    linkedAuthorId: uuid('linked_author_id').references(() => authors.authorId, {
      onDelete: 'set null',
    }),
    linkedAt: time('linked_at'),
  },
  (t) => [index('referral_visits_code_time_idx').on(t.referralCodeId, t.visitedAt)],
);

export const referralAssignments = pgTable(
  'author_referral_assignments',
  {
    assignmentId: uuid('assignment_id').primaryKey().defaultRandom(),
    authorId: uuid('author_id').references(() => authors.authorId, { onDelete: 'set null' }),
    referralCodeId: uuid('referral_code_id')
      .notNull()
      .references(() => referralCodes.referralCodeId, { onDelete: 'restrict' }),
    sourceVisitId: uuid('source_visit_id').references(() => referralVisits.referralVisitId, {
      onDelete: 'set null',
    }),
    source: varchar('source', { length: 20 }).notNull(),
    activatedAt: time('activated_at').notNull().defaultNow(),
    endedAt: time('ended_at'),
    endedReason: varchar('ended_reason', { length: 40 }),
    changedByActorType: varchar('changed_by_actor_type', { length: 20 }).notNull(),
    changedByActorId: varchar('changed_by_actor_id', { length: 255 }),
    createdAt: time('created_at').notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('referral_assignment_active_unique')
      .on(t.authorId)
      .where(sql`${t.endedAt} is null`),
  ],
);

export const referralSnapshots = pgTable('payment_order_referral_snapshots', {
  paymentOrderId: uuid('payment_order_id')
    .primaryKey()
    .references(() => paymentOrders.orderId, { onDelete: 'restrict' }),
  assignmentId: uuid('assignment_id')
    .notNull()
    .references(() => referralAssignments.assignmentId, { onDelete: 'restrict' }),
  referralCodeId: uuid('referral_code_id')
    .notNull()
    .references(() => referralCodes.referralCodeId, { onDelete: 'restrict' }),
  referralOwnerId: uuid('referral_owner_id')
    .notNull()
    .references(() => referralOwners.referralOwnerId, { onDelete: 'restrict' }),
  termsVersionId: uuid('terms_version_id')
    .notNull()
    .references(() => referralTerms.termsVersionId, { onDelete: 'restrict' }),
  codeSnapshot: varchar('code_snapshot', { length: 32 }).notNull(),
  commissionRateBps: integer('commission_rate_bps').notNull(),
  attributionStartedAt: time('attribution_started_at').notNull(),
  capturedAt: time('captured_at').notNull().defaultNow(),
  mode: varchar('mode', { length: 10 }).notNull(),
  customerReference: uuid('customer_reference').notNull(),
  purchaseKind: varchar('purchase_kind', { length: 10 }).notNull(),
  locale: varchar('locale', { length: 5 }),
  country: varchar('country', { length: 2 }),
});

export const referralCustomers = pgTable(
  'referral_customer_references',
  {
    customerReference: uuid('customer_reference').primaryKey().defaultRandom(),
    referralOwnerId: uuid('referral_owner_id')
      .notNull()
      .references(() => referralOwners.referralOwnerId, { onDelete: 'restrict' }),
    authorId: uuid('author_id').references(() => authors.authorId, { onDelete: 'set null' }),
  },
  (t) => [uniqueIndex('referral_customer_owner_unique').on(t.referralOwnerId, t.authorId)],
);

export const referralCommissions = pgTable(
  'referral_commissions',
  {
    commissionId: uuid('commission_id').primaryKey().defaultRandom(),
    paymentOrderId: uuid('payment_order_id')
      .notNull()
      .unique()
      .references(() => referralSnapshots.paymentOrderId, { onDelete: 'restrict' }),
    referralOwnerId: uuid('referral_owner_id')
      .notNull()
      .references(() => referralOwners.referralOwnerId, { onDelete: 'restrict' }),
    customerAuthorId: uuid('customer_author_id').references(() => authors.authorId, {
      onDelete: 'set null',
    }),
    customerReference: uuid('customer_reference').notNull(),
    mode: varchar('mode', { length: 10 }).notNull(),
    purchaseKind: varchar('purchase_kind', { length: 10 }).notNull().default('first'),
    currency: varchar('currency', { length: 3 }).notNull().default('EUR'),
    grossAmountCents: integer('gross_amount_cents'),
    commissionBasisCents: integer('commission_basis_cents'),
    commissionRateBps: integer('commission_rate_bps').notNull(),
    originalCommissionCents: integer('original_commission_cents'),
    netCommissionCents: integer('net_commission_cents').notNull().default(0),
    status: varchar('status', { length: 20 }).notNull().default('blocked'),
    refundedGrossCents: integer('refunded_gross_cents').notNull().default(0),
    disputedGrossCents: integer('disputed_gross_cents').notNull().default(0),
    reversedCents: integer('reversed_cents').notNull().default(0),
    reviewReason: text('review_reason'),
    disputeOpen: boolean('dispute_open').notNull().default(false),
    reconciledAt: time('reconciled_at'),
    holdUntil: time('hold_until').notNull(),
    createdAt: time('created_at').notNull().defaultNow(),
    approvedAt: time('approved_at'),
    payableAt: time('payable_at'),
    paidAt: time('paid_at'),
  },
  (t) => [
    index('referral_commissions_owner_idx').on(t.referralOwnerId, t.createdAt),
    check(
      'referral_commission_status_check',
      sql`${t.status} in ('blocked','pending','approved','payable','paid','cancelled','reversed')`,
    ),
    check('referral_commission_mode_check', sql`${t.mode} in ('shadow','live')`),
  ],
);

export const referralSettlements = pgTable(
  'referral_settlements',
  {
    settlementId: uuid('settlement_id').primaryKey().defaultRandom(),
    referralOwnerId: uuid('referral_owner_id')
      .notNull()
      .references(() => referralOwners.referralOwnerId, { onDelete: 'restrict' }),
    currency: varchar('currency', { length: 3 }).notNull().default('EUR'),
    periodStart: time('period_start').notNull(),
    periodEnd: time('period_end').notNull(),
    grossCommissionCents: integer('gross_commission_cents').notNull(),
    adjustmentsCents: integer('adjustments_cents').notNull(),
    netPaymentCents: integer('net_payment_cents').notNull(),
    status: varchar('status', { length: 20 }).notNull().default('payable'),
    externalPaymentReference: varchar('external_payment_reference', { length: 255 }),
    createdBy: varchar('created_by', { length: 255 }).notNull(),
    createdAt: time('created_at').notNull().defaultNow(),
    paidAt: time('paid_at'),
    cancelledReason: text('cancelled_reason'),
  },
  (t) => [
    uniqueIndex('referral_settlement_period_unique')
      .on(t.referralOwnerId, t.periodEnd)
      .where(sql`${t.status} <> 'cancelled'`),
  ],
);

export const referralCommissionEvents = pgTable('referral_commission_events', {
  commissionEventId: uuid('commission_event_id').primaryKey().defaultRandom(),
  commissionId: uuid('commission_id')
    .notNull()
    .references(() => referralCommissions.commissionId, { onDelete: 'restrict' }),
  eventType: varchar('event_type', { length: 40 }).notNull(),
  signedAmountCents: integer('signed_amount_cents').notNull(),
  idempotencyKey: varchar('idempotency_key', { length: 255 }).notNull().unique(),
  providerEventId: varchar('provider_event_id', { length: 255 }),
  providerObjectId: varchar('provider_object_id', { length: 255 }),
  settlementId: uuid('settlement_id').references(() => referralSettlements.settlementId, {
    onDelete: 'restrict',
  }),
  previousStatus: varchar('previous_status', { length: 20 }),
  newStatus: varchar('new_status', { length: 20 }),
  actorType: varchar('actor_type', { length: 20 }).notNull(),
  actorId: varchar('actor_id', { length: 255 }),
  reason: text('reason'),
  occurredAt: time('occurred_at').notNull().defaultNow(),
  createdAt: time('created_at').notNull().defaultNow(),
});
export const referralSettlementItems = pgTable(
  'referral_settlement_items',
  {
    settlementItemId: uuid('settlement_item_id').primaryKey().defaultRandom(),
    settlementId: uuid('settlement_id')
      .notNull()
      .references(() => referralSettlements.settlementId, { onDelete: 'restrict' }),
    commissionEventId: uuid('commission_event_id')
      .notNull()
      .references(() => referralCommissionEvents.commissionEventId, { onDelete: 'restrict' }),
    signedAmountCents: integer('signed_amount_cents').notNull(),
    releasedAt: time('released_at'),
  },
  (t) => [
    uniqueIndex('referral_settlement_item_unique').on(t.settlementId, t.commissionEventId),
    uniqueIndex('referral_event_allocation_unique')
      .on(t.commissionEventId)
      .where(sql`${t.releasedAt} is null`),
  ],
);

export const paymentProviderEvents = pgTable(
  'payment_provider_events',
  {
    paymentProviderEventId: uuid('payment_provider_event_id').primaryKey().defaultRandom(),
    provider: varchar('provider', { length: 20 }).notNull().default('stripe'),
    providerEventId: varchar('provider_event_id', { length: 255 }).notNull(),
    eventType: varchar('event_type', { length: 100 }).notNull(),
    providerObjectId: varchar('provider_object_id', { length: 255 }).notNull(),
    payloadHash: varchar('payload_hash', { length: 64 }).notNull(),
    processingStatus: varchar('processing_status', { length: 20 }).notNull().default('pending'),
    attempts: integer('attempts').notNull().default(0),
    leaseUntil: time('lease_until'),
    lastError: varchar('last_error', { length: 100 }),
    receivedAt: time('received_at').notNull().defaultNow(),
    processedAt: time('processed_at'),
  },
  (t) => [uniqueIndex('payment_provider_event_unique').on(t.provider, t.providerEventId)],
);

export const referralAuditEvents = pgTable('referral_audit_events', {
  auditId: uuid('audit_id').primaryKey().defaultRandom(),
  entityId: uuid('entity_id').notNull(),
  action: varchar('action', { length: 100 }).notNull(),
  actorType: varchar('actor_type', { length: 20 }).notNull(),
  actorId: varchar('actor_id', { length: 255 }).notNull(),
  reason: text('reason'),
  createdAt: time('created_at').notNull().defaultNow(),
});
export const referralOutbox = pgTable('referral_outbox', {
  outboxId: uuid('outbox_id').primaryKey().defaultRandom(),
  dedupeKey: varchar('dedupe_key', { length: 255 }).notNull().unique(),
  kind: varchar('kind', { length: 40 }).notNull(),
  payload: jsonb('payload').$type<Record<string, unknown>>().notNull(),
  status: varchar('status', { length: 20 }).notNull().default('pending'),
  attempts: integer('attempts').notNull().default(0),
  nextAttemptAt: time('next_attempt_at').notNull().defaultNow(),
  leaseUntil: time('lease_until'),
  completedAt: time('completed_at'),
  createdAt: time('created_at').notNull().defaultNow(),
});
export const referralFunnelEvents = pgTable('referral_funnel_events', {
  eventId: uuid('event_id').primaryKey().defaultRandom(),
  referralOwnerId: uuid('referral_owner_id')
    .notNull()
    .references(() => referralOwners.referralOwnerId, { onDelete: 'restrict' }),
  assignmentId: uuid('assignment_id')
    .notNull()
    .references(() => referralAssignments.assignmentId, { onDelete: 'restrict' }),
  customerReference: uuid('customer_reference').notNull(),
  eventType: varchar('event_type', { length: 40 }).notNull(),
  dedupeKey: varchar('dedupe_key', { length: 255 }).notNull().unique(),
  locale: varchar('locale', { length: 5 }),
  country: varchar('country', { length: 2 }),
  newAccount: boolean('new_account').notNull().default(false),
  occurredAt: time('occurred_at').notNull().defaultNow(),
});
export const referralReconciliations = pgTable('referral_reconciliations', {
  reconciliationId: uuid('reconciliation_id').primaryKey().defaultRandom(),
  periodStart: time('period_start').notNull(),
  periodEnd: time('period_end').notNull(),
  report: jsonb('report').$type<Record<string, unknown>>().notNull(),
  clean: boolean('clean').notNull(),
  createdAt: time('created_at').notNull().defaultNow(),
});
