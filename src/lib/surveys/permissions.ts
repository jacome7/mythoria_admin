import { eq } from 'drizzle-orm';
import { getBackofficeDb } from '@/db';
import { managers } from '@/db/schema/managers';
import { surveyAdminRoles } from '@/db/schema/survey-rbac';
import { authenticateAdmin } from '@/lib/api-helpers';

export type SurveyPermission = 'survey:view' | 'survey:analyze' | 'survey:manage';

export const surveyRolePermissions: Record<string, readonly SurveyPermission[]> = {
  survey_viewer: ['survey:view'],
  // analyze = person-level responses, free text and CSV export
  survey_analyst: ['survey:view', 'survey:analyze'],
  survey_manager: ['survey:view', 'survey:analyze', 'survey:manage'],
  super_admin: ['survey:view', 'survey:analyze', 'survey:manage'],
};

export class SurveyAdminError extends Error {
  constructor(
    public readonly status: 401 | 403,
    message: string,
  ) {
    super(message);
    this.name = 'SurveyAdminError';
  }
}

export interface SurveyActor {
  email: string;
  managerId: string;
  roles: string[];
  permissions: SurveyPermission[];
}

export function permissionsForRoles(roles: readonly string[]): SurveyPermission[] {
  return [...new Set(roles.flatMap((role) => surveyRolePermissions[role] || []))];
}

/**
 * Authenticates the admin session and verifies it holds a survey role granting `permission`.
 * Throws SurveyAdminError(401) when unauthenticated and SurveyAdminError(403) when not permitted.
 */
export async function requireSurveyPermission(permission: SurveyPermission): Promise<SurveyActor> {
  const authenticated = await authenticateAdmin();
  if ('error' in authenticated) {
    throw new SurveyAdminError(authenticated.error.status === 403 ? 403 : 401, 'Unauthorized');
  }
  const email = authenticated.email.toLowerCase();
  const rows = await getBackofficeDb()
    .select({ role: surveyAdminRoles.role, managerId: managers.managerId })
    .from(managers)
    .innerJoin(surveyAdminRoles, eq(surveyAdminRoles.managerId, managers.managerId))
    .where(eq(managers.email, email));
  const roles = rows.map((row) => row.role);
  const permissions = permissionsForRoles(roles);
  if (rows.length === 0 || !permissions.includes(permission)) {
    throw new SurveyAdminError(403, 'Forbidden');
  }
  return { email, managerId: rows[0].managerId, roles, permissions };
}

/** Maps a thrown error to an HTTP status for API routes (null when not a SurveyAdminError). */
export function surveyErrorStatus(error: unknown): { status: number; message: string } | null {
  if (error instanceof SurveyAdminError) return { status: error.status, message: error.message };
  return null;
}
