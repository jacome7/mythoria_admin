import { NextRequest } from 'next/server';
import { auth } from '@/auth';
import { getBackofficeDb } from '@/db';
import { managers } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { ALLOWED_DOMAINS } from '@/config/auth';

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

/**
 * GET /api/admin/managers/[id]
 * Returns a specific manager by ID
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    // Authentication check
    const session = await auth();
    if (!session?.user?.email) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user has the required email domain
    const isAllowedDomain = ALLOWED_DOMAINS.some(domain => 
      session.user?.email?.endsWith(domain)
    );

    if (!isAllowedDomain) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return Response.json({ error: 'Invalid manager ID format' }, { status: 400 });
    }

    // Get backoffice database connection
    const db = getBackofficeDb();

    // Fetch the manager
    const manager = await db
      .select()
      .from(managers)
      .where(eq(managers.managerId, id))
      .limit(1);

    if (manager.length === 0) {
      return Response.json({ error: 'Manager not found' }, { status: 404 });
    }

    return Response.json(manager[0]);

  } catch (error) {
    console.error('Error fetching manager:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/managers/[id]
 * Updates a specific manager
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    // Authentication check
    const session = await auth();
    if (!session?.user?.email) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user has the required email domain
    const isAllowedDomain = ALLOWED_DOMAINS.some(domain => 
      session.user?.email?.endsWith(domain)
    );

    if (!isAllowedDomain) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return Response.json({ error: 'Invalid manager ID format' }, { status: 400 });
    }

    // Parse request body
    const body = await request.json();
    const { name, email, mobilePhone, role } = body;

    // Basic validation
    if (!name || !email) {
      return Response.json(
        { error: 'Name and email are required' },
        { status: 400 }
      );
    }

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return Response.json(
        { error: 'Invalid email format' },
        { status: 400 }
      );
    }

    // Get backoffice database connection
    const db = getBackofficeDb();

    // Check if manager exists
    const existingManager = await db
      .select()
      .from(managers)
      .where(eq(managers.managerId, id))
      .limit(1);

    if (existingManager.length === 0) {
      return Response.json({ error: 'Manager not found' }, { status: 404 });
    }

    // Check if email is taken by another manager (if changed)
    if (email.trim().toLowerCase() !== existingManager[0].email) {
      const emailTaken = await db
        .select()
        .from(managers)
        .where(eq(managers.email, email.trim().toLowerCase()))
        .limit(1);

      if (emailTaken.length > 0) {
        return Response.json(
          { error: 'Email is already taken by another manager' },
          { status: 409 }
        );
      }
    }

    // Update manager
    const updateData = {
      name: name.trim(),
      email: email.trim().toLowerCase(),
      mobilePhone: mobilePhone?.trim() || null,
      role: role?.trim() || null,
      updatedAt: new Date(),
    };

    const [updatedManager] = await db
      .update(managers)
      .set(updateData)
      .where(eq(managers.managerId, id))
      .returning();

    return Response.json(updatedManager);

  } catch (error) {
    console.error('Error updating manager:', error);
    
    // Handle unique constraint violation
    if (error instanceof Error && error.message.includes('unique constraint')) {
      return Response.json(
        { error: 'Email is already taken by another manager' },
        { status: 409 }
      );
    }

    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/managers/[id]
 * Deletes a specific manager
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    // Authentication check
    const session = await auth();
    if (!session?.user?.email) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user has the required email domain
    const isAllowedDomain = ALLOWED_DOMAINS.some(domain => 
      session.user?.email?.endsWith(domain)
    );

    if (!isAllowedDomain) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return Response.json({ error: 'Invalid manager ID format' }, { status: 400 });
    }

    // Get backoffice database connection
    const db = getBackofficeDb();

    // Check if manager exists
    const existingManager = await db
      .select()
      .from(managers)
      .where(eq(managers.managerId, id))
      .limit(1);

    if (existingManager.length === 0) {
      return Response.json({ error: 'Manager not found' }, { status: 404 });
    }

    // Delete the manager
    await db
      .delete(managers)
      .where(eq(managers.managerId, id));

    return Response.json({ message: 'Manager deleted successfully' });

  } catch (error) {
    console.error('Error deleting manager:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
