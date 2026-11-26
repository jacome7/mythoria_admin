import { fireEvent, render, screen } from '@testing-library/react';
import { AdminLuluOrderForm } from '@/components/AdminLuluOrderForm';

const storyId = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
const ticketId = 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb';
const printRequestId = 'cccccccc-cccc-4ccc-accc-cccccccccccc';
const premiumRevision = 'dddddddd-dddd-4ddd-addd-dddddddddddd';
const priorIntentId = 'eeeeeeee-eeee-4eee-aeee-eeeeeeeeeeee';
const storageKey = `mythoria:admin-print:${storyId}:new`;
const printOrdersPath = `/api/admin/stories/${storyId}/print-orders`;
const shipping = {
  name: 'Print Recipient',
  email: 'recipient@example.test',
  phone_number: '+351210000000',
  street1: 'Example Street',
  city: 'Lisbon',
  postcode: '1000-001',
  country_code: 'PT',
};
const match = {
  ticketId,
  printRequestId,
  purpose: 'paid',
  countryCode: 'PT',
  copies: 2,
  bookFormat: 'standard_a5',
  orderNumber: 'P-1234',
};

const fetchMock = jest.fn();
const originalFetch = globalThis.fetch;

function ok(data: unknown) {
  return { ok: true, json: async () => ({ data }) };
}

function loadForm(extraContext?: Record<string, unknown>) {
  fetchMock.mockResolvedValueOnce(ok({ customerAddress: shipping, matches: [], ...extraContext }));
  return render(<AdminLuluOrderForm storyId={storyId} />);
}

async function selectCustomer(source = 'customer_confirmed') {
  fireEvent.change(await screen.findByLabelText('Delivery address source'), {
    target: { value: source },
  });
}

beforeEach(() => {
  fetchMock.mockReset();
  globalThis.fetch = fetchMock;
  window.localStorage.clear();
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

it.each([
  { fulfillment: { status: 'pending' }, label: 'Preparing' },
  { fulfillment: { status: 'preparing' }, label: 'Preparing' },
  { fulfillment: { status: 'proof_ready' }, label: 'Ready for review' },
  {
    fulfillment: { status: 'held', holdReason: 'Confirm the shipping address.' },
    label: 'Preparation on hold',
    reason: 'Confirm the shipping address.',
  },
  {
    fulfillment: { status: 'manual_review', lastError: 'Lulu rejected the cover PDF.' },
    label: 'Preparation needs attention',
    reason: 'Lulu rejected the cover PDF.',
  },
  {
    prepareWarning: 'Immediate preparation could not be confirmed.',
    label: 'Ticket created',
    reason: 'Immediate preparation could not be confirmed.',
  },
])('reports $label from the print domain response', async ({ label, reason, ...result }) => {
  loadForm();
  fetchMock.mockResolvedValueOnce(ok({ ticketId, printRequestId, ...result }));
  await selectCustomer();
  fireEvent.click(screen.getByRole('button', { name: 'Create print ticket' }));

  expect(await screen.findByText(label)).toBeInTheDocument();
  if (reason) expect(screen.getByText(reason)).toBeInTheDocument();
  expect(
    screen.getByRole('link', { name: reason ? 'Open existing ticket' : 'Open print ticket' }),
  ).toHaveAttribute('href', `/tickets/${ticketId}`);
});

it('stores one opaque intent before creation and recovers that ticket after a reload', async () => {
  const first = loadForm();
  let sentIntent: string;
  fetchMock.mockImplementationOnce(async (url, options) => {
    expect(url).toBe(printOrdersPath);
    sentIntent = JSON.parse(options.body).intentId;
    expect(window.localStorage.getItem(storageKey)).toBe(sentIntent);
    throw new Error('The connection closed before a response arrived.');
  });
  await selectCustomer();
  const form = screen.getByRole('button', { name: 'Create print ticket' }).closest('form')!;
  fireEvent.submit(form);
  fireEvent.submit(form);
  expect(
    await screen.findByText('Check the previous request before sending it again.'),
  ).toBeInTheDocument();
  expect(fetchMock).toHaveBeenCalledTimes(2);
  first.unmount();

  fetchMock.mockResolvedValueOnce(ok({ customerAddress: shipping, matches: [] }));
  fetchMock.mockResolvedValueOnce(ok({ ticketId, printRequestId, reused: true }));
  render(<AdminLuluOrderForm storyId={storyId} />);
  expect(await screen.findByRole('link', { name: 'Open existing ticket' })).toHaveAttribute(
    'href',
    `/tickets/${ticketId}`,
  );
  expect(fetchMock.mock.calls[3][0]).toBe(printOrdersPath);
  expect(JSON.parse(fetchMock.mock.calls[3][1].body)).toEqual({
    operation: 'recover',
    intentId: sentIntent!,
  });
});

it('keeps the stored request on the new endpoint when Admin rolls back before creation or recovery', async () => {
  loadForm();
  const routeUnavailable = () =>
    Promise.resolve({
      ok: false,
      json: async () => {
        throw new SyntaxError('Not a JSON response');
      },
    });
  fetchMock.mockImplementationOnce(routeUnavailable).mockImplementationOnce(routeUnavailable);
  await selectCustomer();
  fireEvent.click(screen.getByRole('button', { name: 'Create print ticket' }));

  expect(await screen.findByRole('alert')).toHaveTextContent('Could not confirm the print ticket');
  const storedIntent = window.localStorage.getItem(storageKey);
  expect(storedIntent).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Check previous request' }));

  expect(await screen.findByRole('alert')).toHaveTextContent('Could not confirm the print ticket');
  expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
    printOrdersPath,
    printOrdersPath,
    printOrdersPath,
  ]);
  expect(JSON.parse(fetchMock.mock.calls[1][1].body).intentId).toBe(storedIntent);
  expect(JSON.parse(fetchMock.mock.calls[2][1].body)).toEqual({
    operation: 'recover',
    intentId: storedIntent,
  });
  expect(window.localStorage.getItem(storageKey)).toBe(storedIntent);
});

it('offers separate shipment creation only after presenting a possible match', async () => {
  loadForm();
  fetchMock.mockResolvedValueOnce(
    ok({ status: 'possible_match', matches: [{ ...match, purpose: 'admin_order' }] }),
  );
  fetchMock.mockResolvedValueOnce(ok({ ticketId, printRequestId }));
  await selectCustomer();
  fireEvent.click(screen.getByRole('button', { name: 'Create print ticket' }));
  expect(await screen.findByRole('link', { name: 'Open print ticket P-1234' })).toHaveAttribute(
    'href',
    `/tickets/${ticketId}`,
  );
  expect(fetchMock).toHaveBeenCalledTimes(2);
  fireEvent.click(screen.getByRole('button', { name: 'Create a separate shipment' }));
  expect(await screen.findByText('Ticket created')).toBeInTheDocument();
  const first = JSON.parse(fetchMock.mock.calls[1][1].body);
  expect(JSON.parse(fetchMock.mock.calls[2][1].body)).toEqual({ ...first, allowRepeat: true });
});

it('preserves the intent when a check finds no order so a delayed request cannot create a duplicate', async () => {
  window.localStorage.setItem(storageKey, priorIntentId);
  fetchMock.mockResolvedValueOnce(ok({ customerAddress: shipping, matches: [] }));
  fetchMock.mockResolvedValueOnce({
    ok: false,
    json: async () => ({ code: 'print_intent_not_found' }),
  });
  fetchMock.mockResolvedValueOnce(ok({ ticketId, printRequestId }));
  render(<AdminLuluOrderForm storyId={storyId} />);

  expect(await screen.findByRole('alert')).toHaveTextContent('No ticket was found');
  await selectCustomer();
  fireEvent.click(screen.getByRole('button', { name: 'Create print ticket' }));
  expect(await screen.findByText('Ticket created')).toBeInTheDocument();
  expect(JSON.parse(fetchMock.mock.calls[2][1].body).intentId).toBe(priorIntentId);
});

it('links back to the existing legacy ticket if manual dispatch won the race', async () => {
  fetchMock.mockResolvedValueOnce(ok({ matches: [] }));
  fetchMock.mockResolvedValueOnce({
    ok: false,
    json: async () => ({
      code: 'print_legacy_conflict',
      error: 'Manual dispatch already started.',
    }),
  });
  render(
    <AdminLuluOrderForm storyId={storyId} legacyTicketId={ticketId} legacyAddress={shipping} />,
  );

  await selectCustomer();
  expect(screen.queryByLabelText('Order type')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Upgrade print ticket' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Manual dispatch already started.');
  expect(screen.getByRole('link', { name: 'Open existing ticket' })).toHaveAttribute(
    'href',
    `/tickets/${ticketId}`,
  );
  expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toMatchObject({
    legacyTicketId: ticketId,
    orderKind: 'admin_order',
  });
});

it('requires explicit confirmation for a separate legacy shipment and keeps the original intent and ticket', async () => {
  const paidTicketId = 'eeeeeeee-eeee-4eee-aeee-eeeeeeeeeeee';
  const paidMatch = { ...match, ticketId: paidTicketId };
  fetchMock.mockResolvedValueOnce(ok({ matches: [paidMatch] }));
  fetchMock.mockResolvedValueOnce(ok({ status: 'possible_match', matches: [paidMatch] }));
  fetchMock.mockResolvedValueOnce(ok({ ticketId, printRequestId }));
  render(
    <AdminLuluOrderForm storyId={storyId} legacyTicketId={ticketId} legacyAddress={shipping} />,
  );

  await selectCustomer();
  expect(
    screen.queryByRole('button', { name: 'Confirm separate shipment on this ticket' }),
  ).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Upgrade print ticket' }));
  expect(
    await screen.findByText('Check whether one of these paid orders covers this legacy ticket.'),
  ).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Open paid print ticket P-1234' })).toHaveAttribute(
    'href',
    `/tickets/${paidTicketId}`,
  );
  expect(fetchMock).toHaveBeenCalledTimes(2);

  fireEvent.click(screen.getByRole('button', { name: 'Confirm separate shipment on this ticket' }));
  expect(await screen.findByRole('link', { name: 'Open existing ticket' })).toHaveAttribute(
    'href',
    `/tickets/${ticketId}`,
  );
  const initial = JSON.parse(fetchMock.mock.calls[1][1].body);
  expect(initial).toMatchObject({ legacyTicketId: ticketId, orderKind: 'admin_order' });
  expect(initial).not.toHaveProperty('confirmSeparateLegacyShipment');
  expect(JSON.parse(fetchMock.mock.calls[2][1].body)).toEqual({
    ...initial,
    confirmSeparateLegacyShipment: true,
  });
});

it('opens existing paid and staff proof tickets without preparing or entering an address', async () => {
  loadForm({
    premiumRevision,
    matches: [
      match,
      {
        ...match,
        ticketId: 'eeeeeeee-eeee-4eee-aeee-eeeeeeeeeeee',
        purpose: 'staff_proof',
        copies: 1,
        bookFormat: 'premium_square',
        orderNumber: 'P-1235',
      },
    ],
  });
  expect(
    await screen.findByRole('link', { name: 'Open paid print ticket P-1234' }),
  ).toHaveAttribute('href', `/tickets/${ticketId}`);
  fireEvent.change(screen.getByLabelText('Order type'), { target: { value: 'staff_proof' } });
  fireEvent.change(screen.getByLabelText('Book format'), { target: { value: 'premium_square' } });
  expect(screen.getByRole('link', { name: 'Open staff proof ticket P-1235' })).toBeInTheDocument();
  expect(screen.queryByLabelText('Delivery address source')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Create print ticket' })).not.toBeInTheDocument();
  expect(fetchMock).toHaveBeenCalledTimes(1);
});
