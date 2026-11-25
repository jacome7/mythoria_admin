/** @jest-environment node */
import { POST } from '@/app/api/admin/print/manual/route';
import { authenticateAdmin } from '@/lib/api-helpers';
import { TicketService } from '@/lib/ticketing/service';
import { callPrintDomain } from '@/services/print';

jest.mock('@/lib/api-helpers', () => ({ authenticateAdmin: jest.fn() }));
jest.mock('@/lib/audit', () => ({ logAdminAudit: jest.fn() }));
jest.mock('@/lib/ticketing/service', () => ({ TicketService: { getTicketById: jest.fn() } }));
jest.mock('@/services/print', () => ({
  callPrintDomain: jest.fn(),
  PrintDomainError: class extends Error {},
}));
jest.mock('@/db', () => ({
  getMythoriaDb: () => ({
    select: () => ({
      from: () => ({
        where: () => ({ limit: async () => [{ type: 'printer', email: 'printer@example.com' }] }),
      }),
    }),
  }),
}));

const ticketId = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
const printRequestId = 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb';
const partnerId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const request = () =>
  new Request('http://localhost/api/admin/print/manual', {
    method: 'POST',
    body: JSON.stringify({ ticketId, partnerId, subject: 'Print', bodyText: 'Please print' }),
  });

beforeEach(() => {
  jest.clearAllMocks();
  process.env.NOTIFICATION_ENGINE_URL = 'https://notification.example.com';
  process.env.NOTIFICATION_ENGINE_API_KEY = 'test-key';
  jest.mocked(authenticateAdmin).mockResolvedValue({ email: 'admin@mythoria.pt' });
  jest.mocked(TicketService.getTicketById).mockResolvedValue({
    id: ticketId,
    category: 'print_request',
    status: 'open',
    metadata: { printRequestId },
  } as never);
  jest
    .mocked(callPrintDomain)
    .mockResolvedValueOnce({
      reservationId: 'reservation',
      coverUri: 'gs://bucket/cover',
      interiorUri: 'gs://bucket/interior',
      downloadLinks: {
        interior: 'https://storage.example.org/interior',
        cover: 'https://storage.example.org/cover',
      },
    })
    .mockResolvedValueOnce({ status: 'manual_uncertain' });
});

it('locks a dispatch and marks a timeout uncertain without resending', async () => {
  const fetchMock = jest.spyOn(global, 'fetch').mockRejectedValueOnce(new Error('timeout'));
  const response = await POST(request());
  expect(response.status).toBe(200);
  expect((await response.json()).outcome).toBe('uncertain');
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(callPrintDomain).toHaveBeenLastCalledWith(
    'finalizeManual',
    { ticketId, printRequestId, reservationId: 'reservation', outcome: 'uncertain' },
    'admin@mythoria.pt',
  );
  fetchMock.mockRestore();
});

it('records sent only when the delivery ledger confirms it', async () => {
  const fetchMock = jest
    .spyOn(global, 'fetch')
    .mockResolvedValueOnce(Response.json({ data: { deliveryStatus: 'sent' } }));
  const response = await POST(request());
  expect((await response.json()).outcome).toBe('sent');
  expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body)).downloadLinks.cover).toBe(
    'https://storage.example.org/cover',
  );
  expect(callPrintDomain).toHaveBeenLastCalledWith(
    'finalizeManual',
    expect.objectContaining({ outcome: 'sent' }),
    'admin@mythoria.pt',
  );
  fetchMock.mockRestore();
});
