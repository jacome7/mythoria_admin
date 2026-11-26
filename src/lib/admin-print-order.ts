import { z } from 'zod';

export const adminPrintBookFormat = z.enum(['premium_square', 'standard_a5']);
export const adminPrintOrderKind = z.enum(['staff_proof', 'admin_order']);
export const adminPrintProvider = z.enum(['lulu', 'manual']);

export const adminPrintMatch = z.object({
  ticketId: z.uuid(),
  printRequestId: z.uuid(),
  purpose: z.string(),
  countryCode: z.string().nullish(),
  copies: z.number().int(),
  bookFormat: adminPrintBookFormat,
  orderNumber: z.string().optional(),
});

export const adminPrintOrderResult = z.union([
  z.object({
    ticketId: z.uuid(),
    printRequestId: z.uuid(),
    reused: z.boolean().optional(),
  }),
  z.object({ status: z.literal('possible_match'), matches: z.array(adminPrintMatch).min(1) }),
]);

export const adminPrintProgress = z.object({
  status: z.string(),
  holdReason: z.string().nullish(),
  lastError: z.string().nullish(),
});

export type AdminPrintBookFormat = z.infer<typeof adminPrintBookFormat>;
export type AdminPrintOrderKind = z.infer<typeof adminPrintOrderKind>;
export type AdminPrintProvider = z.infer<typeof adminPrintProvider>;
export type AdminPrintMatch = z.infer<typeof adminPrintMatch>;
