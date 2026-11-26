import { and, asc, eq, gt, inArray, or, sql } from 'drizzle-orm';
import { z } from 'zod';
import { getBackofficeDb, getMythoriaDb } from '@/db';
import { addresses } from '@/db/schema/authors';
import { printRequests } from '@/db/schema/print';
import { printFulfillmentsRead as fulfillments } from '@/db/schema/print-costs';
import { stories } from '@/db/schema/stories';
import { tickets } from '@/db/schema/tickets';
import {
  type PrintOrderPurpose,
  type PrintOrderQueueResponse,
  type PrintOrderQueueRow,
  type PrintOrderSort,
  printOrderPurposes,
  printOrderSorts,
} from '@/lib/print-order-queue';
import { classifyPrintOrder, printOrderGroups } from '@/lib/print-order-state';
import { getStoryImageUrl } from '@/lib/storyImageUrl';
import type { TicketMetadata } from '@/lib/ticketing/types';
import { getFormattedTicketNumber } from '@/lib/ticketing/utils';

const batchSize = 200;
const uuid = z.uuid().toLowerCase();
const titleCollator = new Intl.Collator('en', { sensitivity: 'base' });

const cursorSchema = z.object({
  sort: z.enum(printOrderSorts),
  ticketId: uuid,
  title: z.string().max(512),
  updatedAt: z.iso.datetime(),
});

const cursorValue = z
  .string()
  .max(4096)
  .regex(/^[\w-]+$/)
  .transform((value, ctx) => {
    try {
      return cursorSchema.parse(JSON.parse(Buffer.from(value, 'base64url').toString('utf8')));
    } catch {
      ctx.addIssue({ code: 'custom', message: 'Invalid cursor' });
      return z.NEVER;
    }
  });

export const printOrderQueueQuery = z
  .object({
    search: z.string().trim().max(255).default(''),
    purpose: z.enum(printOrderPurposes).optional(),
    action: z.enum(printOrderGroups).optional(),
    sort: z.enum(printOrderSorts).default('updated_desc'),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(25),
    after: cursorValue.optional(),
    before: cursorValue.optional(),
  })
  .refine(
    ({ after, before, page, sort }) =>
      !(after && before) && ((after ?? before) ? (after ?? before)?.sort === sort : page === 1),
    'Invalid pagination',
  );

type PrintOrderQueueQuery = z.infer<typeof printOrderQueueQuery>;
type SortKey = Pick<PrintOrderQueueRow, 'ticketId' | 'title' | 'updatedAt'>;

function validUuid(value: string | null) {
  return uuid.safeParse(value).data ?? null;
}

function readTicketBatch(afterId?: string) {
  return getBackofficeDb()
    .select({
      ticketId: tickets.id,
      ticketStatus: tickets.status,
      updatedAt: tickets.updatedAt,
      reference: sql<string | null>`${tickets.metadata}->>'printRequestId'`,
      storyId: sql<string | null>`${tickets.metadata}->>'storyId'`,
      title: sql<string | null>`${tickets.metadata}->'enrichedStory'->>'title'`,
      copies: sql<string | null>`${tickets.metadata}->>'numberOfCopies'`,
      owner: sql<string | null>`CASE WHEN jsonb_typeof(${tickets.metadata}->'printOwner') = 'string'
        THEN ${tickets.metadata}->>'printOwner' END`,
      staffProof: sql<boolean>`COALESCE(${tickets.metadata}->>'orderKind' = 'staff_proof'
        OR jsonb_typeof(${tickets.metadata}->'proofOnly') = 'object', false)`,
      adminOrder: sql<boolean>`COALESCE(${tickets.metadata}->>'orderKind' = 'admin_order'
        OR ${tickets.metadata}->>'adminPrintOrder' = 'true', false)`,
      destinationCountry: sql<string | null>`COALESCE(
        ${tickets.metadata}->'enrichedAddress'->>'country',
        ${tickets.metadata}->'shippingAddress'->>'country_code',
        ${tickets.metadata}->'shippingAddress'->>'country'
      )`,
      addressId: sql<string | null>`${tickets.metadata}->'shippingAddress'->>'addressId'`,
      legacyDispatchStatus: sql<
        string | null
      >`${tickets.metadata}->'legacyPrintDispatch'->>'status'`,
      historicalMetadata: sql<string | null>`CASE WHEN jsonb_typeof(${tickets.metadata}) = 'string'
        THEN ${tickets.metadata}#>>'{}' END`,
    })
    .from(tickets)
    .where(
      and(eq(tickets.category, 'print_request'), afterId ? gt(tickets.id, afterId) : undefined),
    )
    .orderBy(asc(tickets.id))
    .limit(batchSize);
}

type TicketSummary = Awaited<ReturnType<typeof readTicketBatch>>[number];

function readText(value: unknown) {
  return typeof value === 'string' ? value : null;
}

function withHistoricalMetadata(ticket: TicketSummary): TicketSummary {
  if (!ticket.historicalMetadata) return ticket;
  let metadata: TicketMetadata;
  try {
    const value: unknown = JSON.parse(ticket.historicalMetadata);
    if (!value || typeof value !== 'object' || Array.isArray(value)) return ticket;
    metadata = value as TicketMetadata;
  } catch {
    return ticket;
  }

  return {
    ...ticket,
    reference: metadata.printRequestId == null ? null : (readText(metadata.printRequestId) ?? ''),
    storyId: readText(metadata.storyId),
    title: readText(metadata.enrichedStory?.title),
    copies:
      typeof metadata.numberOfCopies === 'number'
        ? String(metadata.numberOfCopies)
        : readText(metadata.numberOfCopies),
    owner: readText(metadata.printOwner),
    staffProof:
      metadata.orderKind === 'staff_proof' ||
      Boolean(metadata.proofOnly && typeof metadata.proofOnly === 'object'),
    adminOrder: metadata.orderKind === 'admin_order' || metadata.adminPrintOrder === true,
    destinationCountry:
      readText(metadata.enrichedAddress?.country) ??
      readText(metadata.shippingAddress?.country_code) ??
      readText(metadata.shippingAddress?.country),
    addressId: readText(metadata.shippingAddress?.addressId),
    legacyDispatchStatus: readText(metadata.legacyPrintDispatch?.status),
    historicalMetadata: null,
  };
}

function readLinkedOrderBatch(ticketIds: string[], requestIds: string[]) {
  return getMythoriaDb()
    .select({
      ticketId: fulfillments.ticketId,
      printRequestId: fulfillments.printRequestId,
      storyId: printRequests.storyId,
      status: fulfillments.status,
      provider: fulfillments.provider,
      copies: fulfillments.copies,
      title: sql<string | null>`${fulfillments.emailVariables}->>'storyTitle'`,
      destinationCountry: sql<string | null>`${fulfillments.shippingSnapshot}->>'country_code'`,
      staffProof: sql<boolean>`${printRequests.printingOptions} ? 'staffProofRevision'`,
      adminOrder: sql<boolean>`${printRequests.printingOptions} ? 'adminPrintOrder'`,
      editionRevision: sql<
        string | null
      >`${printRequests.printingOptions}#>>'{premiumEdition,premiumBook,revision}'`,
      held: sql<boolean>`${fulfillments.holdReason} IS NOT NULL`,
      qaPassed: sql<boolean>`COALESCE(${fulfillments.proof}->'qaPassed' = 'true'::jsonb
        AND ${fulfillments.proof}->'qaCriticalCount' = '0'::jsonb, false)`,
      proofSent: sql<boolean>`${fulfillments.proofSentAt} IS NOT NULL`,
      hasQuote: sql<boolean>`COALESCE(jsonb_typeof(${fulfillments.quote}) = 'object', false)`,
      hasVendor: sql<boolean>`NULLIF(${fulfillments.vendor}->>'id', '') IS NOT NULL`,
      vendorStatus: sql<string | null>`${fulfillments.vendor}->>'status'`,
      updatedAt: sql<Date>`GREATEST(${fulfillments.updatedAt}, ${printRequests.updatedAt})`.mapWith(
        fulfillments.updatedAt,
      ),
    })
    .from(fulfillments)
    .innerJoin(printRequests, eq(printRequests.id, fulfillments.printRequestId))
    .where(
      or(
        inArray(fulfillments.ticketId, ticketIds),
        requestIds.length ? inArray(fulfillments.printRequestId, requestIds) : undefined,
      ),
    );
}

function readStoryBatch(storyIds: string[]) {
  return getMythoriaDb()
    .select({ storyId: stories.storyId, title: stories.title, coverUri: stories.coverUri })
    .from(stories)
    .where(inArray(stories.storyId, storyIds));
}

function readAddressCountries(addressIds: string[]) {
  return getMythoriaDb()
    .select({ addressId: addresses.addressId, country: addresses.country })
    .from(addresses)
    .where(inArray(addresses.addressId, addressIds));
}

type LinkedOrderSummary = Awaited<ReturnType<typeof readLinkedOrderBatch>>[number];
type StorySummary = Awaited<ReturnType<typeof readStoryBatch>>[number];

function thumbnailUrl(story: StorySummary | undefined, order: LinkedOrderSummary | undefined) {
  const revision = validUuid(order?.editionRevision ?? null);
  if (order && revision) {
    return `/api/admin/stories/${order.storyId}/premium-edition/front?revision=${revision}`;
  }
  const cover = getStoryImageUrl(story?.coverUri);
  if (!cover) return null;

  const url = new URL(cover);
  return url.protocol === 'https:' && !url.search && !url.hash && !url.username && !url.password
    ? url.href
    : null;
}

function queueRow(
  ticket: TicketSummary,
  order: LinkedOrderSummary | undefined,
  linked: boolean,
  story: StorySummary | undefined,
  legacyCountry: string | null,
): PrintOrderQueueRow {
  const purpose: PrintOrderPurpose = !linked
    ? 'legacy'
    : (order?.staffProof ?? ticket.staffProof)
      ? 'staff_proof'
      : (order?.adminOrder ?? ticket.adminOrder)
        ? 'admin_order'
        : 'customer';
  const fulfillmentStatus = order?.status ?? null;
  const vendorStatus = order?.vendorStatus ?? null;
  const provider = order?.provider ?? null;
  const { group, label } = classifyPrintOrder({
    ticketStatus: ticket.ticketStatus,
    fulfillmentStatus,
    purpose,
    provider,
    vendorStatus,
    hasVendor: order?.hasVendor,
    held: order?.held,
    proofSent: order?.proofSent,
    qaPassed: order?.qaPassed,
    hasQuote: order?.hasQuote,
    linked,
    legacyDispatchStatus: ticket.legacyDispatchStatus,
  });
  const printRequestId = validUuid(ticket.reference);
  const destinationCountry = (order?.destinationCountry ?? legacyCountry)?.trim().toUpperCase();

  return {
    ticketId: ticket.ticketId,
    ticketStatus: ticket.ticketStatus,
    printRequestId,
    orderReference: printRequestId
      ? printRequestId.slice(0, 8).toUpperCase()
      : getFormattedTicketNumber(ticket.ticketId),
    title: (order?.title?.trim() || story?.title || ticket.title?.trim() || 'Untitled order').slice(
      0,
      512,
    ),
    purpose,
    thumbnailUrl: thumbnailUrl(story, order),
    copies:
      order?.copies ?? (/^[1-9]\d{0,8}$/.test(ticket.copies ?? '') ? Number(ticket.copies) : null),
    destinationCountry:
      destinationCountry && /^[A-Z]{2}$/.test(destinationCountry) ? destinationCountry : null,
    nextAction: group,
    actionLabel: label,
    owner: ticket.owner?.trim() || null,
    updatedAt:
      order && order.updatedAt > ticket.updatedAt
        ? order.updatedAt.toISOString()
        : ticket.updatedAt.toISOString(),
    fulfillmentStatus,
    provider,
    vendorStatus,
  };
}

async function* streamPrintOrderSummaries() {
  // The two pools target independent databases. Keep the join at ticket-batch grain
  // and select only fields needed for the summary. Both link lookups have indexes.
  let afterId: string | undefined;
  for (;;) {
    const batch = (await readTicketBatch(afterId)).map(withHistoricalMetadata);
    if (!batch.length) return;

    const references = new Map(
      batch.map((ticket) => [ticket.ticketId, validUuid(ticket.reference)]),
    );
    const requestIds = [...new Set([...references.values()].filter((id) => id !== null))];
    const addressIds = [
      ...new Set(
        batch
          .filter((ticket) => !ticket.reference && !ticket.destinationCountry)
          .map((ticket) => validUuid(ticket.addressId))
          .filter((id) => id !== null),
      ),
    ];
    const [orders, countryRows] = await Promise.all([
      readLinkedOrderBatch(
        batch.map((ticket) => ticket.ticketId),
        requestIds,
      ),
      addressIds.length ? readAddressCountries(addressIds) : [],
    ]);
    const orderById = new Map(orders.map((order) => [order.printRequestId, order]));
    const orderByTicket = new Map(orders.map((order) => [order.ticketId, order]));
    const countryByAddress = new Map(
      countryRows.map((address) => [address.addressId, address.country]),
    );

    const joined = batch.map((ticket) => {
      const legacyStoryId = validUuid(ticket.storyId);
      const orderByReference = orderById.get(references.get(ticket.ticketId) ?? '');
      const reverse = orderByTicket.get(ticket.ticketId);
      // An inconsistent link cannot inherit another ticket's status or open a legacy release path.
      const order =
        orderByReference &&
        (!orderByReference.ticketId || orderByReference.ticketId === ticket.ticketId) &&
        (!reverse || reverse === orderByReference) &&
        (!legacyStoryId || legacyStoryId === orderByReference.storyId)
          ? orderByReference
          : undefined;
      return {
        ticket,
        order,
        linked: ticket.reference !== null || Boolean(reverse),
        storyId: order?.storyId ?? legacyStoryId,
      };
    });
    const storyIds = [...new Set(joined.map(({ storyId }) => storyId).filter((id) => id !== null))];
    const storyRows = storyIds.length ? await readStoryBatch(storyIds) : [];
    const storyById = new Map(storyRows.map((story) => [story.storyId, story]));

    for (const { ticket, order, linked, storyId } of joined) {
      yield queueRow(
        ticket,
        order,
        linked,
        storyById.get(storyId ?? ''),
        linked
          ? null
          : (ticket.destinationCountry ??
              countryByAddress.get(validUuid(ticket.addressId) ?? '') ??
              null),
      );
    }

    if (batch.length < batchSize) return;
    afterId = batch[batch.length - 1].ticketId;
  }
}

function compareRows(a: SortKey, b: SortKey, sort: PrintOrderSort) {
  const updated = a.updatedAt.localeCompare(b.updatedAt);
  const order =
    sort === 'title_asc'
      ? titleCollator.compare(a.title, b.title)
      : sort === 'updated_asc'
        ? updated
        : -updated;
  return order || a.ticketId.localeCompare(b.ticketId);
}

function encodeCursor(row: PrintOrderQueueRow, sort: PrintOrderSort) {
  const { ticketId, title, updatedAt } = row;
  return Buffer.from(JSON.stringify({ sort, ticketId, title, updatedAt })).toString('base64url');
}

async function collectPrintOrderPage(
  rows: AsyncIterable<PrintOrderQueueRow>,
  query: PrintOrderQueueQuery,
): Promise<PrintOrderQueueResponse> {
  const { action, after, before, limit, page, purpose, sort } = query;
  const cursor = after ?? before;
  const compare = (a: SortKey, b: SortKey) => compareRows(a, b, sort);
  const pageOrder = before ? (a: SortKey, b: SortKey) => compare(b, a) : compare;
  const counts = Object.fromEntries(
    printOrderGroups.map((group) => [group, 0]),
  ) as PrintOrderQueueResponse['counts'];
  const search = query.search.toLowerCase();
  const data: PrintOrderQueueRow[] = [];
  let outsideCursor = 0;
  let eligible = 0;
  let total = 0;

  for await (const row of rows) {
    if (purpose && purpose !== row.purpose) continue;
    if (
      search &&
      ![
        row.title,
        row.orderReference,
        row.printRequestId,
        row.ticketId,
        getFormattedTicketNumber(row.ticketId),
      ].some((field) => field?.toLowerCase().includes(search))
    )
      continue;
    counts[row.nextAction]++;
    if (action && action !== row.nextAction) continue;
    total++;

    if (cursor && pageOrder(row, cursor) <= 0) {
      outsideCursor++;
      continue;
    }
    eligible++;
    // Retain the best limit rows on the requested side of the cursor, across all batches.
    if (data.length === limit && pageOrder(row, data[data.length - 1]) >= 0) continue;
    const index = data.findIndex((selected) => pageOrder(row, selected) < 0);
    data.splice(index < 0 ? data.length : index, 0, row);
    if (data.length > limit) data.pop();
  }

  if (before) data.reverse();
  const hasNext = data.length > 0 && (before ? outsideCursor > 0 : eligible > limit);
  const hasPrev = data.length > 0 && (before ? eligible > limit : outsideCursor > 0);
  return {
    data,
    counts,
    pagination: {
      page,
      limit,
      total,
      hasNext,
      hasPrev,
      nextCursor: hasNext ? encodeCursor(data[data.length - 1], sort) : null,
      previousCursor: hasPrev ? encodeCursor(data[0], sort) : null,
    },
  };
}

export function getPrintOrderQueue(query: PrintOrderQueueQuery) {
  return collectPrintOrderPage(streamPrintOrderSummaries(), query);
}
