import { GoogleAuth, IdTokenClient, Impersonated } from 'google-auth-library';
import {
  ReferralAdminError,
  permissionForReferralOperation,
  type ReferralActor,
} from '@/lib/referrals/permissions';
const auth = new GoogleAuth();
export async function callReferralDomain(
  operation: string,
  input: unknown,
  actor: ReferralActor,
): Promise<unknown> {
  if (!actor.permissions.includes(permissionForReferralOperation(operation)))
    throw new ReferralAdminError(403, 'Forbidden');
  const audience = process.env.REFERRAL_INTERNAL_AUDIENCE;
  const base = process.env.WEBAPP_URL;
  if (!audience || !base) throw new ReferralAdminError(503, 'Referral service is not configured');
  try {
    const impersonate = process.env.REFERRAL_IMPERSONATE_SERVICE_ACCOUNT;
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
    const response = await client.request<{ data: unknown }>({
      url: `${base.replace(/\/$/, '')}/api/internal/referrals/command`,
      method: 'POST',
      data: { operation, input, actor },
      timeout: 30000,
      retry: false,
    });
    return response.data.data;
  } catch (error) {
    const response =
      error && typeof error === 'object' && 'response' in error
        ? (error.response as { status?: number; data?: { error?: string } })
        : undefined;
    throw new ReferralAdminError(
      response?.status || 502,
      response?.data?.error || 'Referral service request failed',
    );
  }
}
