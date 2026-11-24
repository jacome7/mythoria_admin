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
