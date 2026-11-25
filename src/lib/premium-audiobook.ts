import { z } from 'zod';

const premiumAudiobookBase = z.object({
  type: z.literal('premium_children'),
  revision: z.uuid(),
  runId: z.uuid(),
});
const fullAudiobook = premiumAudiobookBase.extend({
  audio: z.object({
    key: z.string().min(1).max(512),
    generation: z.string().regex(/^[1-9]\d*$/),
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
    bytes: z
      .number()
      .int()
      .positive()
      .max(16 * 1024 * 1024),
  }),
  duration: z.number().positive(),
});
const pageAudiobook = premiumAudiobookBase.extend({
  tracks: z
    .array(
      z.object({ pageNumber: z.number().int().min(5).max(32), duration: z.number().positive() }),
    )
    .min(1)
    .max(28),
});
const premiumAudiobook = z.union([fullAudiobook, pageAudiobook]);

export type PremiumAudiobookMetadata =
  | { runId: string; duration: number }
  | { runId: string; tracks: { pageNumber: number; duration: number }[] };

export function premiumAudiobookMetadata(
  revision: string | undefined,
  data: unknown,
): PremiumAudiobookMetadata | null {
  const result = premiumAudiobook.safeParse(data);
  if (!result.success || !revision || result.data.revision !== revision) return null;
  if ('audio' in result.data) return { runId: result.data.runId, duration: result.data.duration };
  return { runId: result.data.runId, tracks: result.data.tracks };
}

export function isPremiumAudiobookPending(revision: string | undefined, data: unknown) {
  const result = z.object({ pendingRevision: z.uuid(), pendingRunId: z.uuid() }).safeParse(data);
  return result.success && result.data.pendingRevision === revision;
}
