import { render, screen } from '@testing-library/react';
import { redirect } from 'next/navigation';
import ReferralAdminPage from '@/app/referrals/[[...path]]/page';
import { ReferralAdminError, requireAdminPermission } from '@/lib/referrals/permissions';

jest.mock('@/lib/referrals/permissions', () => ({
  ReferralAdminError: class extends Error {
    constructor(
      public status: number,
      message: string,
    ) {
      super(message);
    }
  },
  requireAdminPermission: jest.fn(),
}));
jest.mock('next/navigation', () => ({
  redirect: jest.fn(() => {
    throw new Error('redirect');
  }),
  notFound: jest.fn(() => {
    throw new Error('not found');
  }),
}));
jest.mock('@/components/referrals/ReferralAdmin', () => ({
  __esModule: true,
  default: () => <div>Referral dashboard content</div>,
}));

const permission = jest.mocked(requireAdminPermission);
const page = () => ReferralAdminPage({ params: Promise.resolve({}) });

beforeEach(() => jest.clearAllMocks());

it('explains denied access without rendering the referral dashboard', async () => {
  permission.mockRejectedValue(new ReferralAdminError(403, 'Forbidden'));
  render(await page());
  expect(screen.getByRole('alert')).toHaveTextContent('Referral access required');
  expect(screen.queryByText('Referral dashboard content')).not.toBeInTheDocument();
});

it('redirects unauthenticated requests to sign-in', async () => {
  permission.mockRejectedValue(new ReferralAdminError(401, 'Unauthorized'));
  await expect(page()).rejects.toThrow('redirect');
  expect(redirect).toHaveBeenCalledWith('/auth/signin?callbackUrl=%2Freferrals');
});

it('renders the dashboard for an authorized actor', async () => {
  permission.mockResolvedValue({
    type: 'admin_ui',
    id: 'manager',
    permissions: ['referrals:view'],
  });
  render(await page());
  expect(screen.getByText('Referral dashboard content')).toBeInTheDocument();
  expect(permission).toHaveBeenCalledWith('referrals:view');
});

it('does not conceal unexpected database failures', async () => {
  permission.mockRejectedValue(new Error('database unavailable'));
  await expect(page()).rejects.toThrow('database unavailable');
});
