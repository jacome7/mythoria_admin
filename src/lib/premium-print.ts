import { z } from 'zod';

export const premiumPrintParts = ['interior', 'cover', 'interiorCmyk', 'coverCmyk'] as const;
export const premiumPrintPart = z.enum(premiumPrintParts);
export type PremiumPrintPart = z.infer<typeof premiumPrintPart>;

export const premiumPrintStatus = z.discriminatedUnion('status', [
  z.object({ status: z.literal('missing') }),
  z.object({ status: z.enum(['queued', 'running', 'failed']), runId: z.uuid() }),
  z.object({
    status: z.literal('ready'),
    runId: z.uuid(),
    source: z.enum(['admin', 'self-print']),
    parts: z.array(premiumPrintPart),
  }),
]);
export type PremiumPrintStatus = z.infer<typeof premiumPrintStatus>;
