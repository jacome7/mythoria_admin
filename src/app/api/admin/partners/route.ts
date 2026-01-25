import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getMythoriaDb } from '@/db';
import { partners, type NewPartner } from '@/db/schema';
import { sql } from 'drizzle-orm';
import { ALLOWED_DOMAINS } from '@/config/auth';
import { auth } from '@/auth';
import { authenticateRequest, unauthorizedResponse } from '@/lib/auth/middleware';

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

/**
 * GET /api/admin/partners
 * Returns all partners (ordered by display order, then name)
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request);
    if (!authResult.success) {
      return unauthorizedResponse(authResult.error);
    }

    if (authResult.source === 'session') {
      const userEmail = authResult.userId || '';
      const isAllowedDomain = ALLOWED_DOMAINS.some((domain) => userEmail.endsWith(domain));
      if (!isAllowedDomain) {
        return Response.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    const db = getMythoriaDb();

    const allPartners = await db
      .select()
      .from(partners)
      .orderBy(
        sql`case when ${partners.displayOrder} is null then 1 else 0 end`,
        partners.displayOrder,
        partners.name,
      );

    return Response.json({
      data: allPartners,
      count: allPartners.length,
    });
  } catch (error) {
    console.error('Error fetching partners:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/admin/partners
 * Creates a new partner
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const isAllowedDomain = ALLOWED_DOMAINS.some((domain) => session.user?.email?.endsWith(domain));
    if (!isAllowedDomain) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
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

    const newPartnerData: NewPartner = {
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

    const db = getMythoriaDb();
    const [createdPartner] = await db.insert(partners).values(newPartnerData).returning();

    return Response.json(createdPartner, { status: 201 });
  } catch (error) {
    console.error('Error creating partner:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
