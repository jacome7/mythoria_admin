import { z } from 'zod';
import { hasTrustedAdminOrigin } from '@/lib/admin-request-origin';
import { authenticateAdmin } from '@/lib/api-helpers';
import { logAdminAudit } from '@/lib/audit';
import { staffDestinationAddressSchema } from '@/lib/print-delivery/shipping';
import {
  listStaffPrintDestinations,
  removeStaffPrintDestination,
  saveStaffPrintDestination,
} from '@/services/staff-print-destinations';

const headers = { 'Cache-Control': 'private, no-store' };
const saveSchema = z.object({
  label: z.string().trim().min(1).max(80),
  address: staffDestinationAddressSchema,
});

export async function GET() {
  const actor = await authenticateAdmin();
  if ('error' in actor) return actor.error;
  try {
    return Response.json(
      { destinations: await listStaffPrintDestinations(actor.email) },
      { headers },
    );
  } catch {
    console.error('Could not load saved staff print destinations');
    return Response.json(
      { error: 'Could not load saved staff destinations.' },
      { status: 500, headers },
    );
  }
}

export async function POST(request: Request) {
  const actor = await authenticateAdmin();
  if ('error' in actor) return actor.error;
  if (!hasTrustedAdminOrigin(request))
    return Response.json({ error: 'Forbidden' }, { status: 403, headers });
  const input = saveSchema.safeParse(await request.json().catch(() => null));
  if (!input.success)
    return Response.json(
      { error: 'Enter a label and valid staff delivery details.' },
      { status: 400, headers },
    );
  try {
    const destination = await saveStaffPrintDestination(
      actor.email,
      input.data.label,
      input.data.address,
    );
    if (!destination)
      return Response.json(
        { error: 'You already have a saved destination with that label.' },
        { status: 409, headers },
      );
    await logAdminAudit({
      actorEmail: actor.email,
      action: 'print.staff_destination_saved',
      entityType: 'staff_print_destination',
      entityId: destination.id,
    });
    return Response.json({ destination }, { status: 201, headers });
  } catch {
    console.error('Could not save staff print destination');
    return Response.json(
      { error: 'Could not save the staff destination.' },
      { status: 500, headers },
    );
  }
}

export async function DELETE(request: Request) {
  const actor = await authenticateAdmin();
  if ('error' in actor) return actor.error;
  if (!hasTrustedAdminOrigin(request))
    return Response.json({ error: 'Forbidden' }, { status: 403, headers });
  const parsed = z.object({ id: z.uuid() }).safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return Response.json({ error: 'Invalid staff destination.' }, { status: 400, headers });
  try {
    if (!(await removeStaffPrintDestination(actor.email, parsed.data.id)))
      return Response.json(
        { error: 'Staff destination could not be found.' },
        { status: 404, headers },
      );
    await logAdminAudit({
      actorEmail: actor.email,
      action: 'print.staff_destination_removed',
      entityType: 'staff_print_destination',
      entityId: parsed.data.id,
    });
    return Response.json({ removed: true }, { headers });
  } catch {
    console.error('Could not remove staff print destination');
    return Response.json(
      { error: 'Could not remove the staff destination.' },
      { status: 500, headers },
    );
  }
}
