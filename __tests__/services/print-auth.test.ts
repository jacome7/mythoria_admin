/** @jest-environment node */
import { GoogleAuth, IdTokenClient, Impersonated } from 'google-auth-library';
import { callPremiumEditionImage, callPrintDomain } from '@/services/print';

jest.mock('google-auth-library', () => ({
  GoogleAuth: jest.fn(),
  IdTokenClient: jest.fn(),
  Impersonated: jest.fn(),
}));

const audience = 'http://localhost:3000/api/internal/print';
const serviceAccount = 'admin@example.iam.gserviceaccount.com';
const email = 'admin@example.test';
const request = jest.fn();
const getClient = jest.fn();
const getIdTokenClient = jest.fn();
const originalEnv = process.env;

beforeEach(() => {
  jest.clearAllMocks();
  process.env = {
    ...originalEnv,
    NODE_ENV: 'development',
    WEBAPP_URL: 'http://localhost:3000/',
    PRINT_INTERNAL_AUDIENCE: audience,
    PRINT_IMPERSONATE_SERVICE_ACCOUNT: serviceAccount,
  };
  Object.assign(GoogleAuth.prototype, { getClient, getIdTokenClient });
  getClient.mockResolvedValue({});
  getIdTokenClient.mockResolvedValue({ request });
  jest.mocked(IdTokenClient).mockImplementation(() => ({ request }) as unknown as IdTokenClient);
});

afterEach(() => {
  process.env = originalEnv;
});

it('uses development impersonation for both print commands and premium edition images', async () => {
  request
    .mockResolvedValueOnce({ data: { data: { defaultProvider: 'none' } } })
    .mockResolvedValueOnce({
      data: Uint8Array.of(1, 2, 3).buffer,
      headers: { 'content-type': 'image/png' },
    });
  await expect(callPrintDomain('getConfig', {}, email)).resolves.toEqual({
    defaultProvider: 'none',
  });
  const image = { storyId: 'story', revision: 'revision', image: 'cover' };
  await expect(callPremiumEditionImage(image, email)).resolves.toEqual({
    bytes: Uint8Array.of(1, 2, 3),
    contentType: 'image/png',
  });
  expect(Impersonated).toHaveBeenCalledTimes(2);
  expect(Impersonated).toHaveBeenCalledWith(
    expect.objectContaining({ targetPrincipal: serviceAccount }),
  );
  expect(IdTokenClient).toHaveBeenCalledWith(expect.objectContaining({ targetAudience: audience }));
  expect(getIdTokenClient).not.toHaveBeenCalled();
  expect(request).toHaveBeenLastCalledWith(
    expect.objectContaining({
      url: `${audience}/command`,
      data: { operation: 'getPremiumEditionImage', input: image, actor: { email } },
    }),
  );
});

it('uses the attached runtime identity in production even when the development override is present', async () => {
  process.env = { ...process.env, NODE_ENV: 'production' };
  request.mockResolvedValueOnce({ data: { data: { defaultProvider: 'none' } } });
  await callPrintDomain('getConfig', {}, email);
  expect(Impersonated).not.toHaveBeenCalled();
  expect(getIdTokenClient).toHaveBeenCalledWith(audience);
});
