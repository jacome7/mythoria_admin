/** @jest-environment node */
import { NextResponse } from 'next/server';
import { POST as legacyPost } from '@/app/api/admin/stories/[storyId]/lulu-print/route';
import { GET, POST } from '@/app/api/admin/stories/[storyId]/print-orders/route';
import { authenticateAdmin } from '@/lib/api-helpers';
import { logAdminAudit } from '@/lib/audit';
import { callPrintDomain, PrintDomainError } from '@/services/print';
import { getAdminPrintStory } from '@/services/admin-print-story';

jest.mock('@/lib/api-helpers', () => ({ authenticateAdmin: jest.fn() }));
jest.mock('@/lib/audit', () => ({ logAdminAudit: jest.fn() }));
jest.mock('@/services/admin-print-story', () => ({ getAdminPrintStory: jest.fn() }));
jest.mock('@/services/print', () => ({
  callPrintDomain: jest.fn(),
  PrintDomainError: class extends Error {
    constructor(
      public readonly status: number,
      message: string,
      public readonly code?: string,
    ) {
      super(message);
    }
  },
}));

const storyId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const ticketId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const printRequestId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const intentId = 'dddddddd-dddd-4ddd-addd-dddddddddddd';
const legacyBody = {
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
const validBody = { ...legacyBody, intentId };

const req = (body: unknown, origin?: string) =>
  new Request(`http://localhost/api/admin/stories/${storyId}/print-orders`, {
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

it('requires an intent reference before creating the order', async () => {
  const response = await POST(req({ ...validBody, intentId: undefined }), {
    params: Promise.resolve({ storyId }),
  });
  expect(response.status).toBe(400);
  expect(callPrintDomain).not.toHaveBeenCalled();
});

it('does not retry with the legacy operation when WebApp cannot accept the new command', async () => {
  jest
    .mocked(callPrintDomain)
    .mockRejectedValueOnce(new PrintDomainError(400, 'Invalid print command'));

  const response = await POST(req(validBody), { params: Promise.resolve({ storyId }) });

  expect(response.status).toBe(400);
  expect(callPrintDomain).toHaveBeenCalledTimes(1);
  expect(callPrintDomain).toHaveBeenCalledWith(
    'createAdminOrderV2',
    { storyId, ...validBody },
    'admin@mythoria.pt',
  );
  expect(logAdminAudit).not.toHaveBeenCalled();
});

it('preserves old client creation and rejects intent-bearing requests on its legacy route', async () => {
  function postLegacy(body: unknown) {
    return legacyPost(
      new Request(`http://localhost/api/admin/stories/${storyId}/lulu-print`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
      { params: Promise.resolve({ storyId }) },
    );
  }

  expect((await postLegacy(validBody)).status).toBe(400);
  expect(callPrintDomain).not.toHaveBeenCalled();

  jest.mocked(callPrintDomain).mockResolvedValueOnce({ ticketId, printRequestId });
  expect((await postLegacy({ ...legacyBody, prepareNow: false })).status).toBe(201);
  expect(callPrintDomain).toHaveBeenCalledTimes(1);
  expect(callPrintDomain).toHaveBeenCalledWith(
    'createAdminOrder',
    { storyId, ...legacyBody },
    'admin@mythoria.pt',
  );
});

it('requires an original ticket for separate legacy shipment confirmation', async () => {
  const response = await POST(req({ ...validBody, confirmSeparateLegacyShipment: true }), {
    params: Promise.resolve({ storyId }),
  });
  expect(response.status).toBe(400);
  expect(callPrintDomain).not.toHaveBeenCalled();
});

it('returns possible paid matches and forwards explicit confirmation on the same legacy intent', async () => {
  const legacyInput = { ...validBody, legacyTicketId: ticketId };
  const possibleMatch = {
    status: 'possible_match',
    matches: [
      {
        ticketId: 'eeeeeeee-eeee-4eee-aeee-eeeeeeeeeeee',
        printRequestId,
        purpose: 'paid',
        countryCode: 'PT',
        copies: 2,
        bookFormat: 'standard_a5',
      },
    ],
  };
  jest.mocked(callPrintDomain).mockResolvedValueOnce(possibleMatch);
  const initial = await POST(req(legacyInput), { params: Promise.resolve({ storyId }) });
  expect(await initial.json()).toEqual({ data: possibleMatch });
  expect(logAdminAudit).not.toHaveBeenCalled();

  jest.mocked(callPrintDomain).mockResolvedValueOnce({ ticketId, printRequestId });
  const confirmed = await POST(
    req({ ...legacyInput, confirmSeparateLegacyShipment: true, prepareNow: false }),
    {
      params: Promise.resolve({ storyId }),
    },
  );
  expect(confirmed.status).toBe(201);
  expect(callPrintDomain).toHaveBeenLastCalledWith(
    'createAdminOrderV2',
    {
      storyId,
      ...legacyInput,
      confirmSeparateLegacyShipment: true,
    },
    'admin@mythoria.pt',
  );
  expect(logAdminAudit).toHaveBeenCalledWith(
    expect.objectContaining({
      metadata: expect.objectContaining({
        confirmSeparateLegacyShipment: true,
        legacyTicketId: ticketId,
      }),
    }),
  );
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
      printRequestId,
    },
  });
  expect(callPrintDomain).toHaveBeenNthCalledWith(
    1,
    'createAdminOrderV2',
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

it('reads a paid match without including address details from that order', async () => {
  const match = {
    ticketId,
    printRequestId,
    purpose: 'paid',
    countryCode: 'PT',
    copies: 2,
    bookFormat: 'standard_a5',
  };
  jest.mocked(getAdminPrintStory).mockResolvedValueOnce({ premiumRevision: undefined });
  jest
    .mocked(callPrintDomain)
    .mockResolvedValueOnce([{ ...match, shippingAddress: validBody.shippingAddress }]);
  const response = await GET(
    new Request(`http://localhost/api/admin/stories/${storyId}/print-orders`),
    {
      params: Promise.resolve({ storyId }),
    },
  );
  expect(response.status).toBe(200);
  expect(response.headers.get('Cache-Control')).toBe('private, no-store');
  expect(await response.json()).toEqual({ data: { matches: [match] } });
});

it('recovers the previous request without repeating preparation or requesting contact details', async () => {
  jest.mocked(callPrintDomain).mockResolvedValueOnce({ ticketId, printRequestId, reused: true });
  const response = await POST(req({ operation: 'recover', intentId }), {
    params: Promise.resolve({ storyId }),
  });
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ data: { ticketId, printRequestId, reused: true } });
  expect(callPrintDomain).toHaveBeenCalledTimes(1);
  expect(callPrintDomain).toHaveBeenCalledWith(
    'recoverAdminOrder',
    { storyId, intentId },
    'admin@mythoria.pt',
  );
  expect(logAdminAudit).not.toHaveBeenCalled();
});

it('passes through the conflict code for changed data on the same intent', async () => {
  jest
    .mocked(callPrintDomain)
    .mockRejectedValueOnce(
      new PrintDomainError(
        409,
        'The request already has different details.',
        'print_intent_conflict',
      ),
    );
  const response = await POST(req(validBody), { params: Promise.resolve({ storyId }) });
  expect(response.status).toBe(409);
  expect(await response.json()).toEqual({
    error: 'The request already has different details.',
    code: 'print_intent_conflict',
  });
  expect(logAdminAudit).not.toHaveBeenCalled();
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
