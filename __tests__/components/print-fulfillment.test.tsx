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
  render(<PrintFulfillment ticketId={ticketId} closed={false} />);

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
  render(<PrintFulfillment ticketId={ticketId} closed={false} />);
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
  'blocks square Lulu actions while retaining manual preparation (%s)',
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
    render(<PrintFulfillment ticketId={ticketId} closed={false} />);
    expect(await screen.findByText('This edition is not approved for Lulu.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Prepare for Lulu' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Prepare for manual printer' })).toBeEnabled();
    if (provider === 'lulu') {
      expect(screen.getByRole('button', { name: 'Prepare proof and quote' })).toBeDisabled();
      fireEvent.click(screen.getByLabelText('I reviewed staff proof version 3.'));
      fireEvent.change(screen.getByLabelText('Confirm total EUR'), { target: { value: '20' } });
      expect(screen.getByRole('button', { name: 'Submit one proof to Lulu' })).toBeDisabled();
    } else {
      expect(screen.getByRole('button', { name: 'Prepare proof' })).toBeEnabled();
    }
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

  render(<PrintFulfillment ticketId={ticketId} closed={false} />);
  expect(await screen.findByText(/Fund your Lulu Developer account/i)).toBeInTheDocument();
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
  render(<PrintFulfillment ticketId={ticketId} closed={false} />);
  const submit = await screen.findByRole('button', { name: 'Submit to Lulu' });
  expect(submit).toBeDisabled();
  expect(screen.getByText(/Admin print order · 3 copies/i)).toBeInTheDocument();
  fireEvent.click(screen.getByLabelText('I reviewed admin proof version 3.'));
  fireEvent.change(screen.getByLabelText('Confirm total EUR'), { target: { value: '60' } });
  expect(submit).toBeEnabled();
});
