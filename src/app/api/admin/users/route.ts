import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { adminService } from '@/db/services';
import { ALLOWED_DOMAINS } from '@/config/auth';

export async function GET(request: Request) {
  try {
    // Check if user is authenticated and authorized
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user has admin access (email domain is already validated in auth.ts)
    const isAllowedDomain = ALLOWED_DOMAINS.some((domain) => session.user?.email?.endsWith(domain));

    if (!isAllowedDomain) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '100');
    const search = searchParams.get('search') || '';
    const sortBy = (searchParams.get('sortBy') || 'createdAt') as
      | 'displayName'
      | 'email'
      | 'createdAt'
      | 'lastLoginAt';
    const sortOrder = (searchParams.get('sortOrder') || 'desc') as 'asc' | 'desc';

    // Get users data
    const users = await adminService.getUsers(page, limit, search, sortBy, sortOrder);

    // Calculate pagination info
    // We'd need to add a separate count method to get total count
    const totalCount = users.length; // This is approximated for now

    return NextResponse.json({
      data: users,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
        hasNext: users.length === limit,
        hasPrev: page > 1,
      },
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
