/** @jest-environment node */
import { NextRequest, NextResponse } from 'next/server';
import { POST as createLegacyTicket } from '@/app/api/tickets/route';
import { POST as createPaidTicket } from '@/app/api/tickets/paid-print/route';
import { authenticateRequest } from '@/lib/auth/middleware';
import { TicketService } from '@/lib/ticketing/service';

jest.mock('@/lib/auth/middleware', () => ({
  authenticateRequest: jest.fn(),
  unauthorizedResponse: () => NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
}));

const storyId = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
const userId = 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb';
const printRequestId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const ticketId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const versioned = {
  category: 'print_request',
  storyId,
  userId,
  shippingAddress: { addressId: 'address-book-id' },
  printFormat: 'paperback',
  numberOfCopies: 2,
  orderDetails: { fulfillmentVersion: 1, printRequestId },
};
const legacy = { ...versioned, orderDetails: { printRequestId } };
const payload = (path: string, body: unknown) =>
  new NextRequest(`https://admin.example/api/tickets${path}`, {
    method: 'POST',
    body: JSON.stringify(body),
  });

beforeEach(() => {
  jest.mocked(authenticateRequest).mockResolvedValue({ success: true, source: 'api-key' });
});

afterEach(() => jest.restoreAllMocks());

it.each(['api-key', 'session'] as const)(
  'keeps an unversioned legacy print request on the existing ticket email path with %s auth',
  async (source) => {
    jest.mocked(authenticateRequest).mockResolvedValueOnce({ success: true, source });
    const ticket = jest
      .spyOn(TicketService, 'createTicket')
      .mockResolvedValueOnce({ id: ticketId } as never);
    const linked = jest.spyOn(TicketService, 'createLinkedPrintTicket');
    const response = await createLegacyTicket(
      payload('', {
        ...legacy,
        metadata: { printRequestId, fulfillmentVersion: 1 },
      }),
    );
    expect(response.status).toBe(201);
    expect(linked).not.toHaveBeenCalled();
    expect(ticket).toHaveBeenCalledWith(
      expect.objectContaining({
        category: 'print_request',
        metadata: {
          storyId,
          shippingAddress: versioned.shippingAddress,
          printFormat: versioned.printFormat,
          numberOfCopies: versioned.numberOfCopies,
        },
      }),
    );
  },
);

it('does not accept a versioned paid request on the legacy endpoint', async () => {
  const legacyTicket = jest.spyOn(TicketService, 'createPrintTicket');
  const linked = jest.spyOn(TicketService, 'createLinkedPrintTicket');
  expect((await createLegacyTicket(payload('', versioned))).status).toBe(400);
  expect(legacyTicket).not.toHaveBeenCalled();
  expect(linked).not.toHaveBeenCalled();
});

it('requires a service API key on the paid ticket endpoint', async () => {
  const linked = jest.spyOn(TicketService, 'createLinkedPrintTicket');
  jest.mocked(authenticateRequest).mockResolvedValueOnce({ success: false });
  expect((await createPaidTicket(payload('/paid-print', versioned))).status).toBe(401);
  jest.mocked(authenticateRequest).mockResolvedValueOnce({ success: true, source: 'session' });
  expect((await createPaidTicket(payload('/paid-print', versioned))).status).toBe(403);
  expect(linked).not.toHaveBeenCalled();
});

it.each([
  legacy,
  { ...versioned, category: 'contact' },
  { ...versioned, orderDetails: { fulfillmentVersion: 2, printRequestId } },
  { ...versioned, orderDetails: { fulfillmentVersion: '1', printRequestId } },
  { ...versioned, orderDetails: { fulfillmentVersion: 1 } },
  { ...versioned, orderDetails: { fulfillmentVersion: 1, printRequestId: 'invalid' } },
])('rejects unsupported or invalid paid print payload %#', async (body) => {
  const linked = jest.spyOn(TicketService, 'createLinkedPrintTicket');
  expect((await createPaidTicket(payload('/paid-print', body))).status).toBe(400);
  expect(linked).not.toHaveBeenCalled();
});

it('returns the verified paid linkage without dispatching the legacy email', async () => {
  const linked = jest
    .spyOn(TicketService, 'createLinkedPrintTicket')
    .mockResolvedValue({ id: ticketId, metadata: { printRequestId } } as never);
  const legacyTicket = jest.spyOn(TicketService, 'createTicket');
  for (let i = 0; i < 2; i += 1) {
    const response = await createPaidTicket(payload('/paid-print', versioned));
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ id: ticketId, metadata: { printRequestId } });
  }
  expect(linked).toHaveBeenLastCalledWith({
    storyId,
    userId,
    printRequestId,
    printFormat: 'paperback',
    numberOfCopies: 2,
  });
  expect(legacyTicket).not.toHaveBeenCalled();
});

it('fails the paid checkout handshake if the ticket returned by storage lacks the requested linkage', async () => {
  jest
    .spyOn(TicketService, 'createLinkedPrintTicket')
    .mockResolvedValueOnce({ id: ticketId } as never);
  expect((await createPaidTicket(payload('/paid-print', versioned))).status).toBe(502);
});
