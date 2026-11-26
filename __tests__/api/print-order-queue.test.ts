/** @jest-environment node */
import { getTableName } from 'drizzle-orm';
import type { PgTable } from 'drizzle-orm/pg-core';
import { GET } from '@/app/api/tickets/print-orders/route';
import { getBackofficeDb, getMythoriaDb } from '@/db';
import { authenticateAdmin } from '@/lib/api-helpers';
import type { PrintOrderQueueResponse } from '@/lib/print-order-queue';

jest.mock('@/db', () => ({ getBackofficeDb: jest.fn(), getMythoriaDb: jest.fn() }));
jest.mock('@/lib/api-helpers', () => ({ authenticateAdmin: jest.fn() }));

const id = (value: number) => `${value.toString(16).padStart(8, '0')}-aaaa-4aaa-8aaa-aaaaaaaaaaaa`;
const earlier = new Date('2026-11-25T10:00:00Z');
const later = new Date('2026-11-26T10:00:00Z');
const storyId = id(1000);

function ticket(value: number, data: Record<string, unknown> = {}) {
  return {
    ticketId: id(value),
    ticketStatus: 'open',
    storyId,
    updatedAt: earlier,
    reference: null,
    title: null,
    copies: null,
    owner: null,
    staffProof: false,
    adminOrder: false,
    destinationCountry: null,
    addressId: null,
    legacyDispatchStatus: null,
    historicalMetadata: null,
    ...data,
  };
}

function order(ticketValue: number, requestValue: number, data: Record<string, unknown> = {}) {
  return {
    ticketId: id(ticketValue),
    printRequestId: id(requestValue),
    storyId,
    status: 'proof_ready',
    provider: 'manual',
    copies: 2,
    title: 'The Lantern Book',
    destinationCountry: 'PT',
    staffProof: false,
    adminOrder: false,
    editionRevision: null,
    held: false,
    qaPassed: true,
    proofSent: true,
    hasQuote: false,
    hasVendor: false,
    vendorStatus: null,
    updatedAt: earlier,
    ...data,
  };
}

const readTickets = jest.fn();
const readLinkedOrders = jest.fn();

function mockTables() {
  jest.mocked(getBackofficeDb).mockReturnValue({
    select: () => ({
      from: () => ({ where: () => ({ orderBy: () => ({ limit: readTickets }) }) }),
    }),
  } as never);
  jest.mocked(getMythoriaDb).mockReturnValue({
    select: () => ({
      from: (table: PgTable) => {
        switch (getTableName(table)) {
          case 'print_fulfillments':
            return { innerJoin: () => ({ where: readLinkedOrders }) };
          case 'stories':
            return {
              where: async () => [
                {
                  storyId,
                  title: 'The Lantern Book',
                  coverUri: 'gs://mythoria-generated-stories/lantern.png',
                },
              ],
            };
          case 'addresses':
            return { where: async () => [{ addressId: id(999), country: 'IE' }] };
          default:
            throw new Error('Unexpected queue query');
        }
      },
    }),
  } as never);
}

const request = (query = '') =>
  new Request(`https://admin.example/api/tickets/print-orders${query}`);

async function page(query = ''): Promise<PrintOrderQueueResponse> {
  const response = await GET(request(query));
  expect(response.status).toBe(200);
  expect(response.headers.get('cache-control')).toBe('private, no-store');
  return response.json();
}

beforeEach(() => {
  jest.resetAllMocks();
  jest.mocked(authenticateAdmin).mockResolvedValue({ email: 'staff@mythoria.pt' });
  mockTables();
});

it('requires an authenticated Admin session and validates cursor, sort, page and limit', async () => {
  jest
    .mocked(authenticateAdmin)
    .mockResolvedValueOnce({ error: new Response(null, { status: 401 }) } as never);
  expect((await GET(request())).status).toBe(401);
  for (const query of ['?limit=101', '?page=0', '?page=2', '?sort=amount', '?after=invalid']) {
    expect((await GET(request(query))).status).toBe(400);
  }
  expect(getBackofficeDb).not.toHaveBeenCalled();
  expect(getMythoriaDb).not.toHaveBeenCalled();
});

it('paginates globally across batches and preserves disambiguation for two orders on the same story', async () => {
  const first = Array.from({ length: 200 }, (_, i) => ticket(i + 1, { ticketStatus: 'closed' }));
  first[0] = ticket(1);
  first[1] = ticket(2, { reference: id(2002), owner: 'owner@mythoria.pt' });
  const second = [ticket(201, { reference: id(2201) }), ticket(202, { reference: id(2202) })];
  const paid = order(2, 2002);
  const canceled = order(201, 2201, {
    status: 'submitted',
    provider: 'lulu',
    vendorStatus: 'CANCELED',
    hasVendor: true,
    updatedAt: later,
    privateProofUrl: 'https://private.example/full-proof.pdf?X-Goog-Signature=abc',
  });
  const held = order(202, 2202, { status: 'held', held: true });
  const load = () => {
    readTickets.mockResolvedValueOnce(first).mockResolvedValueOnce(second);
    readLinkedOrders.mockResolvedValueOnce([paid]).mockResolvedValueOnce([canceled, held]);
  };

  load();
  const initial = await page('?search=lantern&limit=2');
  expect(initial.data.map(({ ticketId }) => ticketId)).toEqual([id(201), id(1)]);
  expect(initial.data[0]).toMatchObject({
    ticketStatus: 'open',
    fulfillmentStatus: 'submitted',
    vendorStatus: 'CANCELED',
    purpose: 'customer',
    nextAction: 'needs_attention',
    actionLabel: 'Review canceled job',
    updatedAt: later.toISOString(),
    owner: null,
  });
  expect(initial.data[1]).toMatchObject({ purpose: 'legacy', nextAction: 'legacy' });
  expect(JSON.stringify(initial)).not.toMatch(/full-proof|X-Goog-Signature/);
  expect(initial.counts).toMatchObject({
    needs_attention: 2,
    awaiting_review: 1,
    legacy: 1,
    closed: 198,
  });
  expect(initial.pagination).toMatchObject({ total: 202, hasNext: true, hasPrev: false });

  load();
  const next = await page(`?search=lantern&limit=2&page=2&after=${initial.pagination.nextCursor}`);
  expect(next.data.map(({ ticketId }) => ticketId)).toEqual([id(2), id(3)]);
  expect(next.data[0]).toMatchObject({
    purpose: 'customer',
    copies: 2,
    destinationCountry: 'PT',
    owner: 'owner@mythoria.pt',
  });
  expect(next.pagination).toMatchObject({ total: 202, hasNext: true, hasPrev: true });

  load();
  const previous = await page(
    `?search=lantern&limit=2&page=1&before=${next.pagination.previousCursor}`,
  );
  expect(previous).toEqual(initial);

  load();
  const filtered = await page('?search=lantern&action=needs_attention&purpose=customer&limit=1');
  expect(filtered.data.map(({ ticketId }) => ticketId)).toEqual([id(201)]);
  expect(filtered.counts).toMatchObject({ needs_attention: 2, awaiting_review: 1, legacy: 0 });
  expect(filtered.pagination).toMatchObject({ total: 2, hasNext: true, hasPrev: false });

  load();
  const byOrder = await page(`?search=${id(2002).slice(0, 8).toUpperCase()}`);
  expect(byOrder.data.map(({ ticketId }) => ticketId)).toEqual([id(2)]);
});

it('supports older metadata and keeps reverse-only or mismatched links out of the legacy action', async () => {
  readTickets.mockResolvedValue([
    ticket(1, {
      storyId: null,
      historicalMetadata: JSON.stringify({
        storyId,
        printOwner: 'legacy-owner@mythoria.pt',
        requestedBy: 'requester@mythoria.pt',
        numberOfCopies: 3,
        shippingAddress: { addressId: id(999), line1: 'Private address' },
      }),
    }),
    ticket(2),
    ticket(3, { reference: id(2201) }),
    ticket(4, { reference: 'malformed-reference' }),
    ticket(5, { reference: id(2205) }),
  ]);
  readLinkedOrders.mockResolvedValue([
    order(2, 2201),
    order(5, 2205, { staffProof: true, proofSent: false, copies: 1, editionRevision: id(3000) }),
  ]);
  const result = await page('?sort=title_asc');
  expect(result.data[0]).toMatchObject({
    purpose: 'legacy',
    orderReference: '#' + id(1).split('-')[1].toUpperCase(),
    owner: 'legacy-owner@mythoria.pt',
    copies: 3,
    destinationCountry: 'IE',
    thumbnailUrl: 'https://storage.googleapis.com/mythoria-generated-stories/lantern.png',
  });
  expect(result.data.slice(1, 4).map(({ actionLabel }) => actionLabel)).toEqual([
    'Check fulfillment link',
    'Check fulfillment link',
    'Check fulfillment link',
  ]);
  expect(result.data[4]).toMatchObject({
    purpose: 'staff_proof',
    nextAction: 'ready',
    thumbnailUrl: `/api/admin/stories/${storyId}/premium-edition/front?revision=${id(3000)}`,
  });
  expect(JSON.stringify(result)).not.toMatch(
    /Private address|requester@mythoria.pt|historicalMetadata/,
  );
});

it('routes sent and uncertain legacy dispatches to follow-up and includes them in the matching counts', async () => {
  readTickets.mockResolvedValue([
    ticket(1, { legacyDispatchStatus: 'sent' }),
    ticket(2, { legacyDispatchStatus: 'uncertain' }),
    ticket(3, { legacyDispatchStatus: 'dispatching' }),
    ticket(4),
  ]);
  readLinkedOrders.mockResolvedValue([]);
  const result = await page('?purpose=legacy&action=needs_attention');
  expect(result.counts).toMatchObject({ with_supplier: 1, needs_attention: 2, legacy: 1 });
  expect(result.data).toEqual([
    expect.objectContaining({
      ticketId: id(2),
      actionLabel: 'Verify legacy printer email delivery',
    }),
    expect.objectContaining({ ticketId: id(3), actionLabel: 'Check legacy printer dispatch' }),
  ]);
});
