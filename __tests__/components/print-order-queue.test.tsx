import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { useRouter, useSearchParams } from 'next/navigation';
import PrintSettingsPage from '@/app/tickets/print-settings/page';
import { PrintOrderQueue } from '@/components/PrintOrderQueue';
import { useAdminAuth } from '@/lib/hooks/useAdminAuth';
import type { PrintOrderQueueResponse, PrintOrderQueueRow } from '@/lib/print-order-queue';

jest.mock('@/lib/hooks/useAdminAuth', () => ({ useAdminAuth: jest.fn() }));
jest.mock('next/navigation', () => ({ useRouter: jest.fn(), useSearchParams: jest.fn() }));
jest.unmock('next/image');
jest.unmock('next/link');

const originalFetch = globalThis.fetch;
const fetchMock = jest.fn();
const push = jest.fn();
const thumbnailUrl = '/api/admin/stories/story/premium-edition/assets/cover';

const canceled: PrintOrderQueueRow = {
  ticketId: 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',
  printRequestId: '12345678-aaaa-4aaa-aaaa-aaaaaaaaaaaa',
  title: 'The lighthouse',
  orderReference: '12345678',
  ticketStatus: 'open',
  purpose: 'customer',
  thumbnailUrl,
  copies: 2,
  destinationCountry: 'PT',
  nextAction: 'needs_attention',
  actionLabel: 'Follow up on supplier cancellation',
  owner: 'Print team',
  updatedAt: '2026-11-26T10:30:00.000Z',
  fulfillmentStatus: 'submitted',
  provider: 'lulu',
  vendorStatus: 'CANCELED',
};

const staff: PrintOrderQueueRow = {
  ...canceled,
  ticketId: 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb',
  printRequestId: '23456789-bbbb-4bbb-bbbb-bbbbbbbbbbbb',
  orderReference: '23456789',
  purpose: 'staff_proof',
  copies: 1,
  owner: null,
  nextAction: 'ready',
  actionLabel: 'Ready for release',
  fulfillmentStatus: 'proof_ready',
  vendorStatus: null,
};

const legacy: PrintOrderQueueRow = {
  ...staff,
  ticketId: 'cccccccc-cccc-4ccc-cccc-cccccccccccc',
  printRequestId: null,
  orderReference: '#CCCC',
  title: 'Earlier print request',
  purpose: 'legacy',
  thumbnailUrl: null,
  copies: null,
  destinationCountry: null,
  nextAction: 'legacy',
  actionLabel: 'Review legacy ticket',
  fulfillmentStatus: null,
  provider: null,
};

const sample: PrintOrderQueueResponse = {
  data: [canceled, staff, legacy],
  counts: {
    needs_attention: 8,
    awaiting_review: 0,
    ready: 2,
    with_supplier: 0,
    preparing: 0,
    legacy: 3,
    closed: 0,
  },
  pagination: {
    page: 2,
    limit: 3,
    total: 13,
    hasNext: true,
    hasPrev: true,
    nextCursor: 'new-cursor',
    previousCursor: 'old-cursor',
  },
};

function setQuery(query: string) {
  jest.mocked(useSearchParams).mockReturnValue(new URLSearchParams(query) as never);
}

function response(result: PrintOrderQueueResponse) {
  return { ok: true, json: async () => result };
}

beforeEach(() => {
  jest.clearAllMocks();
  fetchMock.mockReset();
  globalThis.fetch = fetchMock;
  jest.mocked(useAdminAuth).mockReturnValue({
    session: { user: { email: 'staff@mythoria.pt' }, expires: '' },
    loading: false,
  });
  jest.mocked(useRouter).mockReturnValue({ push } as never);
  setQuery('');
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

it('opens the original ticket for each same-title order and shows the separate legacy next action', async () => {
  fetchMock.mockResolvedValue(response(sample));
  render(<PrintOrderQueue />);
  const list = await screen.findByRole('list', { name: 'Print order results' });
  const [customerOrder, staffProof, legacyOrder] = within(list).getAllByRole('listitem');

  expect(
    within(customerOrder).getByRole('link', { name: /The lighthouse, 12345678/ }),
  ).toHaveAttribute('href', `/tickets/${canceled.ticketId}`);
  expect(
    within(staffProof).getByRole('link', { name: /The lighthouse, 23456789/ }),
  ).toHaveAttribute('href', `/tickets/${staff.ticketId}`);
  expect(within(customerOrder).getByText('Portugal')).toBeInTheDocument();
  expect(within(customerOrder).getByText('Print team')).toBeInTheDocument();
  expect(customerOrder.querySelector('img')).toHaveAttribute(
    'src',
    expect.stringContaining(thumbnailUrl),
  );
  expect(within(customerOrder).getByText('Follow up on supplier cancellation')).toBeInTheDocument();
  expect(within(customerOrder).getByText('open')).toBeInTheDocument();
  expect(within(customerOrder).getByText('submitted')).toBeInTheDocument();
  expect(within(customerOrder).getByText('CANCELED')).toBeInTheDocument();
  expect(within(staffProof).getByText('Unassigned')).toBeInTheDocument();
  expect(within(legacyOrder).getByText('Legacy ticket')).toBeInTheDocument();
  expect(within(legacyOrder).getByText('Review legacy ticket')).toBeInTheDocument();
  expect(screen.getByRole('status')).toHaveTextContent('13 orders');
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

it('keeps search and sort on page links and resets pagination when a filter changes', async () => {
  setQuery('search=lighthouse&sort=title_asc&page=2&after=original-cursor');
  fetchMock.mockResolvedValue(response(sample));
  render(<PrintOrderQueue />);

  expect(await screen.findByRole('link', { name: 'Next page' })).toHaveAttribute(
    'href',
    '/tickets/print-orders?search=lighthouse&sort=title_asc&after=new-cursor&page=3',
  );
  expect(screen.getByRole('link', { name: 'Previous page' })).toHaveAttribute(
    'href',
    '/tickets/print-orders?search=lighthouse&sort=title_asc&before=old-cursor&page=1',
  );
  expect(screen.getByRole('link', { name: 'Needs attention 8' })).toHaveAttribute(
    'href',
    '/tickets/print-orders?search=lighthouse&sort=title_asc&action=needs_attention',
  );
  fireEvent.change(screen.getByRole('searchbox', { name: 'Title or order reference' }), {
    target: { value: ' 12345678 ' },
  });
  fireEvent.change(screen.getByRole('combobox', { name: 'Purpose' }), {
    target: { value: 'customer' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Apply filters' }));
  expect(push).toHaveBeenCalledWith(
    '/tickets/print-orders?search=12345678&purpose=customer&sort=title_asc',
    {
      scroll: false,
    },
  );
  expect(fetchMock).toHaveBeenCalledWith(
    '/api/tickets/print-orders?search=lighthouse&sort=title_asc&page=2&after=original-cursor',
    expect.objectContaining({ cache: 'no-store' }),
  );
});

it('does not apply a stale page response after the URL changes', async () => {
  let finishPrevious!: (value: ReturnType<typeof response>) => void;
  fetchMock
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishPrevious = resolve;
        }),
    )
    .mockResolvedValueOnce(response({ ...sample, data: [staff] }));
  const { rerender } = render(<PrintOrderQueue />);

  setQuery('action=ready');
  rerender(<PrintOrderQueue />);
  expect(await screen.findByText('Ready for release')).toBeInTheDocument();
  await act(async () => finishPrevious(response(sample)));
  expect(screen.queryByText('Follow up on supplier cancellation')).not.toBeInTheDocument();
  expect(fetchMock.mock.calls[0][1].signal.aborted).toBe(true);
});

it('offers retry and a cursor reset after a queue error', async () => {
  setQuery('search=lighthouse&after=stale&page=3');
  fetchMock.mockResolvedValueOnce({ ok: false }).mockResolvedValueOnce(response(sample));
  render(<PrintOrderQueue />);

  expect(await screen.findByRole('alert')).toHaveTextContent('Print orders could not be loaded.');
  expect(screen.getByRole('link', { name: 'First page' })).toHaveAttribute(
    'href',
    '/tickets/print-orders?search=lighthouse',
  );
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
  expect(await screen.findByRole('list', { name: 'Print order results' })).toBeInTheDocument();
  expect(fetchMock).toHaveBeenCalledTimes(2);
});

it('waits for the existing Admin access check before requesting queue data', () => {
  jest.mocked(useAdminAuth).mockReturnValue({ session: null, loading: true });
  const { rerender } = render(<PrintOrderQueue />);
  expect(screen.getByRole('status')).toHaveTextContent('Loading print orders');
  expect(fetchMock).not.toHaveBeenCalled();

  jest.mocked(useAdminAuth).mockReturnValue({ session: null, loading: false });
  rerender(<PrintOrderQueue />);
  expect(screen.queryByRole('search')).not.toBeInTheDocument();
  expect(fetchMock).not.toHaveBeenCalled();
});

it('hosts the existing configuration form at the standalone Print settings page', async () => {
  fetchMock.mockResolvedValue({
    ok: true,
    json: async () => ({ data: { defaultProvider: 'none', maxEurPerCopy: 5 } }),
  });
  render(<PrintSettingsPage />);

  expect(screen.getByRole('heading', { name: 'Print settings', level: 1 })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Print settings' })).toHaveAttribute(
    'aria-current',
    'page',
  );
  expect(screen.getByRole('link', { name: 'Customer tickets' })).toHaveAttribute(
    'href',
    '/tickets',
  );
  expect(screen.getByRole('link', { name: 'Print orders' })).toHaveAttribute(
    'href',
    '/tickets/print-orders',
  );
  expect(await screen.findByDisplayValue('5')).toBeInTheDocument();
  expect(screen.getByLabelText('Default provider')).toHaveValue('none');
  expect(fetchMock).toHaveBeenCalledWith(
    '/api/admin/print',
    expect.objectContaining({ body: JSON.stringify({ operation: 'getConfig' }) }),
  );
});
