import { pgTable, uuid, varchar, timestamp, uniqueIndex, check } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { managers } from './managers';
export const referralAdminRoles = pgTable(
  'referral_admin_roles',
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
    uniqueIndex('referral_admin_role_unique').on(t.managerId, t.role),
    check(
      'referral_admin_role_check',
      sql`${t.role} in ('referral_viewer','referral_manager','finance','super_admin')`,
    ),
  ],
);
