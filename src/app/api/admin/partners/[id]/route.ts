import { NextRequest } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import { getMythoriaDb } from '@/db';
import { partners } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { ALLOWED_DOMAINS } from '@/config/auth';

const partnerTypeValues = ['printer', 'attraction', 'retail', 'other'] as const;
const partnerStatusValues = ['active', 'draft', 'hidden'] as const;
const partnerServiceScopeValues = ['local', 'national', 'international'] as const;

const e164Regex = /^\+[1-9]\d{6,14}$/;

const shortDescriptionSchema = z
  .record(z.string(), z.string().min(1))
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Short description must include at least one locale entry.',
  });

const partnerInputSchema = z.object({
  name: z.string().trim().min(1, 'Name is required.'),
  type: z.enum(partnerTypeValues),
  logoUrl: z.string().url('Logo URL must be a valid URL.'),
  websiteUrl: z.preprocess(
    (value) => (value === '' ? undefined : value),
    z.string().url('Website URL must be a valid URL.').optional(),
  ),
  email: z.preprocess(
    (value) => (value === '' ? undefined : value),
    z.string().email('Invalid email format.').optional(),
  ),
  mobilePhone: z.preprocess(
    (value) => (value === '' ? undefined : value),
    z
      .string()
      .regex(e164Regex, 'Mobile phone must be in E.164 format (e.g., +3519xxxxxxx).')
      .optional(),
  ),
  addressLine1: z.preprocess((value) => (value === '' ? undefined : value), z.string().optional()),
  addressLine2: z.preprocess((value) => (value === '' ? undefined : value), z.string().optional()),
  city: z.preprocess((value) => (value === '' ? undefined : value), z.string().optional()),
  postalCode: z.preprocess((value) => (value === '' ? undefined : value), z.string().optional()),
  countryCode: z.preprocess(
    (value) => (value === '' ? undefined : value),
    z.string().length(2, 'Country code must be ISO 3166-1 alpha-2.').optional(),
  ),
  shortDescription: z.preprocess((value) => {
    if (typeof value === 'string') {
      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    }
    return value;
  }, shortDescriptionSchema),
  serviceScope: z.preprocess(
    (value) => (value === '' ? undefined : value),
    z.enum(partnerServiceScopeValues).optional(),
  ),
  status: z.preprocess(
    (value) => (value === '' ? undefined : value),
    z.enum(partnerStatusValues).optional(),
  ),
  displayOrder: z.preprocess((value) => {
    if (value === '' || value === null || value === undefined) {
      return undefined;
    }
    if (typeof value === 'number') {
      return value;
    }
    return Number(value);
  }, z.number().int('Display order must be an integer.').optional()),
});

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * GET /api/admin/partners/[id]
 * Returns a specific partner by ID
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const isAllowedDomain = ALLOWED_DOMAINS.some((domain) => session.user?.email?.endsWith(domain));
    if (!isAllowedDomain) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    if (!uuidRegex.test(id)) {
      return Response.json({ error: 'Invalid partner ID format' }, { status: 400 });
    }

    const db = getMythoriaDb();
    const partner = await db.select().from(partners).where(eq(partners.id, id)).limit(1);

    if (partner.length === 0) {
      return Response.json({ error: 'Partner not found' }, { status: 404 });
    }

    return Response.json(partner[0]);
  } catch (error) {
    console.error('Error fetching partner:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PUT /api/admin/partners/[id]
 * Updates a specific partner
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const isAllowedDomain = ALLOWED_DOMAINS.some((domain) => session.user?.email?.endsWith(domain));
    if (!isAllowedDomain) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    if (!uuidRegex.test(id)) {
      return Response.json({ error: 'Invalid partner ID format' }, { status: 400 });
    }

    const body = await request.json();
    const parsed = partnerInputSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json(
        { error: parsed.error.issues[0]?.message ?? 'Invalid payload.' },
        { status: 400 },
      );
    }

    const payload = parsed.data;
    const normalizedServiceScope =
      payload.type === 'printer' ? (payload.serviceScope ?? null) : null;

    const db = getMythoriaDb();
    const existingPartner = await db.select().from(partners).where(eq(partners.id, id)).limit(1);

    if (existingPartner.length === 0) {
      return Response.json({ error: 'Partner not found' }, { status: 404 });
    }

    const updateData = {
      name: payload.name.trim(),
      type: payload.type,
      logoUrl: payload.logoUrl.trim(),
      websiteUrl: payload.websiteUrl?.trim() || null,
      email: payload.email?.trim().toLowerCase() || null,
      mobilePhone: payload.mobilePhone?.trim() || null,
      addressLine1: payload.addressLine1?.trim() || null,
      addressLine2: payload.addressLine2?.trim() || null,
      city: payload.city?.trim() || null,
      postalCode: payload.postalCode?.trim() || null,
      countryCode: payload.countryCode?.trim().toUpperCase() || null,
      shortDescription: payload.shortDescription,
      serviceScope: normalizedServiceScope,
      status: payload.status ?? 'active',
      displayOrder: payload.displayOrder ?? null,
    };

    const [updatedPartner] = await db
      .update(partners)
      .set(updateData)
      .where(eq(partners.id, id))
      .returning();

    return Response.json(updatedPartner);
  } catch (error) {
    console.error('Error updating partner:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/partners/[id]
 * Deletes a specific partner
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const isAllowedDomain = ALLOWED_DOMAINS.some((domain) => session.user?.email?.endsWith(domain));
    if (!isAllowedDomain) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    if (!uuidRegex.test(id)) {
      return Response.json({ error: 'Invalid partner ID format' }, { status: 400 });
    }

    const db = getMythoriaDb();
    const existingPartner = await db.select().from(partners).where(eq(partners.id, id)).limit(1);

    if (existingPartner.length === 0) {
      return Response.json({ error: 'Partner not found' }, { status: 404 });
    }

    await db.delete(partners).where(eq(partners.id, id));

    return Response.json({ message: 'Partner deleted successfully' });
  } catch (error) {
    console.error('Error deleting partner:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
