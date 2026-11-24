import { GoogleAuth } from 'google-auth-library';
import { z } from 'zod';

const auth = new GoogleAuth();
export async function resumePremiumGeneration(storyId: string, runId: string) {
  const base = process.env.STORY_GENERATION_WORKFLOW_URL;
  const key = process.env.STORY_GENERATION_WORKFLOW_API_KEY;
  if (!base || !key) throw new Error('Story generation workflow is not configured');
  const origin = new URL(base).origin;
  const client = await auth.getIdTokenClient(origin);
  const response = await client.request({
    url: new URL('/internal/premium/runs/' + runId + '/resume', origin).href,
    method: 'POST',
    headers: { 'x-api-key': key },
    data: { storyId },
    retry: false,
    timeout: 30000,
    validateStatus: () => true,
  });
  if (response.status === 409) return false;
  if (response.status < 200 || response.status >= 300)
    throw new Error('Premium generation resume failed');
  z.object({ storyId: z.literal(storyId), runId: z.literal(runId) }).parse(response.data);
  return true;
}
