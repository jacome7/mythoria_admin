import { and, desc, eq } from 'drizzle-orm';
import { getBackofficeDb } from '@/db';
import { staffPrintDestinations } from '@/db/schema/staff-print-destinations';
import type { StaffDestinationAddress, StaffPrintDestination } from '@/lib/print-delivery/shipping';

function toDestination(row: typeof staffPrintDestinations.$inferSelect): StaffPrintDestination {
  return {
    id: row.id,
    label: row.label,
    address: {
      name: row.name,
      email: row.email,
      phone_number: row.phone_number,
      street1: row.street1,
      street2: row.street2 ?? undefined,
      city: row.city,
      postcode: row.postcode,
      state_code: row.state_code ?? undefined,
      country_code: row.country_code,
    },
  };
}

export async function listStaffPrintDestinations(actorEmail: string) {
  const rows = await getBackofficeDb()
    .select()
    .from(staffPrintDestinations)
    .where(eq(staffPrintDestinations.ownerEmail, actorEmail.toLowerCase()))
    .orderBy(desc(staffPrintDestinations.createdAt));
  return rows.map(toDestination);
}

export async function saveStaffPrintDestination(
  actorEmail: string,
  label: string,
  address: StaffDestinationAddress,
) {
  const [row] = await getBackofficeDb()
    .insert(staffPrintDestinations)
    .values({ ...address, label, ownerEmail: actorEmail.toLowerCase() })
    .onConflictDoNothing({
      target: [staffPrintDestinations.ownerEmail, staffPrintDestinations.label],
    })
    .returning();
  return row ? toDestination(row) : null;
}

export async function removeStaffPrintDestination(actorEmail: string, id: string) {
  const [row] = await getBackofficeDb()
    .delete(staffPrintDestinations)
    .where(
      and(
        eq(staffPrintDestinations.ownerEmail, actorEmail.toLowerCase()),
        eq(staffPrintDestinations.id, id),
      ),
    )
    .returning({ id: staffPrintDestinations.id });
  return Boolean(row);
}
