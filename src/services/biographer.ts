import { GoogleAuth } from 'google-auth-library';

export type BiographerProject = {
  projectId: string;
  title: string;
  locale: string;
  status: string;
  liveSecondsUsed: number;
  liveSecondsLimit: number;
  liveEnabled: boolean;
  updatedAt: string;
  participantCount?: number;
  startedCount?: number;
  finishedCount?: number;
};
export type BiographerOperation =
  'listProjects' | 'getProject' | 'extendAllowance' | 'setLiveEnabled';
export class BiographerDomainError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}
const auth = new GoogleAuth();
export async function callBiographerDomain<T>(
  operation: BiographerOperation,
  input: unknown,
  actor: { email: string },
): Promise<T> {
  const audience = process.env.BIOGRAPHER_INTERNAL_AUDIENCE;
  const base = process.env.WEBAPP_URL;
  if (!audience || !base)
    throw new BiographerDomainError(503, 'Biographer service is not configured');
  try {
    const client = await auth.getIdTokenClient(audience);
    const response = await client.request<{ data: T }>({
      url: `${base.replace(/\/$/, '')}/api/internal/biographer/command`,
      method: 'POST',
      data: { operation, input, actor },
      timeout: 30000,
      retry: false,
    });
    return response.data.data;
  } catch (error) {
    const response =
      error && typeof error === 'object' && 'response' in error
        ? (error.response as { status?: number })
        : undefined;
    throw new BiographerDomainError(response?.status || 502, 'Biographer service request failed');
  }
}
