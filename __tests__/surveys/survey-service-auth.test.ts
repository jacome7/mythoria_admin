/** @jest-environment node */
import { GoogleAuth, IdTokenClient, Impersonated } from 'google-auth-library';
import { callSurveyDomain } from '@/services/surveys';

jest.mock('google-auth-library', () => ({
  GoogleAuth: jest.fn(),
  IdTokenClient: jest.fn(),
  Impersonated: jest.fn(),
}));

const originalEnv = process.env;
const actor = { email: 'manager@mythoria.pt' };
const request = jest.fn();
const getClient = jest.fn();
const getIdTokenClient = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  process.env = {
    ...originalEnv,
    NODE_ENV: 'production',
    WEBAPP_URL: 'https://webapp.example.com/',
    SURVEY_INTERNAL_AUDIENCE: 'https://webapp.example.com',
  };
  delete process.env.SURVEY_IMPERSONATE_SERVICE_ACCOUNT;
  // The service creates its GoogleAuth instance at module initialization.
  Object.assign(GoogleAuth.prototype, { getClient, getIdTokenClient });
  getClient.mockResolvedValue({});
  getIdTokenClient.mockResolvedValue({ request });
  jest.mocked(IdTokenClient).mockImplementation(() => ({ request }) as unknown as IdTokenClient);
  request.mockResolvedValue({ data: { data: { studies: [] } } });
});
afterEach(() => {
  process.env = originalEnv;
});

it('requests an ID token for the survey audience and posts the command with the actor', async () => {
  await expect(callSurveyDomain('listStudies', {}, actor)).resolves.toEqual({ studies: [] });
  expect(getIdTokenClient).toHaveBeenCalledWith('https://webapp.example.com');
  expect(request).toHaveBeenCalledWith(
    expect.objectContaining({
      url: 'https://webapp.example.com/api/internal/surveys/command',
      method: 'POST',
      data: { operation: 'listStudies', input: {}, actor: { email: 'manager@mythoria.pt' } },
    }),
  );
});

it('uses explicit impersonation only in development', async () => {
  process.env = {
    ...process.env,
    NODE_ENV: 'development',
    SURVEY_IMPERSONATE_SERVICE_ACCOUNT: 'admin@example.iam.gserviceaccount.com',
  };
  await callSurveyDomain('getStudy', { studyId: 'x' }, actor);
  expect(Impersonated).toHaveBeenCalledWith(
    expect.objectContaining({ targetPrincipal: 'admin@example.iam.gserviceaccount.com' }),
  );
  expect(IdTokenClient).toHaveBeenCalledWith(
    expect.objectContaining({ targetAudience: 'https://webapp.example.com' }),
  );
  expect(getIdTokenClient).not.toHaveBeenCalled();
});

it('ignores a leaked impersonation override in production', async () => {
  process.env = {
    ...process.env,
    SURVEY_IMPERSONATE_SERVICE_ACCOUNT: 'admin@example.iam.gserviceaccount.com',
  };
  await callSurveyDomain('getStudy', { studyId: 'x' }, actor);
  expect(Impersonated).not.toHaveBeenCalled();
  expect(getIdTokenClient).toHaveBeenCalled();
});

it('fails closed when the audience is not configured', async () => {
  delete process.env.SURVEY_INTERNAL_AUDIENCE;
  await expect(callSurveyDomain('listStudies', {}, actor)).rejects.toMatchObject({ status: 503 });
  expect(request).not.toHaveBeenCalled();
});

it('maps WebApp and credential errors to a controlled status and message', async () => {
  request.mockRejectedValueOnce({ response: { status: 409, data: { error: 'Study not draft' } } });
  await expect(callSurveyDomain('updateStudy', {}, actor)).rejects.toMatchObject({
    status: 409,
    message: 'Study not draft',
  });
  getIdTokenClient.mockRejectedValueOnce(new Error('credential failure'));
  await expect(callSurveyDomain('listStudies', {}, actor)).rejects.toMatchObject({
    status: 502,
    message: 'Survey service request failed',
  });
});

it('parses the WebApp { error: { code, message } } envelope and keeps the code', async () => {
  request.mockRejectedValueOnce({
    response: {
      status: 409,
      statusText: 'Conflict',
      data: { error: { code: 'reward_policy_required', message: 'Redemption deadline missing' } },
    },
  });
  await expect(callSurveyDomain('setStudyStatus', {}, actor)).rejects.toMatchObject({
    status: 409,
    code: 'reward_policy_required',
    message: 'Redemption deadline missing',
  });
});

it('falls back to the status text when the error body has no message', async () => {
  request.mockRejectedValueOnce({ response: { status: 404, statusText: 'Not Found', data: {} } });
  await expect(callSurveyDomain('getStudy', {}, actor)).rejects.toMatchObject({
    status: 404,
    message: 'Not Found',
  });
});
