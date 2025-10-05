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
    const searchTerm = searchParams.get('search') || '';
    const sortBy = (searchParams.get('sortBy') || 'serviceCode') as
      | 'serviceCode'
      | 'credits'
      | 'isActive'
      | 'createdAt';
    const sortOrder = (searchParams.get('sortOrder') || 'asc') as 'asc' | 'desc';

    // Get services data
    const services = await adminService.getPricingServices(
      page,
      limit,
      searchTerm,
      sortBy,
      sortOrder,
    );

    return NextResponse.json({
      services: services,
      pagination: {
        page,
        limit,
        totalCount: services.length, // This should be improved with proper count query
        totalPages: Math.ceil(services.length / limit),
        hasNext: services.length === limit,
        hasPrev: page > 1,
      },
    });
  } catch (error) {
    console.error('Error fetching services:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    // Check if user is authenticated and authorized
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user has admin access
    const isAllowedDomain = ALLOWED_DOMAINS.some((domain) => session.user?.email?.endsWith(domain));

    if (!isAllowedDomain) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { serviceCode, credits, isActive } = body;

    // Validate required fields
    if (!serviceCode || credits === undefined || isActive === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields: serviceCode, credits, isActive' },
        { status: 400 },
      );
    }

    // Create new service
    const newService = await adminService.createPricingService({
      serviceCode,
      credits,
      isActive,
    });

    return NextResponse.json(newService, { status: 201 });
  } catch (error) {
    console.error('Error creating service:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
