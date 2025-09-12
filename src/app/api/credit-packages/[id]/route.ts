import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { adminService } from '@/db/services';
import { ALLOWED_DOMAINS } from '@/config/auth';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const resolvedParams = await params;
    const session = await auth();
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is from allowed domain
    const isAllowedDomain = ALLOWED_DOMAINS.some(domain => 
      session.user?.email?.endsWith(domain)
    );

    if (!isAllowedDomain) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const creditPackage = await adminService.getCreditPackageById(resolvedParams.id);
    
    if (!creditPackage) {
      return NextResponse.json({ error: 'Credit package not found' }, { status: 404 });
    }
    
    return NextResponse.json(creditPackage);
    
  } catch (error) {
    console.error('Error fetching credit package:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const resolvedParams = await params;
    const session = await auth();
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is from allowed domain
    const isAllowedDomain = ALLOWED_DOMAINS.some(domain => 
      session.user?.email?.endsWith(domain)
    );

    if (!isAllowedDomain) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const updatedPackage = await adminService.updateCreditPackage(resolvedParams.id, body);
    
    if (!updatedPackage) {
      return NextResponse.json({ error: 'Credit package not found' }, { status: 404 });
    }
    
    return NextResponse.json(updatedPackage);
    
  } catch (error) {
    console.error('Error updating credit package:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const resolvedParams = await params;
    const session = await auth();
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is from allowed domain
    const isAllowedDomain = ALLOWED_DOMAINS.some(domain => 
      session.user?.email?.endsWith(domain)
    );

    if (!isAllowedDomain) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await adminService.deleteCreditPackage(resolvedParams.id);
    
    return NextResponse.json({ success: true });
    
  } catch (error) {
    console.error('Error deleting credit package:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
