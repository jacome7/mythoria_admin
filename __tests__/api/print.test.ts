/** @jest-environment node */
import { POST } from '@/app/api/admin/print/route';
import { authenticateAdmin } from '@/lib/api-helpers';
import { logAdminAudit } from '@/lib/audit';
import { TicketService } from '@/lib/ticketing/service';
import { callPrintDomain, PrintDomainError } from '@/services/print';

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

const id = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
const printId = 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb';
const confirmationId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const req = (body: unknown) =>
  new Request('http://localhost/api/admin/print', { method: 'POST', body: JSON.stringify(body) });
beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(authenticateAdmin).mockResolvedValue({ email: 'admin@mythoria.pt' });
  jest.mocked(TicketService.getTicketById).mockResolvedValue({
    id,
    category: 'print_request',
    status: 'open',
    metadata: { printRequestId: printId },
  } as never);
  jest.mocked(callPrintDomain).mockResolvedValue({ status: 'proof_ready' });
});

it('requires explicit inbox and quote confirmation before submitting', async () => {
  const response = await POST(
    req({
      operation: 'submit',
      ticketId: id,
      confirmationId,
      checkedInbox: false,
      confirmedTotalEur: 12,
    }),
  );
  expect(response.status).toBe(400);
  expect(callPrintDomain).not.toHaveBeenCalled();
});

it('requires explicit customer confirmation before correcting an address', async () => {
  const response = await POST(
    req({
      operation: 'correctShipping',
      ticketId: id,
      customerConfirmed: false,
      shippingAddress: {
        name: 'A',
        street1: '1 Road',
        city: 'Lisbon',
        postcode: '1000',
        country_code: 'PT',
        phone_number: '123',
        email: 'a@example.com',
      },
    }),
  );
  expect(response.status).toBe(400);
  expect(callPrintDomain).not.toHaveBeenCalled();
});

it('uses the server-side ticket link and audits the submission', async () => {
  const response = await POST(
    req({
      operation: 'submit',
      ticketId: id,
      printRequestId: 'forged',
      confirmationId,
      checkedInbox: true,
      confirmedTotalEur: 12,
    }),
  );
  expect(response.status).toBe(200);
  expect(callPrintDomain).toHaveBeenCalledWith(
    'submit',
    {
      ticketId: id,
      printRequestId: printId,
      confirmationId,
      checkedInbox: true,
      confirmedTotalEur: 12,
    },
    'admin@mythoria.pt',
  );
  expect(logAdminAudit).toHaveBeenCalledWith(
    expect.objectContaining({ action: 'print.submit', entityId: id }),
  );
});

it('rejects a cross-origin request before sending any print command', async () => {
  const response = await POST(
    new Request('http://localhost/api/admin/print', {
      method: 'POST',
      headers: { origin: 'https://another-site.example' },
      body: JSON.stringify({ operation: 'getConfig' }),
    }),
  );
  expect(response.status).toBe(403);
  expect(callPrintDomain).not.toHaveBeenCalled();
});

it('rejects mutations on resolved tickets and propagates domain conflicts', async () => {
  jest.mocked(TicketService.getTicketById).mockResolvedValueOnce({
    id,
    category: 'print_request',
    status: 'resolved',
    metadata: { printRequestId: printId },
  } as never);
  expect((await POST(req({ operation: 'prepare', ticketId: id }))).status).toBe(409);
  jest
    .mocked(callPrintDomain)
    .mockRejectedValueOnce(new PrintDomainError(409, 'Already submitted'));
  expect((await POST(req({ operation: 'prepare', ticketId: id }))).status).toBe(409);
});

it('preserves hardcover settings when omitted and audits the successful before and after', async () => {
  const before = { defaultProvider: 'none', maxEurPerCopy: 5, hardcoverCredits: 12 };
  const after = { defaultProvider: 'lulu', maxEurPerCopy: 7, hardcoverCredits: 12 };
  jest
    .mocked(callPrintDomain)
    .mockReset()
    .mockResolvedValueOnce(before)
    .mockResolvedValueOnce(after);
  const response = await POST(
    req({ operation: 'setConfig', defaultProvider: 'lulu', maxEurPerCopy: 7 }),
  );
  expect(response.status).toBe(200);
  expect(callPrintDomain).toHaveBeenLastCalledWith(
    'setConfig',
    { defaultProvider: 'lulu', maxEurPerCopy: 7 },
    'admin@mythoria.pt',
  );
  expect(logAdminAudit).toHaveBeenCalledWith(
    expect.objectContaining({
      action: 'print.settings_updated',
      actorEmail: 'admin@mythoria.pt',
      metadata: expect.objectContaining({
        outcome: 'success',
        previous: expect.objectContaining(before),
        current: expect.objectContaining(after),
      }),
    }),
  );
});

it('accepts explicit hardcover activation or deactivation and rejects invalid prices', async () => {
  for (const value of [null, 18]) {
    jest
      .mocked(callPrintDomain)
      .mockReset()
      .mockResolvedValueOnce({ defaultProvider: 'none', maxEurPerCopy: 5, hardcoverCredits: null })
      .mockResolvedValueOnce({
        defaultProvider: 'none',
        maxEurPerCopy: 5,
        hardcoverCredits: value,
      });
    expect(
      (
        await POST(
          req({
            operation: 'setConfig',
            defaultProvider: 'none',
            maxEurPerCopy: 5,
            hardcoverCredits: value,
          }),
        )
      ).status,
    ).toBe(200);
    expect(callPrintDomain).toHaveBeenLastCalledWith(
      'setConfig',
      { defaultProvider: 'none', maxEurPerCopy: 5, hardcoverCredits: value },
      'admin@mythoria.pt',
    );
  }
  expect(
    (
      await POST(
        req({
          operation: 'setConfig',
          defaultProvider: 'none',
          maxEurPerCopy: 5,
          hardcoverCredits: 1.5,
        }),
      )
    ).status,
  ).toBe(400);
});
