import { and, eq } from 'drizzle-orm';
import { getBackofficeDb } from '@/db';
import { managers } from '@/db/schema/managers';
import { referralAdminRoles } from '@/db/schema/referral-rbac';
import { authenticateAdmin } from '@/lib/api-helpers';
export type ReferralPermission =
  | 'referrals:view'
  | 'referrals:manage'
  | 'referrals:review'
  | 'referrals:settle';
export type ReferralActor = {
  type: 'admin_ui' | 'admin_mcp';
  id: string;
  permissions: ReferralPermission[];
};
export const referralRolePermissions: Record<string, readonly ReferralPermission[]> = {
  referral_viewer: ['referrals:view'],
  referral_manager: ['referrals:view', 'referrals:manage', 'referrals:review'],
  finance: ['referrals:view', 'referrals:review', 'referrals:settle'],
  super_admin: ['referrals:view', 'referrals:manage', 'referrals:review', 'referrals:settle'],
};
export class ReferralAdminError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}
export async function requireAdminPermission(
  permission: ReferralPermission,
): Promise<ReferralActor> {
  const authenticated = await authenticateAdmin();
  if ('error' in authenticated)
    throw new ReferralAdminError(authenticated.error.status, 'Unauthorized');
  const rows = await getBackofficeDb()
    .select({ role: referralAdminRoles.role, managerId: managers.managerId })
    .from(managers)
    .innerJoin(referralAdminRoles, eq(referralAdminRoles.managerId, managers.managerId))
    .where(and(eq(managers.email, authenticated.email.toLowerCase())));
  const permissions = [...new Set(rows.flatMap((row) => referralRolePermissions[row.role] || []))];
  if (!permissions.includes(permission)) throw new ReferralAdminError(403, 'Forbidden');
  return { type: 'admin_ui', id: rows[0].managerId, permissions };
}
export function permissionForReferralOperation(operation: string): ReferralPermission {
  if (
    [
      'preview_referral_settlement',
      'create_referral_settlement',
      'mark_referral_settlement_paid',
    ].includes(operation)
  )
    return 'referrals:settle';
  if (['review_referral_commission', 'create_referral_commission_adjustment'].includes(operation))
    return 'referrals:review';
  if (/^(create|update|set|invite|suspend)_referral_owner/.test(operation))
    return 'referrals:manage';
  return 'referrals:view';
}
