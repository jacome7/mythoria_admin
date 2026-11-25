import { z } from 'zod';

const marker = z.object({
  version: z.literal(1),
  type: z.literal('premium_children'),
  state: z.enum(['draft', 'queued', 'published']),
  revision: z.uuid().optional(),
});

export function premiumEditionSummary(features: unknown) {
  if (
    !features ||
    typeof features !== 'object' ||
    !Object.prototype.hasOwnProperty.call(features, 'premiumBook')
  )
    return null;
  const result = marker.safeParse((features as Record<string, unknown>).premiumBook);
  if (!result.success || (result.data.state !== 'draft' && !result.data.revision))
    return { state: 'unavailable' as const };
  return { state: result.data.state, revision: result.data.revision };
}

export type PremiumEditionSummary = NonNullable<ReturnType<typeof premiumEditionSummary>>;
