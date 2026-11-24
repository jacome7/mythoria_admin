import { GoogleAuth } from 'google-auth-library';

const auth = new GoogleAuth();

type PrintOperation =
  | 'getConfig'
  | 'setConfig'
  | 'hasPaidOrderForStory'
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

export async function callPrintDomain<T>(
  operation: PrintOperation,
  input: unknown,
  email: string,
): Promise<T> {
  const audience = process.env.PRINT_INTERNAL_AUDIENCE;
  const base = process.env.WEBAPP_URL;
  if (!audience || !base) throw new PrintDomainError(503, 'Print service is not configured');
  try {
    const client = await auth.getIdTokenClient(audience);
    const response = await client.request<{ data: T }>({
      url: `${base.replace(/\/$/, '')}/api/internal/print/command`,
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
