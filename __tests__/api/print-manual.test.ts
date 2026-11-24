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
  PrintDomainError: class PrintDomainError extends Error {
    constructor(
      public status: number,
      message: string,
    ) {
      super(message);
    }
  },
}));
jest.mock('@/db', () => ({
  getMythoriaDb: () => ({
    select: () => ({
      from: () => ({
        where: () => ({ limit: () => mockFindPartner() }),
      }),
    }),
  }),
}));

const ticketId = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
const printRequestId = 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb';
const partnerId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const reservationId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const proofFiles = {
  interior: { generation: '1638000000000456', sha256: 'a'.repeat(64) },
  cover: { generation: '1638000000000123', sha256: 'b'.repeat(64) },
};
const reservation = {
  reservationId,
  coverUri: 'gs://bucket/cover',
  interiorUri: 'gs://bucket/interior',
  proofFiles,
  downloadLinks: {
    interior: 'https://storage.example.org/interior',
    cover: 'https://storage.example.org/cover',
  },
};
const mockFindPartner = jest.fn();
const request = (overrides?: Record<string, unknown>) =>
  new Request('http://localhost/api/admin/print/manual', {
    method: 'POST',
    body: JSON.stringify({
      ticketId,
      partnerId,
      proofVersion: 3,
      checkedInbox: true,
      subject: 'Print',
      bodyText: 'Please print',
      ...overrides,
    }),
  });

beforeEach(() => {
  jest.clearAllMocks();
  mockFindPartner.mockResolvedValue([
    { type: 'printer', status: 'active', email: 'printer@example.com' },
  ]);
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
    .mockReset()
    .mockImplementation(async (operation) => {
      if (operation === 'reserveManual') return reservation;
      return { status: 'manual_uncertain' };
    });
});

it('locks a dispatch and marks a timeout uncertain without resending', async () => {
  const fetchMock = jest.spyOn(global, 'fetch').mockRejectedValueOnce(new Error('timeout'));
  const response = await POST(request());
  expect(response.status).toBe(200);
  expect((await response.json()).outcome).toBe('uncertain');
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(callPrintDomain).toHaveBeenCalledWith(
    'reserveManual',
    { ticketId, printRequestId, partnerId, proofVersion: 3, checkedInbox: true },
    'admin@mythoria.pt',
  );
  expect(callPrintDomain).toHaveBeenLastCalledWith(
    'finalizeManual',
    { ticketId, printRequestId, reservationId, outcome: 'uncertain' },
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
  const sent = fetchMock.mock.calls[0][1];
  expect(sent?.headers).toMatchObject({ 'Idempotency-Key': `manual-print:${reservationId}` });
  expect(JSON.parse(String(sent?.body))).toMatchObject({
    toEmail: 'printer@example.com',
    proofFiles,
    downloadLinks: reservation.downloadLinks,
  });
  expect(callPrintDomain).toHaveBeenLastCalledWith(
    'finalizeManual',
    expect.objectContaining({ outcome: 'sent' }),
    'admin@mythoria.pt',
  );
  fetchMock.mockRestore();
});

it('requires an explicit review of a specific proof version and an active printer', async () => {
  expect((await POST(request({ checkedInbox: false }))).status).toBe(400);
  expect((await POST(request({ proofVersion: 0 }))).status).toBe(400);
  mockFindPartner.mockResolvedValueOnce([
    { type: 'printer', status: 'hidden', email: 'printer@example.com' },
  ]);
  expect((await POST(request())).status).toBe(400);
  expect(callPrintDomain).not.toHaveBeenCalled();
});

it('does not dispatch when the proof reservation lacks immutable file identity', async () => {
  jest.mocked(callPrintDomain).mockResolvedValueOnce({ ...reservation, proofFiles: undefined });
  const fetchMock = jest.spyOn(global, 'fetch');
  const log = jest.spyOn(console, 'error').mockImplementation(() => {});
  try {
    expect((await POST(request())).status).toBe(500);
    expect(fetchMock).not.toHaveBeenCalled();
  } finally {
    fetchMock.mockRestore();
    log.mockRestore();
  }
});
