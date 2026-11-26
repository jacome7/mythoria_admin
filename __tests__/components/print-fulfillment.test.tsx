import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { PrintFulfillment, PrintSettings } from '@/components/PrintFulfillment';

const ticketId = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
const manualOrder = {
  provider: 'manual',
  status: 'proof_ready',
  proofVersion: 3,
  copies: 1,
  binding: 'paperback',
  proof: {
    qaPassed: true,
    pageCount: 36,
    interiorUrl: 'https://print.example/interior',
    coverUrl: 'https://print.example/cover',
    sentAt: '2026-11-24',
    issues: ['image_below_300_ppi'],
  },
  holdReason: null,
  quote: null,
  vendor: null,
  lastError: null,
  maxEurPerCopy: 0,
  shippingAddress: { name: 'Customer', street1: 'Street', city: 'Lisbon', country_code: 'PT' },
  taxIdPresent: false,
};

const fetchMock = jest.fn();
const originalFetch = globalThis.fetch;
beforeEach(() => {
  fetchMock.mockReset();
  globalThis.fetch = fetchMock;
});
afterEach(() => {
  globalThis.fetch = originalFetch;
});

function json(data: unknown) {
  return { ok: true, json: async () => ({ data }) };
}

it('compares entered and suggested delivery fields and requires fresh confirmation after edits', async () => {
  fetchMock.mockResolvedValue(
    json({
      ...manualOrder,
      provider: 'lulu',
      status: 'held',
      holdReason: 'Confirm delivery address',
      addressReview: { proofVersion: 3, suggested: { city: 'Porto' } },
    }),
  );
  render(<PrintFulfillment ticketId={ticketId} ticketStatus="open" />);
  expect(await screen.findByRole('table', { name: 'Lulu address check' })).toHaveTextContent(
    'Lisbon',
  );
  fireEvent.click(screen.getByRole('button', { name: 'Use suggested fields' }));
  expect(screen.getByLabelText('City')).toHaveValue('Porto');
  const confirm = screen.getByText('The customer confirmed this address.');
  fireEvent.click(confirm);
  fireEvent.change(screen.getByLabelText('City'), { target: { value: 'Gaia' } });
  expect(screen.getByRole('button', { name: 'Save customer-confirmed address' })).toBeDisabled();
});

it('keeps settings disabled until the configured defaults are loaded', async () => {
  fetchMock.mockResolvedValueOnce(
    json({ defaultProvider: 'none', maxEurPerCopy: 0, hardcoverCredits: null }),
  );
  render(<PrintSettings />);

  expect(screen.getByRole('button', { name: 'Save settings' })).toBeDisabled();
  expect(await screen.findByDisplayValue('0')).toBeInTheDocument();
  expect(screen.getByLabelText('Default provider')).toHaveValue('none');
  expect(screen.getByLabelText('Enable hardcover pricing')).not.toBeChecked();
});

it('shows nonblocking proof warnings and requires an inbox check for manual dispatch', async () => {
  fetchMock.mockResolvedValueOnce(json(manualOrder)).mockResolvedValueOnce(
    json([
      {
        id: 'printer',
        type: 'printer',
        status: 'active',
        email: 'printer@example.com',
        name: 'Printer One',
      },
      {
        id: 'hidden',
        type: 'printer',
        status: 'hidden',
        email: 'hidden@example.com',
        name: 'Hidden Printer',
      },
    ]),
  );
  render(<PrintFulfillment ticketId={ticketId} ticketStatus="open" />);

  expect(await screen.findByText('An image is below 300 PPI.')).toBeInTheDocument();
  expect(
    screen.getByRole('heading', { name: 'Shipping address for this order' }),
  ).toBeInTheDocument();
  expect(screen.getByText('Street')).toBeInTheDocument();
  expect(await screen.findByRole('option', { name: 'Printer One' })).toBeInTheDocument();
  expect(screen.queryByRole('option', { name: 'Hidden Printer' })).not.toBeInTheDocument();
  fireEvent.change(screen.getByRole('combobox', { name: 'Printer' }), {
    target: { value: 'printer' },
  });
  const send = screen.getByRole('button', { name: 'Send print request' });
  expect(send).toBeDisabled();
  fireEvent.click(screen.getByLabelText('I checked the inbox and reviewed proof version 3.'));
  expect(send).toBeEnabled();
});

it('releases only the current square proof through Lulu after explicit review and quote confirmation', async () => {
  const squareOrder = {
    ...manualOrder,
    provider: 'lulu',
    binding: 'hardcover',
    maxEurPerCopy: 25,
    squareEdition: {
      revision: ticketId,
      manifest: { key: 'key', generation: '1', sha256: 'a'.repeat(64), bytes: 512 },
      podPackageId: '0850X0850FCPRECW080CW444MXX',
      luluEnvironment: 'sandbox',
    },
    proof: { ...manualOrder.proof, pageCount: 32, supplierValidated: true },
    quote: { shippingLevel: 'EXPRESS', totalEur: 20, perCopyEur: 20, confirmationId: ticketId },
  };
  fetchMock.mockResolvedValue(json(squareOrder));
  render(<PrintFulfillment ticketId={ticketId} ticketStatus="open" />);
  const release = await screen.findByRole('button', { name: 'Release square order to Lulu' });
  expect(release).toBeDisabled();
  expect(screen.queryByRole('button', { name: 'Select manual' })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Prepare for manual printer' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Send print request' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByLabelText('I checked the inbox and reviewed proof version 3.'));
  fireEvent.change(screen.getByLabelText('Confirm total EUR'), { target: { value: '20' } });
  expect(release).toBeEnabled();
  await act(async () => {
    fireEvent.click(release);
  });
  expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({
    operation: 'submit',
    ticketId,
    confirmationId: ticketId,
    checkedInbox: true,
    confirmedTotalEur: 20,
    proofVersion: 3,
  });
});

it.each(['lulu', 'manual'])(
  'blocks square Lulu actions while keeping manual fulfillment available (%s)',
  async (provider) => {
    const order = {
      ...manualOrder,
      provider,
      binding: 'hardcover',
      proofOnly: true,
      maxEurPerCopy: 25,
      squareLuluBlockReason: 'This edition is not approved for Lulu.',
      squareEdition: {
        revision: ticketId,
        manifest: { key: 'key', generation: '1', sha256: 'a'.repeat(64), bytes: 512 },
      },
      proof: { ...manualOrder.proof, supplierValidated: true },
      quote: { shippingLevel: 'EXPRESS', totalEur: 20, perCopyEur: 20, confirmationId: ticketId },
    };
    fetchMock.mockResolvedValue(json(order));
    render(<PrintFulfillment ticketId={ticketId} ticketStatus="open" />);
    expect(await screen.findByText(/This edition is not approved for Lulu\./)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Prepare for Lulu' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Prepare for manual printer' })).toBeEnabled();
    expect(
      screen.queryByRole('button', { name: 'Prepare proof and quote' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Submit one proof to Lulu' }),
    ).not.toBeInTheDocument();
  },
);

it('shows UNPAID operational alert and supports canceling a cancelable Lulu job', async () => {
  const unpaidOrder = {
    ...manualOrder,
    provider: 'lulu',
    status: 'submitted',
    vendor: {
      id: '7701',
      status: 'UNPAID',
      unpaid: true,
      cancelable: true,
      environment: 'sandbox',
      tracking: [],
      costs: { currency: 'EUR', total: 24.5, amountExclTax: '20.00', fees: [] },
    },
    quote: { shippingLevel: 'GROUND', totalEur: 24.5, perCopyEur: 24.5, confirmationId: ticketId },
  };
  const canceledOrder = {
    ...unpaidOrder,
    vendor: { ...unpaidOrder.vendor, status: 'CANCELED', unpaid: false, cancelable: false },
  };
  fetchMock.mockResolvedValueOnce(json(unpaidOrder)).mockResolvedValueOnce(json(canceledOrder));

  render(<PrintFulfillment ticketId={ticketId} ticketStatus="open" />);
  expect(
    await screen.findByText(/Pay for this job in the Lulu Developer Portal/i),
  ).toBeInTheDocument();
  expect(screen.queryByLabelText('Confirm total EUR')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Put on hold' })).not.toBeInTheDocument();
  const cancelBtn = screen.getByRole('button', { name: 'Cancel Lulu job' });
  expect(cancelBtn).toBeDisabled();
  fireEvent.change(screen.getByLabelText('Cancellation reason'), {
    target: { value: 'Fix shipping postcode' },
  });
  expect(cancelBtn).toBeEnabled();
  await act(async () => {
    fireEvent.click(cancelBtn);
  });
  expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({
    operation: 'cancel',
    ticketId,
    reason: 'Fix shipping postcode',
  });
  expect(await screen.findByText(/Lulu order 7701: CANCELED/i)).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Cancellation follow-up' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'ticket comments' })).toHaveAttribute(
    'href',
    '#ticket-comments',
  );
  expect(screen.getByRole('button', { name: 'Refresh order' })).toBeEnabled();
  expect(screen.queryByRole('button', { name: 'Cancel Lulu job' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Prepare proof and quote' })).not.toBeInTheDocument();
  const history = screen.getByText('Print state and history').closest('details');
  expect(history).toHaveTextContent('Support ticket statusopen');
  expect(history).toHaveTextContent('Mythoria fulfillment statussubmitted');
  expect(history).toHaveTextContent('Lulu job statusCANCELED');
});

it('allows multi-copy adminOrder Lulu submission without an emailed customer proof timestamp', async () => {
  const adminOrder = {
    ...manualOrder,
    provider: 'lulu',
    binding: 'hardcover',
    copies: 3,
    adminOrder: true,
    maxEurPerCopy: 30,
    proof: {
      ...manualOrder.proof,
      sentAt: null,
      normalizedPageCount: 34,
      coverDimensions: { width: 1368, height: 738 },
      supplierValidated: true,
    },
    quote: { shippingLevel: 'EXPRESS', totalEur: 60, perCopyEur: 20, confirmationId: ticketId },
  };
  fetchMock.mockResolvedValue(json(adminOrder));
  render(<PrintFulfillment ticketId={ticketId} ticketStatus="open" />);
  const submit = await screen.findByRole('button', { name: 'Submit to Lulu' });
  expect(submit).toBeDisabled();
  expect(screen.getByText(/Admin print order · 3 copies/i)).toBeInTheDocument();
  fireEvent.click(screen.getByLabelText('I reviewed admin proof version 3.'));
  fireEvent.change(screen.getByLabelText('Confirm total EUR'), { target: { value: '60' } });
  expect(submit).toBeEnabled();
});

it('offers reconciliation without preparing or releasing an uncertain Lulu order', async () => {
  const order = {
    ...manualOrder,
    provider: 'lulu',
    status: 'uncertain',
    quote: { shippingLevel: 'GROUND', totalEur: 24.5, perCopyEur: 24.5, confirmationId: ticketId },
  };
  fetchMock.mockResolvedValue(json(order));
  render(<PrintFulfillment ticketId={ticketId} ticketStatus="open" />);

  const reconcile = await screen.findByRole('button', { name: 'Reconcile with Lulu' });
  await act(async () => {
    fireEvent.click(reconcile);
  });
  expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ operation: 'reconcile', ticketId });
  expect(screen.queryByLabelText('Confirm total EUR')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Prepare proof and quote' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Select manual' })).not.toBeInTheDocument();
});

it('shows the current hold reason with correction controls and hides release', async () => {
  fetchMock.mockResolvedValueOnce(
    json({
      ...manualOrder,
      provider: 'lulu',
      status: 'held',
      holdReason: 'Customer reported a shipping issue.',
      quote: { shippingLevel: 'EXPRESS', totalEur: 20, perCopyEur: 20, confirmationId: ticketId },
    }),
  );
  render(<PrintFulfillment ticketId={ticketId} ticketStatus="in_progress" />);

  expect(await screen.findByText(/Customer reported a shipping issue/)).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Correct shipping address' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Clear hold' })).toBeEnabled();
  expect(screen.queryByLabelText('Confirm total EUR')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Prepare proof and quote' })).not.toBeInTheDocument();
});

it('shows persisted Lulu shipment tracking on a resolved support ticket', async () => {
  fetchMock.mockResolvedValueOnce(
    json({
      ...manualOrder,
      provider: 'lulu',
      status: 'submitted',
      vendor: {
        id: '7702',
        status: 'SHIPPED',
        createdAt: '2026-11-24T12:00:00Z',
        tracking: ['https://carrier.example/path'],
        lines: [
          {
            id: '1',
            status: {
              name: 'SHIPPED',
              changed: '2026-11-25T12:00:00Z',
              messages: {
                tracking_urls: ['https://carrier.example/path', 'https://carrier.example/second'],
              },
            },
          },
        ],
      },
    }),
  );
  render(<PrintFulfillment ticketId={ticketId} ticketStatus="resolved" />);

  const links = await screen.findAllByRole('link', { name: /Shipment link/ });
  expect(links.map((link) => link.getAttribute('href'))).toEqual([
    'https://carrier.example/path',
    'https://carrier.example/second',
  ]);
  expect(screen.getByRole('button', { name: 'Refresh order' })).toBeEnabled();
  const history = screen.getByText('Print state and history').closest('details');
  expect(history).toHaveTextContent('Lulu job created');
  expect(history).toHaveTextContent('Lulu line 1 changed to SHIPPED');
  expect(screen.queryByRole('button', { name: 'Submit to Lulu' })).not.toBeInTheDocument();
});
