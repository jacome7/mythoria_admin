/** @jest-environment node */
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/admin/stories/[storyId]/request-print/route';
import { proxyToNotificationEngine } from '@/lib/api-helpers';
import { TicketService } from '@/lib/ticketing/service';
import { callPrintDomain } from '@/services/print';

jest.mock('@/lib/api-helpers', () => ({
  authenticateAdmin: async () => ({ email: 'admin@mythoria.pt' }),
  proxyToNotificationEngine: jest.fn(),
}));
jest.mock('@/services/print', () => ({
  callPrintDomain: jest.fn(),
  PrintDomainError: class extends Error {},
}));
jest.mock('@/lib/ticketing/service', () => ({ TicketService: { getTicketById: jest.fn() } }));
jest.mock('@/db', () => {
  const select = (lookup: () => unknown) => ({
    select: () => ({
      from: () => ({ where: () => ({ limit: async () => lookup() }) }),
    }),
  });
  return {
    getBackofficeDb: () => select(mockReadTickets),
    getMythoriaDb: () => select(mockReadStoryOrPartner),
  };
});

const mockReadTickets = jest.fn();
const mockReadStoryOrPartner = jest.fn();
const storyId = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
const legacyTicketId = 'c0dedede-dede-4ede-8ede-dededededede';
const createdAt = new Date('2026-11-20T10:30:00Z');
const legacyTicket = {
  id: legacyTicketId,
  category: 'print_request',
  status: 'open',
  metadata: { storyId },
  createdAt,
};
const coverPdfUri = 'gs://stories/story/cover.pdf';
const interiorPdfUri = 'gs://stories/story/interior.pdf';
const request = (cover = coverPdfUri, ticketId?: string) =>
  POST(
    new NextRequest(`https://admin.example/api/admin/stories/${storyId}/request-print`, {
      method: 'POST',
      body: JSON.stringify({
        coverPdfUri: cover,
        interiorPdfUri,
        partnerId: 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb',
        subject: 'Legacy print',
        bodyText: 'Please print this book.',
        legacyTicketId: ticketId,
      }),
    }),
    { params: Promise.resolve({ storyId }) },
  );

beforeEach(() => {
  jest.clearAllMocks();
  mockReadTickets.mockReturnValue([]);
  mockReadStoryOrPartner.mockReset();
  jest.mocked(callPrintDomain).mockResolvedValue(false);
  jest
    .mocked(proxyToNotificationEngine)
    .mockResolvedValue(Response.json({ success: true }) as never);
  jest.replaceProperty(process, 'env', {
    ...process.env,
    PRINT_INTERNAL_AUDIENCE: 'https://webapp.example',
  });
});

afterEach(() => jest.restoreAllMocks());

it('blocks the legacy email for a paid print reservation before ticket creation', async () => {
  jest.mocked(callPrintDomain).mockResolvedValueOnce(true);
  expect((await request()).status).toBe(409);
  expect(callPrintDomain).toHaveBeenCalledWith(
    'hasPaidOrderForStory',
    { storyId },
    'admin@mythoria.pt',
  );
  expect(proxyToNotificationEngine).not.toHaveBeenCalled();
});

it('continues legacy dispatch for the saved story files with print fulfillment unconfigured', async () => {
  delete process.env.PRINT_INTERNAL_AUDIENCE;
  mockReadStoryOrPartner
    .mockReturnValueOnce([{ coverPdfUri, interiorPdfUri }])
    .mockReturnValueOnce([{ email: 'printer@example.com' }]);

  expect((await request()).status).toBe(200);
  expect(callPrintDomain).not.toHaveBeenCalled();
  expect(proxyToNotificationEngine).toHaveBeenCalledWith(
    '/email/admin-print-request',
    expect.objectContaining({
      body: expect.objectContaining({
        toEmail: 'printer@example.com',
        coverPdfUri,
        interiorPdfUri,
      }),
    }),
  );
});

it('blocks stale or unrelated PDFs in a legacy story request', async () => {
  mockReadStoryOrPartner.mockReturnValueOnce([{ coverPdfUri, interiorPdfUri }]);
  expect((await request('gs://other-story/cover.pdf')).status).toBe(409);
  expect(proxyToNotificationEngine).not.toHaveBeenCalled();
});

it('blocks manual dispatch of premium books even before a paid ticket exists', async () => {
  mockReadStoryOrPartner.mockReturnValueOnce([
    { coverPdfUri, interiorPdfUri, features: { premiumBook: { version: 1 } } },
  ]);
  expect((await request()).status).toBe(409);
  expect(proxyToNotificationEngine).not.toHaveBeenCalled();
});

it('allows the verified legacy ticket to use the original dispatch path past a later paid reservation', async () => {
  jest.mocked(TicketService.getTicketById).mockResolvedValueOnce(legacyTicket as never);
  jest
    .mocked(callPrintDomain)
    .mockImplementationOnce(
      async (_operation, input) => !('requestedThrough' in (input as object)),
    );
  mockReadStoryOrPartner
    .mockReturnValueOnce([{ coverPdfUri, interiorPdfUri }])
    .mockReturnValueOnce([{ email: 'printer@example.com' }]);

  expect((await request(coverPdfUri, legacyTicketId)).status).toBe(200);
  expect(callPrintDomain).toHaveBeenCalledWith(
    'hasPaidOrderForStory',
    { storyId, requestedThrough: createdAt.toISOString() },
    'admin@mythoria.pt',
  );
  expect(proxyToNotificationEngine).toHaveBeenCalledTimes(1);
});

it.each([
  { metadata: { storyId: 'different' } },
  { metadata: { storyId, printRequestId: 'paid-order' } },
  { status: 'closed' },
  { category: 'other' },
])('rejects invalid legacy ticket scope %j', async (overrides) => {
  jest
    .mocked(TicketService.getTicketById)
    .mockResolvedValueOnce({ ...legacyTicket, ...overrides } as never);
  expect((await request(coverPdfUri, legacyTicketId)).status).toBe(409);
  expect(callPrintDomain).not.toHaveBeenCalled();
  expect(proxyToNotificationEngine).not.toHaveBeenCalled();
});

it('rejects a legacy ticket created after an existing paid reservation', async () => {
  jest.mocked(TicketService.getTicketById).mockResolvedValueOnce(legacyTicket as never);
  jest.mocked(callPrintDomain).mockResolvedValueOnce(true);
  expect((await request(coverPdfUri, legacyTicketId)).status).toBe(409);
  expect(proxyToNotificationEngine).not.toHaveBeenCalled();
});
