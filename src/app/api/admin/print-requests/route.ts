import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { adminService } from '@/db/services';

export async function GET(request: Request) {
  try {
    // Check if user is authenticated and authorized
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user has admin access (email domain is already validated in auth.ts)
    const allowedDomains = ["@mythoria.pt", "@caravanconcierge.com"];
    const isAllowedDomain = allowedDomains.some(domain => 
      session.user?.email?.endsWith(domain)
    );

    if (!isAllowedDomain) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '100');
    const search = searchParams.get('search') || '';
    const sortBy = (searchParams.get('sortBy') || 'requestedAt') as 'requestedAt' | 'status';
    const sortOrder = (searchParams.get('sortOrder') || 'desc') as 'asc' | 'desc';

    // Get print requests data
    const printRequests = await adminService.getPrintRequests(page, limit, search, sortBy, sortOrder);

    return NextResponse.json({
      data: printRequests,
      pagination: {
        page,
        limit,
        totalCount: printRequests.length, // Approximated for now
        totalPages: Math.ceil(printRequests.length / limit),
        hasNext: printRequests.length === limit,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error('Error fetching print requests:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
