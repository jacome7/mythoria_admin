import { hasTrustedAdminOrigin } from '@/lib/admin-request-origin';
import { z } from 'zod';
import { authenticateAdmin } from '@/lib/api-helpers';
import { logAdminAudit } from '@/lib/audit';
import { callPrintDomain, PrintDomainError } from '@/services/print';

const headers = { 'Cache-Control': 'private, no-store' };
const proofSchema = z.object({
  revision: z.uuid().toLowerCase(),
  shippingAddress: z.object({
    name: z.string().trim().min(1).max(120),
    street1: z.string().trim().min(1).max(255),
    street2: z.string().trim().max(255).optional(),
    city: z.string().trim().min(1).max(120),
    postcode: z.string().trim().max(20),
    country_code: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z]{2}$/),
    state_code: z.string().trim().max(120).optional(),
    phone_number: z.string().trim().min(1).max(30),
    email: z.email().max(255),
    recipient_tax_id: z.string().trim().max(40).optional(),
  }),
});

type Context = { params: Promise<{ storyId: string }> };

export async function GET(_request: Request, { params }: Context) {
  const actor = await authenticateAdmin();
  if ('error' in actor) return actor.error;
  const story = z
    .uuid()
    .toLowerCase()
    .safeParse((await params).storyId);
  if (!story.success) return Response.json({ error: 'Invalid story.' }, { status: 400, headers });
  try {
    const data = await callPrintDomain('getPremiumEdition', { storyId: story.data }, actor.email);
    await logAdminAudit({
      actorEmail: actor.email,
      action: 'premium_edition.read',
      entityType: 'story',
      entityId: story.data,
    });
    return Response.json({ data }, { headers });
  } catch (error) {
    if (error instanceof PrintDomainError)
      return Response.json({ error: error.message }, { status: error.status, headers });
    console.error('Premium edition read failed', { storyId: story.data, error });
    return Response.json(
      { error: 'Could not load the premium edition.' },
      { status: 500, headers },
    );
  }
}

export async function POST(request: Request, { params }: Context) {
  const actor = await authenticateAdmin();
  if ('error' in actor) return actor.error;
  if (!hasTrustedAdminOrigin(request))
    return Response.json({ error: 'Forbidden' }, { status: 403, headers });
  const story = z
    .uuid()
    .toLowerCase()
    .safeParse((await params).storyId);
  const proof = proofSchema.safeParse(await request.json().catch(() => null));
  if (!story.success || !proof.success)
    return Response.json(
      { error: 'Enter a valid edition and staff shipping address.' },
      { status: 400, headers },
    );
  const metadata = { revision: proof.data.revision };
  const audit = { actorEmail: actor.email, entityType: 'story', entityId: story.data };
  await logAdminAudit({ ...audit, action: 'print.staff_proof_requested', metadata });
  try {
    const data = z
      .object({ ticketId: z.uuid() })
      .parse(
        await callPrintDomain(
          'createStaffProof',
          { storyId: story.data, ...proof.data },
          actor.email,
        ),
      );
    await logAdminAudit({
      ...audit,
      action: 'print.staff_proof_linked',
      metadata: { ...metadata, ticketId: data.ticketId },
    });
    return Response.json({ data }, { headers });
  } catch (error) {
    if (error instanceof PrintDomainError)
      return Response.json({ error: error.message }, { status: error.status, headers });
    console.error('Staff proof request failed', {
      storyId: story.data,
      revision: metadata.revision,
    });
    return Response.json({ error: 'Could not create the proof ticket.' }, { status: 500, headers });
  }
}
