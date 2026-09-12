import { render, screen, within } from '@testing-library/react';
import ReferralAdmin from '@/components/referrals/ReferralAdmin';

const originalFetch = global.fetch;
afterEach(() => {
  global.fetch = originalFetch;
});

it.each(['overview', 'owners'])('shows owner metrics and EUR revenue in %s', async (view) => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      data: [
        {
          owner: { referralOwnerId: 'owner-1', displayName: 'Rodri', status: 'active' },
          code: { code: 'RODRI' },
          visits: 1200,
          registrations: 24,
          revenueCents: 12345,
        },
        {
          owner: { referralOwnerId: 'owner-2', displayName: 'New owner', status: 'active' },
          code: { code: 'NEW01' },
          visits: 0,
          registrations: 0,
          revenueCents: 0,
        },
      ],
    }),
  });
  render(<ReferralAdmin view={view} permissions={['referrals:view']} />);
  const link = await screen.findByRole('link', { name: 'Rodri' });
  const row = within(link.closest('tr')!);
  expect(screen.getByRole('columnheader', { name: 'Visits' })).toBeInTheDocument();
  expect(screen.getByRole('columnheader', { name: 'Registrations' })).toBeInTheDocument();
  expect(screen.getByRole('columnheader', { name: 'Revenue' })).toBeInTheDocument();
  expect(row.getByText('1,200')).toBeInTheDocument();
  expect(row.getByText('24')).toBeInTheDocument();
  expect(row.getByText('€123.45')).toBeInTheDocument();
  expect(screen.getByText('€0.00')).toBeInTheDocument();
});
