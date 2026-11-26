import { z } from 'zod';
import { hasTrustedAdminOrigin } from '@/lib/admin-request-origin';
import { authenticateAdmin } from '@/lib/api-helpers';
import { logAdminAudit } from '@/lib/audit';
import { TicketService } from '@/lib/ticketing/service';

const ownerCommand = z.strictObject({ action: z.enum(['claim', 'release']) });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await authenticateAdmin();
  if ('error' in actor) return actor.error;
  if (!hasTrustedAdminOrigin(request))
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  const { id } = await params;
  const command = ownerCommand.safeParse(await request.json().catch(() => null));
  if (!z.uuid().safeParse(id).success || !command.success) {
    return Response.json({ error: 'Invalid ownership request.' }, { status: 400 });
  }
  const claim = command.data.action === 'claim';
  const outcome = await TicketService.setPrintOwner(id, actor.email, claim);
  switch (outcome) {
    case 'missing':
      return Response.json({ error: 'Print ticket not found.' }, { status: 404 });
    case 'closed':
      return Response.json({ error: 'This ticket is closed.' }, { status: 409 });
    case 'taken':
      return Response.json({ error: 'Another manager owns this ticket.' }, { status: 409 });
    case 'updated':
      await logAdminAudit({
        actorEmail: actor.email,
        action: claim ? 'print.owner.claim' : 'print.owner.release',
        entityType: 'ticket',
        entityId: id,
      });
  }
  return Response.json({ owner: claim ? actor.email.toLowerCase() : null });
}
