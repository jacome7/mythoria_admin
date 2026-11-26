import { z } from 'zod';
import {
  luluAddressIssue,
  luluContactIssue,
  luluRequiresTaxId,
  luluShippingIssueMessages,
  normalizeShippingSubdivision,
} from './lulu-shipping';

export const staffDestinationAddressSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().max(255).pipe(z.email()),
  phone_number: z.string().trim().min(1).max(30),
  street1: z.string().trim().min(1).max(255),
  street2: z.string().trim().max(255).optional(),
  city: z.string().trim().min(1).max(120),
  postcode: z.string().trim().max(20),
  state_code: z.string().trim().max(120).optional(),
  country_code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{2}$/),
});

const shippingAddressSchema = staffDestinationAddressSchema.extend({
  recipient_tax_id: z.string().trim().max(40).optional(),
});

export type AdminLuluShippingDefaults = Partial<z.input<typeof shippingAddressSchema>>;
export type StaffDestinationAddress = z.infer<typeof staffDestinationAddressSchema>;
export type AdminPrintDeliverySource = '' | 'staff_saved' | 'customer_confirmed' | 'someone_else';
export interface AdminPrintDeliveryValue {
  source: AdminPrintDeliverySource;
  shipping: AdminLuluShippingDefaults;
  staffDestinationId?: string;
}

export interface StaffPrintDestination {
  id: string;
  label: string;
  address: StaffDestinationAddress;
}

export const emptyAdminPrintDelivery: AdminPrintDeliveryValue = { source: '', shipping: {} };

export function parseAdminPrintShipping(
  value: AdminPrintDeliveryValue,
  provider: 'lulu' | 'manual',
) {
  return shippingAddressSchema
    .superRefine((shipping, ctx) => {
      const message = !value.source
        ? 'Choose who supplied the delivery address.'
        : value.source === 'staff_saved' && !value.staffDestinationId
          ? 'Select a saved staff destination or save a new one.'
          : null;
      const carrierIssue =
        provider === 'lulu'
          ? (luluAddressIssue(shipping) ?? luluContactIssue(shipping))
          : undefined;
      const issueMessage = message ?? (carrierIssue && luluShippingIssueMessages[carrierIssue]);
      if (issueMessage) ctx.addIssue({ code: 'custom', message: issueMessage });
    })
    .transform((shipping) => ({
      ...shipping,
      street2: shipping.street2 || undefined,
      state_code:
        provider === 'lulu'
          ? normalizeShippingSubdivision(shipping.country_code, shipping.state_code || undefined)
          : shipping.state_code || undefined,
      recipient_tax_id:
        provider === 'lulu' && luluRequiresTaxId(shipping.country_code)
          ? shipping.recipient_tax_id || undefined
          : undefined,
    }))
    .safeParse({
      ...value.shipping,
      postcode: value.shipping.postcode ?? '',
      email: value.shipping.email?.trim(),
    });
}
