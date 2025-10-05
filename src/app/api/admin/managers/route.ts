import { NextRequest } from 'next/server';
import { auth } from '@/auth';
import { getBackofficeDb } from '@/db';
import { managers, type NewManager } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { ALLOWED_DOMAINS } from '@/config/auth';

/**
 * GET /api/admin/managers
 * Returns all managers (no pagination since there will be very few)
 */
export async function GET() {
  try {
    // Authentication check
    const session = await auth();
    if (!session?.user?.email) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user has the required email domain
    const isAllowedDomain = ALLOWED_DOMAINS.some((domain) => session.user?.email?.endsWith(domain));

    if (!isAllowedDomain) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get backoffice database connection
    const db = getBackofficeDb();

    // Fetch all managers ordered by creation date (newest first)
    const allManagers = await db.select().from(managers).orderBy(managers.createdAt);

    return Response.json({
      data: allManagers,
      count: allManagers.length,
    });
  } catch (error) {
    console.error('Error fetching managers:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/admin/managers
 * Creates a new manager
 */
export async function POST(request: NextRequest) {
  try {
    // Authentication check
    const session = await auth();
    if (!session?.user?.email) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user has the required email domain
    const isAllowedDomain = ALLOWED_DOMAINS.some((domain) => session.user?.email?.endsWith(domain));

    if (!isAllowedDomain) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Parse request body
    const body = await request.json();
    const { name, email, mobilePhone, role } = body;

    // Basic validation
    if (!name || !email) {
      return Response.json({ error: 'Name and email are required' }, { status: 400 });
    }

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return Response.json({ error: 'Invalid email format' }, { status: 400 });
    }

    // Get backoffice database connection
    const db = getBackofficeDb();

    // Check if email already exists
    const existingManager = await db
      .select()
      .from(managers)
      .where(eq(managers.email, email))
      .limit(1);

    if (existingManager.length > 0) {
      return Response.json({ error: 'Manager with this email already exists' }, { status: 409 });
    }

    // Create new manager
    const newManagerData: NewManager = {
      name: name.trim(),
      email: email.trim().toLowerCase(),
      mobilePhone: mobilePhone?.trim() || null,
      role: role?.trim() || null,
    };

    const [createdManager] = await db.insert(managers).values(newManagerData).returning();

    return Response.json(createdManager, { status: 201 });
  } catch (error) {
    console.error('Error creating manager:', error);

    // Handle unique constraint violation
    if (error instanceof Error && error.message.includes('unique constraint')) {
      return Response.json({ error: 'Manager with this email already exists' }, { status: 409 });
    }

    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
