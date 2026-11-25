import { GoogleAuth } from 'google-auth-library';

const auth = new GoogleAuth();

export class PrintDomainError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function callPrintDomain<T>(
  operation: string,
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
