import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { callReferralDomain } from '@/services/referrals';
import { permissionForReferralOperation, type ReferralActor } from '@/lib/referrals/permissions';
const id = z.string().uuid();
const reason = z.string().min(3).max(2000);
const tools = {
  create_referral_owner: {
    displayName: z.string(),
    legalName: z.string().optional(),
    contactEmail: z.string().email(),
    countryCode: z.string().optional(),
    preferredLocale: z.enum(['en-US', 'pt-PT', 'es-ES', 'fr-FR', 'de-DE']).default('pt-PT'),
    code: z.string(),
    commissionRateBps: z.number().int().min(0).max(10000).default(1000),
    memberEmails: z.array(z.string().email()).min(1),
  },
  get_referral_owner: { id },
  list_referral_owners: {},
  update_referral_owner: {
    id,
    displayName: z.string().optional(),
    legalName: z.string().optional(),
    contactEmailNormalized: z.string().email().optional(),
    code: z.string().optional(),
    codeActive: z.boolean().optional(),
  },
  set_referral_owner_status: { id, status: z.enum(['active', 'suspended', 'closed']), reason },
  set_referral_owner_rate: {
    id,
    commissionRateBps: z.number().int().min(0).max(10000),
    effectiveFrom: z.string().datetime(),
    reason,
  },
  invite_referral_owner_member: {
    id,
    email: z.string().email(),
    role: z.enum(['owner', 'viewer']).default('owner'),
    requestId: id,
  },
  list_referral_commissions: {
    ownerId: id.optional(),
    filters: z.record(z.string(), z.unknown()).optional(),
  },
  review_referral_commission: { id, action: z.enum(['hold', 'release', 'cancel']), reason },
  create_referral_commission_adjustment: {
    id,
    amountCents: z.number().int(),
    reason,
    requestId: id,
  },
  preview_referral_settlement: { ownerId: id, periodEnd: z.string().datetime() },
  create_referral_settlement: {
    ownerId: id,
    periodStart: z.string().datetime(),
    periodEnd: z.string().datetime(),
  },
  mark_referral_settlement_paid: {
    id,
    amountCents: z.number().int().min(2000),
    externalPaymentReference: z.string().min(1),
    paidAt: z.string().datetime(),
  },
  get_referral_reconciliation: {},
};
export function registerReferralMcpTools(server: McpServer, actor: ReferralActor) {
  for (const [name, shape] of Object.entries(tools)) {
    if (!actor.permissions.includes(permissionForReferralOperation(name))) continue;
    server.registerTool(
      name,
      {
        description: `Referral v1: ${name.replace(/_/g, ' ')}. Identity and permissions come from the authenticated credential.`,
        inputSchema: z.object(shape),
        annotations: {
          readOnlyHint: /^(get|list|preview)_/.test(name),
          destructiveHint:
            /^(create_referral_commission_adjustment|mark_referral_settlement_paid|set_referral_owner_status)$/.test(
              name,
            ),
          idempotentHint:
            /^(get|list|preview|mark_referral_settlement_paid|create_referral_settlement|create_referral_commission_adjustment)$/.test(
              name,
            ),
          openWorldHint: false,
        },
      },
      async (input) => {
        try {
          return {
            content: [
              {
                type: 'text' as const,
                text: JSON.stringify(await callReferralDomain(name, input, actor)),
              },
            ],
          };
        } catch {
          return {
            isError: true,
            content: [
              {
                type: 'text' as const,
                text: 'Referral operation failed. Check inputs, permissions, and the Admin reconciliation view.',
              },
            ],
          };
        }
      },
    );
  }
}
