import { z } from 'zod';
export const biographerCommandSchema = z.discriminatedUnion('operation', [
  z
    .object({
      operation: z.literal('listProjects'),
      input: z.object({ limit: z.number().int().min(1).max(100).default(50) }).strict(),
    })
    .strict(),
  z
    .object({
      operation: z.literal('getProject'),
      input: z.object({ projectId: z.string().uuid() }).strict(),
    })
    .strict(),
  z
    .object({
      operation: z.literal('extendAllowance'),
      input: z
        .object({
          projectId: z.string().uuid(),
          additionalSeconds: z.number().int().min(60).max(36000),
          reason: z.string().trim().min(3).max(500),
          requestId: z.string().uuid(),
        })
        .strict(),
    })
    .strict(),
  z
    .object({
      operation: z.literal('setLiveEnabled'),
      input: z
        .object({
          projectId: z.string().uuid(),
          enabled: z.boolean(),
          reason: z.string().trim().min(3).max(500),
          requestId: z.string().uuid(),
        })
        .strict(),
    })
    .strict(),
]);
