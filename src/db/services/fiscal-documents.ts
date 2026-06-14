import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  inArray,
  isNotNull,
  like,
  lte,
  or,
  sql,
} from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import { getMythoriaDb } from '@/db';
import {
  authors,
  fiscalDocumentEvents,
  fiscalDocuments,
  keyInvoiceCustomers,
  paymentOrders,
} from '@/db/schema';
import {
  computeNeedsAttention,
  computeRetryableNow,
  type FiscalCustomerMode,
  type FiscalDocumentStatus,
} from '@/lib/fiscal-documents';

export type FiscalSort =
  | 'attention'
  | 'createdAt'
  | 'updatedAt'
  | 'attemptCount'
  | 'nextRetryAt'
  | 'issuedAt';

export interface FiscalDocumentListParams {
  page?: number;
  limit?: number;
  statuses?: FiscalDocumentStatus[];
  needsAttention?: boolean;
  hasError?: boolean;
  customerMode?: FiscalCustomerMode;
  provider?: 'keyinvoice';
  dateFrom?: Date;
  dateTo?: Date;
  q?: string;
  sort?: FiscalSort;
  sortOrder?: 'asc' | 'desc';
}

export interface FiscalDocumentPagination {
  page: number;
  limit: number;
  totalCount: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface FiscalDocumentSummary {
  id: string;
  orderId: string;
  authorId: string;
  provider: string;
  status: FiscalDocumentStatus;
  docType: string;
  docSeries: string | null;
  docNum: string | null;
  fullDocNumber: string | null;
  grossTotal: string | null;
  netTotal: string | null;
  taxTotal: string | null;
  vatRate: string | null;
  taxId: string | null;
  customerMode: FiscalCustomerMode;
  keyInvoiceClientId: string | null;
  finalConsumerVatNumber: string | null;
  stripeCheckoutSessionId: string | null;
  stripePaymentIntentId: string | null;
  pdfStoragePath: string | null;
  pdfSha256: string | null;
  lastError: string | null;
  attemptCount: number;
  nextRetryAt: Date | null;
  issuedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  needsAttention: boolean;
  retryableNow: boolean;
  attentionPriority: 'high' | 'warning' | 'none';
  paymentOrder: {
    orderId: string;
    amount: number;
    currency: string;
    status: string;
    provider: string;
    providerOrderId: string | null;
    providerPublicId: string | null;
    creditBundle: unknown;
    metadata: unknown;
    createdAt: Date;
    updatedAt: Date;
  } | null;
  author: {
    authorId: string;
    displayName: string;
    email: string;
    fiscalNumber: string | null;
  } | null;
  keyInvoiceCustomer: {
    id: string;
    vatin: string;
    keyInvoiceClientId: string;
    name: string;
    email: string | null;
    phone: string | null;
    countryCode: string | null;
    address: string | null;
    postalCode: string | null;
    locality: string | null;
  } | null;
}

export interface FiscalDocumentEventSummary {
  id: string;
  fiscalDocumentId: string | null;
  orderId: string;
  eventType: string;
  requestPayload: unknown;
  responsePayload: unknown;
  createdAt: Date;
}

export interface FiscalDocumentDetail extends FiscalDocumentSummary {
  events: FiscalDocumentEventSummary[];
}

export interface FiscalIssueCounts {
  failed: number;
  stalePending: number;
  staleIssuing: number;
  creditNoteRequired: number;
  total: number;
}

const ATTENTION_THRESHOLD_SQL = sql`now() - interval '15 minutes'`;

export const fiscalDocumentAdminService = {
  async list(params: FiscalDocumentListParams = {}): Promise<{
    data: FiscalDocumentSummary[];
    pagination: FiscalDocumentPagination;
  }> {
    const db = getMythoriaDb();
    const page = normalizePage(params.page);
    const limit = normalizeLimit(params.limit);
    const offset = (page - 1) * limit;
    const whereClause = buildWhereClause(params);

    const totalRows = await db
      .select({ value: count() })
      .from(fiscalDocuments)
      .leftJoin(paymentOrders, eq(fiscalDocuments.orderId, paymentOrders.orderId))
      .leftJoin(authors, eq(fiscalDocuments.authorId, authors.authorId))
      .leftJoin(
        keyInvoiceCustomers,
        eq(fiscalDocuments.keyInvoiceCustomerId, keyInvoiceCustomers.id),
      )
      .where(whereClause);
    const totalCount = Number(totalRows[0]?.value ?? 0);

    const rows = await db
      .select({
        document: fiscalDocuments,
        paymentOrder: paymentOrders,
        author: authors,
        keyInvoiceCustomer: keyInvoiceCustomers,
      })
      .from(fiscalDocuments)
      .leftJoin(paymentOrders, eq(fiscalDocuments.orderId, paymentOrders.orderId))
      .leftJoin(authors, eq(fiscalDocuments.authorId, authors.authorId))
      .leftJoin(
        keyInvoiceCustomers,
        eq(fiscalDocuments.keyInvoiceCustomerId, keyInvoiceCustomers.id),
      )
      .where(whereClause)
      .orderBy(...buildOrderBy(params.sort, params.sortOrder))
      .limit(limit)
      .offset(offset);

    const totalPages = totalCount === 0 ? 0 : Math.ceil(totalCount / limit);
    return {
      data: rows.map((row) => mapFiscalSummary(row)),
      pagination: {
        page,
        limit,
        totalCount,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    };
  },

  async getById(id: string): Promise<FiscalDocumentDetail | null> {
    const db = getMythoriaDb();
    const [row] = await db
      .select({
        document: fiscalDocuments,
        paymentOrder: paymentOrders,
        author: authors,
        keyInvoiceCustomer: keyInvoiceCustomers,
      })
      .from(fiscalDocuments)
      .leftJoin(paymentOrders, eq(fiscalDocuments.orderId, paymentOrders.orderId))
      .leftJoin(authors, eq(fiscalDocuments.authorId, authors.authorId))
      .leftJoin(
        keyInvoiceCustomers,
        eq(fiscalDocuments.keyInvoiceCustomerId, keyInvoiceCustomers.id),
      )
      .where(eq(fiscalDocuments.id, id))
      .limit(1);

    if (!row) {
      return null;
    }

    const events = await db
      .select()
      .from(fiscalDocumentEvents)
      .where(
        or(
          eq(fiscalDocumentEvents.fiscalDocumentId, row.document.id),
          eq(fiscalDocumentEvents.orderId, row.document.orderId),
        ),
      )
      .orderBy(asc(fiscalDocumentEvents.createdAt));

    return {
      ...mapFiscalSummary(row),
      events,
    };
  },

  async getIssueCounts(): Promise<FiscalIssueCounts> {
    const db = getMythoriaDb();
    const [row] = await db
      .select({
        failed: sql<number>`COUNT(*) FILTER (WHERE ${fiscalDocuments.status} = 'failed')`,
        stalePending: sql<number>`COUNT(*) FILTER (WHERE ${fiscalDocuments.status} = 'pending' AND ${fiscalDocuments.createdAt} < ${ATTENTION_THRESHOLD_SQL})`,
        staleIssuing: sql<number>`COUNT(*) FILTER (WHERE ${fiscalDocuments.status} = 'issuing' AND ${fiscalDocuments.updatedAt} < ${ATTENTION_THRESHOLD_SQL})`,
        creditNoteRequired: sql<number>`COUNT(*) FILTER (WHERE ${fiscalDocuments.status} = 'credit_note_required')`,
      })
      .from(fiscalDocuments);

    const failed = Number(row?.failed ?? 0);
    const stalePending = Number(row?.stalePending ?? 0);
    const staleIssuing = Number(row?.staleIssuing ?? 0);
    const creditNoteRequired = Number(row?.creditNoteRequired ?? 0);

    return {
      failed,
      stalePending,
      staleIssuing,
      creditNoteRequired,
      total: failed + stalePending + staleIssuing + creditNoteRequired,
    };
  },
};

function buildWhereClause(params: FiscalDocumentListParams): SQL {
  const conditions: SQL[] = [];

  if (params.statuses?.length) {
    conditions.push(inArray(fiscalDocuments.status, params.statuses));
  }

  if (params.needsAttention === true) {
    conditions.push(attentionCondition());
  } else if (params.needsAttention === false) {
    conditions.push(sql`NOT (${attentionCondition()})`);
  }

  if (params.hasError === true) {
    conditions.push(isNotNull(fiscalDocuments.lastError));
  } else if (params.hasError === false) {
    conditions.push(sql`${fiscalDocuments.lastError} IS NULL`);
  }

  if (params.customerMode) {
    conditions.push(eq(fiscalDocuments.customerMode, params.customerMode));
  }

  if (params.provider) {
    conditions.push(eq(fiscalDocuments.provider, params.provider));
  }

  if (params.dateFrom) {
    conditions.push(gte(fiscalDocuments.createdAt, params.dateFrom));
  }

  if (params.dateTo) {
    conditions.push(lte(fiscalDocuments.createdAt, params.dateTo));
  }

  const search = params.q?.trim().toLowerCase();
  if (search) {
    const pattern = `%${search}%`;
    conditions.push(
      or(
        like(sql`LOWER(CAST(${fiscalDocuments.id} AS text))`, pattern),
        like(sql`LOWER(CAST(${fiscalDocuments.orderId} AS text))`, pattern),
        like(sql`LOWER(COALESCE(${fiscalDocuments.fullDocNumber}, ''))`, pattern),
        like(sql`LOWER(COALESCE(${fiscalDocuments.docNum}, ''))`, pattern),
        like(sql`LOWER(COALESCE(${fiscalDocuments.stripeCheckoutSessionId}, ''))`, pattern),
        like(sql`LOWER(COALESCE(${fiscalDocuments.stripePaymentIntentId}, ''))`, pattern),
        like(sql`LOWER(COALESCE(${fiscalDocuments.keyInvoiceClientId}, ''))`, pattern),
        like(sql`LOWER(COALESCE(${fiscalDocuments.taxId}, ''))`, pattern),
        like(sql`LOWER(COALESCE(${authors.displayName}, ''))`, pattern),
        like(sql`LOWER(COALESCE(${authors.email}, ''))`, pattern),
        like(sql`LOWER(COALESCE(${authors.fiscalNumber}, ''))`, pattern),
        like(sql`LOWER(COALESCE(${keyInvoiceCustomers.vatin}, ''))`, pattern),
        like(sql`LOWER(COALESCE(${keyInvoiceCustomers.name}, ''))`, pattern),
        like(sql`LOWER(COALESCE(${paymentOrders.providerOrderId}, ''))`, pattern),
        like(sql`LOWER(COALESCE(${paymentOrders.providerPublicId}, ''))`, pattern),
      ) as SQL,
    );
  }

  if (!conditions.length) {
    return sql`true`;
  }

  return and(...conditions) ?? sql`true`;
}

function buildOrderBy(sort: FiscalSort = 'attention', sortOrder: 'asc' | 'desc' = 'desc'): SQL[] {
  if (sort === 'attention') {
    return [desc(attentionSortExpression()), desc(fiscalDocuments.updatedAt)];
  }

  const column =
    sort === 'createdAt'
      ? fiscalDocuments.createdAt
      : sort === 'attemptCount'
        ? fiscalDocuments.attemptCount
        : sort === 'nextRetryAt'
          ? fiscalDocuments.nextRetryAt
          : sort === 'issuedAt'
            ? fiscalDocuments.issuedAt
            : fiscalDocuments.updatedAt;

  return [sortOrder === 'asc' ? asc(column) : desc(column), desc(fiscalDocuments.updatedAt)];
}

function attentionCondition(): SQL {
  return sql`(
    ${fiscalDocuments.status} = 'failed'
    OR ${fiscalDocuments.status} = 'credit_note_required'
    OR (${fiscalDocuments.status} = 'pending' AND ${fiscalDocuments.createdAt} < ${ATTENTION_THRESHOLD_SQL})
    OR (${fiscalDocuments.status} = 'issuing' AND ${fiscalDocuments.updatedAt} < ${ATTENTION_THRESHOLD_SQL})
  )`;
}

function attentionSortExpression(): SQL<number> {
  return sql<number>`CASE WHEN ${attentionCondition()} THEN 1 ELSE 0 END`;
}

function mapFiscalSummary(row: {
  document: typeof fiscalDocuments.$inferSelect;
  paymentOrder: typeof paymentOrders.$inferSelect | null;
  author: typeof authors.$inferSelect | null;
  keyInvoiceCustomer: typeof keyInvoiceCustomers.$inferSelect | null;
}): FiscalDocumentSummary {
  const status = row.document.status as FiscalDocumentStatus;
  const needsAttention = computeNeedsAttention({
    status,
    createdAt: row.document.createdAt,
    updatedAt: row.document.updatedAt,
  });
  const retryableNow = computeRetryableNow({
    status,
    nextRetryAt: row.document.nextRetryAt,
  });

  return {
    id: row.document.id,
    orderId: row.document.orderId,
    authorId: row.document.authorId,
    provider: row.document.provider,
    status,
    docType: row.document.docType,
    docSeries: row.document.docSeries,
    docNum: row.document.docNum,
    fullDocNumber: row.document.fullDocNumber,
    grossTotal: row.document.grossTotal,
    netTotal: row.document.netTotal,
    taxTotal: row.document.taxTotal,
    vatRate: row.document.vatRate,
    taxId: row.document.taxId,
    customerMode: row.document.customerMode as FiscalCustomerMode,
    keyInvoiceClientId: row.document.keyInvoiceClientId,
    finalConsumerVatNumber: row.document.finalConsumerVatNumber,
    stripeCheckoutSessionId: row.document.stripeCheckoutSessionId,
    stripePaymentIntentId: row.document.stripePaymentIntentId,
    pdfStoragePath: row.document.pdfStoragePath,
    pdfSha256: row.document.pdfSha256,
    lastError: row.document.lastError,
    attemptCount: row.document.attemptCount,
    nextRetryAt: row.document.nextRetryAt,
    issuedAt: row.document.issuedAt,
    createdAt: row.document.createdAt,
    updatedAt: row.document.updatedAt,
    needsAttention,
    retryableNow,
    attentionPriority:
      status === 'failed' || status === 'credit_note_required' || row.document.attemptCount >= 3
        ? 'high'
        : needsAttention
          ? 'warning'
          : 'none',
    paymentOrder: row.paymentOrder
      ? {
          orderId: row.paymentOrder.orderId,
          amount: row.paymentOrder.amount,
          currency: row.paymentOrder.currency,
          status: row.paymentOrder.status,
          provider: row.paymentOrder.provider,
          providerOrderId: row.paymentOrder.providerOrderId,
          providerPublicId: row.paymentOrder.providerPublicId,
          creditBundle: row.paymentOrder.creditBundle,
          metadata: row.paymentOrder.metadata,
          createdAt: row.paymentOrder.createdAt,
          updatedAt: row.paymentOrder.updatedAt,
        }
      : null,
    author: row.author
      ? {
          authorId: row.author.authorId,
          displayName: row.author.displayName,
          email: row.author.email,
          fiscalNumber: row.author.fiscalNumber,
        }
      : null,
    keyInvoiceCustomer: row.keyInvoiceCustomer
      ? {
          id: row.keyInvoiceCustomer.id,
          vatin: row.keyInvoiceCustomer.vatin,
          keyInvoiceClientId: row.keyInvoiceCustomer.keyInvoiceClientId,
          name: row.keyInvoiceCustomer.name,
          email: row.keyInvoiceCustomer.email,
          phone: row.keyInvoiceCustomer.phone,
          countryCode: row.keyInvoiceCustomer.countryCode,
          address: row.keyInvoiceCustomer.address,
          postalCode: row.keyInvoiceCustomer.postalCode,
          locality: row.keyInvoiceCustomer.locality,
        }
      : null,
  };
}

function normalizePage(page?: number): number {
  return Number.isFinite(page) && page && page > 0 ? Math.floor(page) : 1;
}

function normalizeLimit(limit?: number): number {
  if (!Number.isFinite(limit) || !limit) {
    return 50;
  }
  return Math.min(Math.max(Math.floor(limit), 1), 200);
}
