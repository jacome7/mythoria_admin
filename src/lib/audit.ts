import { getBackofficeDb } from '@/db';
import { adminAuditEvents } from '@/db/schema/admin-audit';

export interface AdminAuditInput {
  actorEmail: string;
  action: string;
  entityType: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Records a sensitive admin action in `backoffice_db.admin_audit_events`.
 * Never throws: failures are logged so they cannot break the audited request.
 */
export async function logAdminAudit(input: AdminAuditInput): Promise<void> {
  try {
    await getBackofficeDb()
      .insert(adminAuditEvents)
      .values({
        actorEmail: input.actorEmail.toLowerCase(),
        action: input.action.slice(0, 64),
        entityType: input.entityType.slice(0, 64),
        entityId: input.entityId?.slice(0, 128) ?? null,
        metadata: input.metadata ?? null,
      });
  } catch (error) {
    console.error('Failed to write admin audit event', {
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
