import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
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
  fireEvent.click(release);
  expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({
    operation: 'submit',
    ticketId,
    confirmationId: ticketId,
    checkedInbox: true,
    confirmedTotalEur: 20,
    proofVersion: 3,
  });
});
