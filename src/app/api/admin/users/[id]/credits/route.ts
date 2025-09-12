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
    
    // Get user credit history
    const creditHistory = await adminService.getUserCreditHistory(id);
    const currentBalance = await adminService.getUserCreditBalance(id);

    return NextResponse.json({
      creditHistory,
      currentBalance,
    });
  } catch (error) {
    console.error('Error fetching credit history:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
