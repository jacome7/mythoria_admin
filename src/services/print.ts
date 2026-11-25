import { GoogleAuth, IdTokenClient, Impersonated } from 'google-auth-library';

const auth = new GoogleAuth();

type PrintOperation =
  | 'getConfig'
  | 'setConfig'
  | 'hasPaidOrderForStory'
  | 'getPremiumEdition'
  | 'createStaffProof'
  | 'get'
  | 'select'
  | 'prepare'
  | 'hold'
  | 'clear'
  | 'revise'
  | 'submit'
  | 'reconcile'
  | 'reserveManual'
  | 'finalizeManual'
  | 'correctShipping'
  | 'correctSquareEdition';

export class PrintDomainError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

function printEndpoint() {
  const audience = process.env.PRINT_INTERNAL_AUDIENCE;
  const base = process.env.WEBAPP_URL;
  if (!audience || !base) throw new PrintDomainError(503, 'Print service is not configured');
  return { audience, url: `${base.replace(/\/$/, '')}/api/internal/print/command` };
}

async function getPrintIdTokenClient(audience: string) {
  const impersonate = process.env.PRINT_IMPERSONATE_SERVICE_ACCOUNT?.trim();
  if (impersonate && process.env.NODE_ENV === 'development') {
    return new IdTokenClient({
      targetAudience: audience,
      idTokenProvider: new Impersonated({
        sourceClient: await auth.getClient(),
        targetPrincipal: impersonate,
        targetScopes: ['https://www.googleapis.com/auth/cloud-platform'],
      }),
    });
  }
  return auth.getIdTokenClient(audience);
}

export async function callPrintDomain<T>(
  operation: PrintOperation,
  input: unknown,
  email: string,
): Promise<T> {
  const { audience, url } = printEndpoint();
  try {
    const client = await getPrintIdTokenClient(audience);
    const response = await client.request<{ data: T }>({
      url,
      method: 'POST',
      data: { operation, input, actor: { email } },
      timeout: ['submit', 'reconcile'].includes(operation) ? 180000 : 30000,
      retry: false,
    });
    if (!response.data || typeof response.data !== 'object' || !('data' in response.data)) {
      throw new Error('Invalid print service response');
    }
    return response.data.data;
  } catch (error) {
    const response =
      error && typeof error === 'object' && 'response' in error
        ? (error.response as { status?: number; data?: { error?: { message?: string } | string } })
        : undefined;
    const detail = response?.data?.error;
    throw new PrintDomainError(
      response?.status || 502,
      typeof detail === 'string' ? detail : detail?.message || 'Print service request failed',
    );
  }
}

export async function callPremiumEditionImage(
  input: { storyId: string; revision: string; image: string },
  email: string,
) {
  const { audience, url } = printEndpoint();
  try {
    const client = await getPrintIdTokenClient(audience);
    const response = await client.request<ArrayBuffer>({
      url,
      method: 'POST',
      data: { operation: 'getPremiumEditionImage', input, actor: { email } },
      responseType: 'arraybuffer',
      timeout: 30000,
      retry: false,
    });
    const contentType = new Headers(response.headers as HeadersInit).get('content-type');
    if (contentType !== 'image/jpeg' && contentType !== 'image/png') {
      throw new Error('Invalid edition image response');
    }
    return { bytes: new Uint8Array(response.data), contentType };
  } catch (error) {
    const status =
      error && typeof error === 'object' && 'response' in error
        ? (error.response as { status?: number } | undefined)?.status
        : undefined;
    throw new PrintDomainError(status || 502, 'Premium edition image unavailable');
  }
}
