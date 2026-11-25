import { z } from 'zod';

const premiumAudiobook = z.object({
  type: z.literal('premium_children'),
  revision: z.uuid(),
  runId: z.uuid(),
  tracks: z
    .array(
      z.object({ pageNumber: z.number().int().min(5).max(32), duration: z.number().positive() }),
    )
    .min(1)
    .max(28),
});

export function premiumAudiobookMetadata(revision: string | undefined, data: unknown) {
  const result = premiumAudiobook.safeParse(data);
  if (!result.success || !revision || result.data.revision !== revision) return null;
  return { runId: result.data.runId, tracks: result.data.tracks };
}

export function isPremiumAudiobookPending(revision: string | undefined, data: unknown) {
  const result = z.object({ pendingRevision: z.uuid(), pendingRunId: z.uuid() }).safeParse(data);
  return result.success && result.data.pendingRevision === revision;
}
