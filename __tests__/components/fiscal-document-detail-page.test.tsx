import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import FiscalDocumentDetailPage from '@/app/fiscal-documents/[id]/page';
import { useAdminAuth } from '@/lib/hooks/useAdminAuth';
import { useParams } from 'next/navigation';

jest.mock('@/lib/hooks/useAdminAuth', () => ({
  useAdminAuth: jest.fn(),
}));

jest.mock('next/navigation', () => ({
  useParams: jest.fn(),
}));

const mockUseAdminAuth = jest.mocked(useAdminAuth);
const mockUseParams = jest.mocked(useParams);
const originalFetch = global.fetch;

function fiscalDocument(overrides: Record<string, unknown> = {}) {
  return {
    id: 'doc-id',
    orderId: 'order-id',
    authorId: 'author-id',
    provider: 'keyinvoice',
    status: 'failed',
    docType: '34',
    docSeries: '23',
    docNum: null,
    fullDocNumber: null,
    atDocCodeId: null,
    grossTotal: null,
    netTotal: null,
    taxTotal: null,
    vatRate: '6.00',
    taxId: '3',
    customerMode: 'final_consumer',
    keyInvoiceClientId: null,
    finalConsumerVatNumber: '999999990',
    stripeCheckoutSessionId: 'cs_test',
    stripePaymentIntentId: 'pi_test',
    pdfStoragePath: null,
    pdfSha256: null,
    lastError: 'Could not generate file data',
    attemptCount: 4,
    nextRetryAt: null,
    issuedAt: null,
    createdAt: '2026-07-01T00:56:00.000Z',
    updatedAt: '2026-07-01T22:06:00.000Z',
    needsAttention: true,
    retryableNow: true,
    attentionPriority: 'high',
    paymentOrder: {
      orderId: 'order-id',
      amount: 4300,
      currency: 'EUR',
      status: 'completed',
      provider: 'stripe',
      providerOrderId: 'cs_test',
      providerPublicId: 'pi_test',
      creditBundle: { price: 43, credits: 50 },
      metadata: {
        stripe: {
          paymentStatus: 'paid',
          customerDetails: {
            address: {
              line1: 'Praca do Comercio 96',
              postal_code: '4720-337',
              city: 'Ferreiros',
              country: 'PT',
            },
          },
        },
      },
      createdAt: '2026-07-01T00:56:00.000Z',
      updatedAt: '2026-07-01T00:56:00.000Z',
    },
    author: {
      authorId: 'author-id',
      displayName: 'Susana',
      email: 'susana@example.com',
      fiscalNumber: 'PT123456789',
    },
    keyInvoiceCustomer: null,
    events: [],
    ...overrides,
  };
}

describe('FiscalDocumentDetailPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseParams.mockReturnValue({ id: 'doc-id' });
    mockUseAdminAuth.mockReturnValue({
      loading: false,
      session: {
        user: {
          email: 'admin@mythoria.pt',
          name: 'Admin',
        },
      },
    } as never);
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('separates KeyInvoice VAT, profile VAT, and final-consumer VAT', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      new Response(
        JSON.stringify(
          fiscalDocument({
            customerMode: 'keyinvoice_client',
            keyInvoiceClientId: '1005',
            finalConsumerVatNumber: null,
            keyInvoiceCustomer: {
              id: 'customer-id',
              vatin: '231292686',
              keyInvoiceClientId: '1005',
              name: 'Susana',
              email: 'susana@example.com',
              phone: null,
              countryCode: 'PT',
              address: 'Praca do Comercio 96',
              postalCode: '4720-337',
              locality: 'Ferreiros',
            },
          }),
        ),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    render(<FiscalDocumentDetailPage />);

    expect(await screen.findByText('KeyInvoice/customer VAT')).toBeInTheDocument();
    expect(screen.getByText('Profile VAT/NIF')).toBeInTheDocument();
    expect(screen.getByText('Final consumer VAT')).toBeInTheDocument();
    expect(screen.getByText('231292686')).toBeInTheDocument();
    expect(screen.getByText('PT123456789')).toBeInTheDocument();
  });

  it('labels failed documents that already exist in KeyInvoice as post-issue failures', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      new Response(JSON.stringify(fiscalDocument({ docNum: '9', fullDocNumber: '34 23/9' })), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    render(<FiscalDocumentDetailPage />);

    await waitFor(() => {
      expect(screen.getByText(/Remote KeyInvoice document exists/)).toBeInTheDocument();
    });
  });

  it.each([
    ['failed', {}],
    ['pending', {}],
    ['draft', {}],
    ['issuing', { updatedAt: '2000-01-01T00:00:00.000Z' }],
  ])('shows manual mark-issued action for %s documents', async (status, overrides) => {
    global.fetch = jest.fn().mockResolvedValue(
      new Response(JSON.stringify(fiscalDocument({ status, ...overrides })), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    render(<FiscalDocumentDetailPage />);

    expect(await screen.findByRole('button', { name: 'Mark issued manually' })).toBeInTheDocument();
  });

  it.each([
    ['issued', {}],
    ['credit_note_issued', {}],
    ['voided', {}],
    ['credit_note_required', {}],
    ['issuing', { updatedAt: new Date().toISOString() }],
  ])('hides manual mark-issued action for %s documents', async (status, overrides) => {
    global.fetch = jest.fn().mockResolvedValue(
      new Response(JSON.stringify(fiscalDocument({ status, ...overrides })), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    render(<FiscalDocumentDetailPage />);

    await screen.findByText('Fiscal Document');
    expect(screen.queryByRole('button', { name: 'Mark issued manually' })).not.toBeInTheDocument();
  });

  it('requires invoice identity, reason, and confirmation before manual mark-issued submit', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      new Response(JSON.stringify(fiscalDocument()), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    render(<FiscalDocumentDetailPage />);

    fireEvent.click(await screen.findByRole('button', { name: 'Mark issued manually' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Mark issued' }));

    expect(
      await screen.findByText(
        'Fill the mandatory fields and confirm the reconciliation statement.',
      ),
    ).toBeInTheDocument();
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('submits manual mark-issued data and refreshes the fiscal document', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify(fiscalDocument()), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify(
            fiscalDocument({
              status: 'issued',
              docNum: '9',
              fullDocNumber: '34 23/9',
              issuedAt: '2026-07-01T12:00:00.000Z',
              needsAttention: false,
              retryableNow: false,
              attentionPriority: 'none',
            }),
          ),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          },
        ),
      );
    global.fetch = fetchMock;

    render(<FiscalDocumentDetailPage />);

    fireEvent.click(await screen.findByRole('button', { name: 'Mark issued manually' }));
    await screen.findByRole('button', { name: 'Mark issued' });
    fireEvent.change(screen.getByLabelText('Doc number'), { target: { value: '9' } });
    fireEvent.change(screen.getByLabelText('Operational reason'), {
      target: { value: 'Invoice verified in KeyInvoice after PDF recovery.' },
    });
    fireEvent.click(screen.getByLabelText(/I confirm this invoice exists/));
    fireEvent.click(screen.getByRole('button', { name: 'Mark issued' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/admin/fiscal-documents/doc-id/mark-issued',
        expect.objectContaining({ method: 'POST' }),
      );
    });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    const body = JSON.parse(fetchMock.mock.calls[1][1]?.body as string);
    expect(body).toEqual(
      expect.objectContaining({
        docType: '34',
        docSeries: '23',
        docNum: '9',
        reason: 'Invoice verified in KeyInvoice after PDF recovery.',
        confirmation: true,
      }),
    );
    expect((await screen.findAllByText('Issued')).length).toBeGreaterThan(0);
  });
});
