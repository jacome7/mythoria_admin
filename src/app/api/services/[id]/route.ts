import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { adminService } from '@/db/services';
import { ALLOWED_DOMAINS } from '@/config/auth';

export async function GET(
  request: Request, 
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Check if user is authenticated and authorized
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user has admin access
    const isAllowedDomain = ALLOWED_DOMAINS.some(domain => 
      session.user?.email?.endsWith(domain)
    );

    if (!isAllowedDomain) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    
    // Get service data
    const service = await adminService.getPricingServiceById(id);
    
    if (!service) {
      return NextResponse.json({ error: 'Service not found' }, { status: 404 });
    }

    return NextResponse.json(service);
  } catch (error) {
    console.error('Error fetching service:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(
  request: Request, 
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Check if user is authenticated and authorized
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user has admin access
    const isAllowedDomain = ALLOWED_DOMAINS.some(domain => 
      session.user?.email?.endsWith(domain)
    );

    if (!isAllowedDomain) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const { credits, isActive } = body;

    // Validate that only allowed fields are being updated
    const allowedUpdates = { credits, isActive };
    const updates = Object.fromEntries(
      Object.entries(allowedUpdates).filter(([, value]) => value !== undefined)
    );

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: 'No valid fields to update' }, 
        { status: 400 }
      );
    }

    // Update service
    const updatedService = await adminService.updatePricingService(id, updates);
    
    if (!updatedService) {
      return NextResponse.json({ error: 'Service not found' }, { status: 404 });
    }

    return NextResponse.json(updatedService);
  } catch (error) {
    console.error('Error updating service:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
