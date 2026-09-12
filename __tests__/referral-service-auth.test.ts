/** @jest-environment node */
import { GoogleAuth, IdTokenClient, Impersonated } from 'google-auth-library';
import { callReferralDomain } from '@/services/referrals';

jest.mock('google-auth-library', () => ({
  GoogleAuth: jest.fn(),
  IdTokenClient: jest.fn(),
  Impersonated: jest.fn(),
}));
jest.mock('@/lib/referrals/permissions', () => ({
  ReferralAdminError: class extends Error {
    constructor(
      public status: number,
      message: string,
    ) {
      super(message);
    }
  },
  permissionForReferralOperation: () => 'referrals:view',
}));

const originalEnv = process.env;
const actor = {
  type: 'admin_ui' as const,
  id: 'manager',
  permissions: ['referrals:view' as const],
};
const request = jest.fn();
const getClient = jest.fn();
const getIdTokenClient = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  process.env = {
    ...originalEnv,
    NODE_ENV: 'development',
    WEBAPP_URL: 'http://localhost:3000',
    REFERRAL_INTERNAL_AUDIENCE: 'http://localhost:3000',
    REFERRAL_IMPERSONATE_SERVICE_ACCOUNT: 'admin@example.iam.gserviceaccount.com',
  };
  // The service creates its GoogleAuth instance at module initialization.
  Object.assign(GoogleAuth.prototype, { getClient, getIdTokenClient });
  getClient.mockResolvedValue({});
  getIdTokenClient.mockResolvedValue({ request });
  jest.mocked(IdTokenClient).mockImplementation(() => ({ request }) as unknown as IdTokenClient);
  request.mockResolvedValue({ data: { data: { owners: [] } } });
});
afterEach(() => {
  process.env = originalEnv;
});

it('uses explicit impersonation for local development', async () => {
  await callReferralDomain('list_referral_owners', {}, actor);
  expect(Impersonated).toHaveBeenCalledWith(
    expect.objectContaining({ targetPrincipal: process.env.REFERRAL_IMPERSONATE_SERVICE_ACCOUNT }),
  );
  expect(IdTokenClient).toHaveBeenCalledWith(
    expect.objectContaining({ targetAudience: 'http://localhost:3000' }),
  );
  expect(getIdTokenClient).not.toHaveBeenCalled();
});

it('uses the attached service identity in production even if a local override leaks in', async () => {
  process.env = { ...process.env, NODE_ENV: 'production' };
  await callReferralDomain('list_referral_owners', {}, actor);
  expect(Impersonated).not.toHaveBeenCalled();
  expect(getIdTokenClient).toHaveBeenCalledWith('http://localhost:3000');
});

it('returns a controlled error if credentials cannot be obtained', async () => {
  getClient.mockRejectedValueOnce(new Error('credential failure'));
  await expect(callReferralDomain('list_referral_owners', {}, actor)).rejects.toMatchObject({
    status: 502,
    message: 'Referral service request failed',
  });
});
