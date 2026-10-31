import { pgTable, uuid, varchar, timestamp, uniqueIndex, check } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { managers } from './managers';

// -----------------------------------------------------------------------------
// Survey / customer research RBAC (backoffice_db). Separate from referral roles.
// -----------------------------------------------------------------------------
export const surveyAdminRoles = pgTable(
  'survey_admin_roles',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    managerId: uuid('manager_id')
      .notNull()
      .references(() => managers.managerId, { onDelete: 'cascade' }),
    role: varchar('role', { length: 32 }).notNull(),
    grantedBy: varchar('granted_by', { length: 255 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('survey_admin_role_unique').on(t.managerId, t.role),
    check(
      'survey_admin_role_check',
      sql`${t.role} in ('survey_viewer','survey_analyst','survey_manager','super_admin')`,
    ),
  ],
);

export type SurveyAdminRole = typeof surveyAdminRoles.$inferSelect;
export type NewSurveyAdminRole = typeof surveyAdminRoles.$inferInsert;
