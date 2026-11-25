/** @jest-environment node */
import { NextResponse } from 'next/server';
import { POST } from '@/app/api/admin/stories/[storyId]/lulu-print/route';
import { authenticateAdmin } from '@/lib/api-helpers';
import { logAdminAudit } from '@/lib/audit';
import { callPrintDomain, PrintDomainError } from '@/services/print';

jest.mock('@/lib/api-helpers', () => ({ authenticateAdmin: jest.fn() }));
jest.mock('@/lib/audit', () => ({ logAdminAudit: jest.fn() }));
jest.mock('@/services/print', () => ({
  callPrintDomain: jest.fn(),
  PrintDomainError: class extends Error {
    constructor(
      public readonly status: number,
      message: string,
    ) {
      super(message);
    }
  },
}));

const storyId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const ticketId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const printRequestId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const validBody = {
  bookFormat: 'standard_a5',
  binding: 'hardcover',
  copies: 2,
  orderKind: 'admin_order',
  provider: 'lulu',
  shippingAddress: {
    name: 'Admin User',
    street1: 'Rua do Exemplo 10',
    city: 'Lisbon',
    postcode: '1000-001',
    country_code: 'PT',
    phone_number: '+351210000000',
    email: 'admin@mythoria.pt',
  },
};

const req = (body: unknown, origin?: string) =>
  new Request(`http://localhost/api/admin/stories/${storyId}/lulu-print`, {
    method: 'POST',
    headers: origin ? { origin } : undefined,
    body: JSON.stringify(body),
  });

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(authenticateAdmin).mockResolvedValue({ email: 'admin@mythoria.pt' } as never);
});

it('rejects unauthenticated and cross-origin requests', async () => {
  jest.mocked(authenticateAdmin).mockResolvedValueOnce({
    error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
  });
  expect((await POST(req(validBody), { params: Promise.resolve({ storyId }) })).status).toBe(401);

  expect(
    (
      await POST(req(validBody, 'https://evil.example'), {
        params: Promise.resolve({ storyId }),
      })
    ).status,
  ).toBe(403);
  expect(callPrintDomain).not.toHaveBeenCalled();
});

it('validates square hardcover and staff_proof single-copy rules', async () => {
  expect(
    (
      await POST(req({ ...validBody, bookFormat: 'premium_square', binding: 'paperback' }), {
        params: Promise.resolve({ storyId }),
      })
    ).status,
  ).toBe(400);
  expect(
    (
      await POST(req({ ...validBody, orderKind: 'staff_proof', copies: 2 }), {
        params: Promise.resolve({ storyId }),
      })
    ).status,
  ).toBe(400);
});

it('audits metadata without PII, creates the order, and prepares proof immediately', async () => {
  jest
    .mocked(callPrintDomain)
    .mockResolvedValueOnce({ ticketId, printRequestId })
    .mockResolvedValueOnce({ status: 'proof_ready' });

  const response = await POST(req(validBody), { params: Promise.resolve({ storyId }) });
  expect(response.status).toBe(201);
  expect(await response.json()).toEqual({
    data: { ticketId, printRequestId, fulfillment: { status: 'proof_ready' } },
  });

  expect(logAdminAudit).toHaveBeenCalledWith({
    actorEmail: 'admin@mythoria.pt',
    action: 'story.lulu_print_order_created',
    entityType: 'story',
    entityId: storyId,
    metadata: {
      bookFormat: 'standard_a5',
      binding: 'hardcover',
      copies: 2,
      orderKind: 'admin_order',
      provider: 'lulu',
      legacyTicketId: null,
    },
  });
  expect(callPrintDomain).toHaveBeenNthCalledWith(
    1,
    'createAdminOrder',
    { storyId, ...validBody },
    'admin@mythoria.pt',
  );
  expect(callPrintDomain).toHaveBeenNthCalledWith(
    2,
    'prepare',
    { ticketId, printRequestId, runImmediately: true },
    'admin@mythoria.pt',
  );
});

it('returns a warning instead of failing if immediate preparation throws after ticket creation', async () => {
  jest
    .mocked(callPrintDomain)
    .mockResolvedValueOnce({ ticketId, printRequestId })
    .mockRejectedValueOnce(new PrintDomainError(502, 'Render timed out'));

  const response = await POST(req(validBody), { params: Promise.resolve({ storyId }) });
  expect(response.status).toBe(201);
  expect(await response.json()).toEqual({
    data: { ticketId, printRequestId, prepareWarning: 'Render timed out' },
  });
});
