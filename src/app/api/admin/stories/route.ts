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
    const status = searchParams.get('status') || '';
    const featured = searchParams.get('featured') || '';
    const sortBy = (searchParams.get('sortBy') || 'createdAt') as 'title' | 'createdAt' | 'status';
    const sortOrder = (searchParams.get('sortOrder') || 'desc') as 'asc' | 'desc';

    // Get stories data with author information
    const stories = await adminService.getStoriesWithAuthors(page, limit, search, status, featured, sortBy, sortOrder);

    return NextResponse.json({
      data: stories,
      pagination: {
        page,
        limit,
        totalCount: stories.length, // This should be improved with proper count query
        totalPages: Math.ceil(stories.length / limit),
        hasNext: stories.length === limit,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error('Error fetching stories:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
