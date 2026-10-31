import { GoogleAuth, IdTokenClient, Impersonated } from 'google-auth-library';

/**
 * Admin -> WebApp survey command client (docs/SURVEYS.md, "WebApp internal command API").
 * Mirrors `callReferralDomain`: Google OIDC ID token with audience `SURVEY_INTERNAL_AUDIENCE`.
 */
export const SURVEY_OPERATIONS = [
  'listSurveys',
  'listStudies',
  'getStudy',
  'createStudy',
  'updateStudy',
  'setStudyStatus',
  'previewAudience',
  'snapshotAudience',
  'linkCampaigns',
] as const;

export type SurveyOperation = (typeof SURVEY_OPERATIONS)[number];

export type SurveyCommandActor = { email: string };

export class SurveyDomainError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code?: string,
  ) {
    super(message);
    this.name = 'SurveyDomainError';
  }
}

type SurveyErrorBody = { error?: unknown } | null | undefined;

/**
 * Parses the WebApp error envelope `{ error: { code, message } }` (a plain string `error` is also
 * accepted); falls back to the HTTP status text, then to a generic message.
 */
export function parseSurveyErrorBody(
  body: SurveyErrorBody,
  statusText?: string,
): { code?: string; message: string } {
  const raw = body?.error;
  if (raw && typeof raw === 'object') {
    const { code, message } = raw as { code?: unknown; message?: unknown };
    return {
      code: typeof code === 'string' ? code : undefined,
      message:
        typeof message === 'string' && message
          ? message
          : statusText || 'Survey service request failed',
    };
  }
  if (typeof raw === 'string' && raw) return { message: raw };
  return { message: statusText || 'Survey service request failed' };
}

const auth = new GoogleAuth();

export async function callSurveyDomain<T = unknown>(
  operation: SurveyOperation,
  input: unknown,
  actor: SurveyCommandActor,
): Promise<T> {
  const audience = process.env.SURVEY_INTERNAL_AUDIENCE;
  const base = process.env.WEBAPP_URL;
  if (!audience || !base) throw new SurveyDomainError(503, 'Survey service is not configured');
  try {
    const impersonate = process.env.SURVEY_IMPERSONATE_SERVICE_ACCOUNT;
    const client =
      impersonate && process.env.NODE_ENV === 'development'
        ? new IdTokenClient({
            targetAudience: audience,
            idTokenProvider: new Impersonated({
              sourceClient: await auth.getClient(),
              targetPrincipal: impersonate,
              targetScopes: ['https://www.googleapis.com/auth/cloud-platform'],
            }),
          })
        : await auth.getIdTokenClient(audience);
    const response = await client.request<{ data: T }>({
      url: `${base.replace(/\/$/, '')}/api/internal/surveys/command`,
      method: 'POST',
      data: { operation, input, actor: { email: actor.email } },
      timeout: 30000,
      retry: false,
    });
    return response.data.data;
  } catch (error) {
    const response =
      error && typeof error === 'object' && 'response' in error
        ? (error.response as { status?: number; statusText?: string; data?: SurveyErrorBody })
        : undefined;
    if (!response) throw new SurveyDomainError(502, 'Survey service request failed');
    const parsed = parseSurveyErrorBody(response.data, response.statusText);
    throw new SurveyDomainError(response.status || 502, parsed.message, parsed.code);
  }
}
