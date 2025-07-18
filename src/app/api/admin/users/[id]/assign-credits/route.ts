import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { adminService } from '@/db/services';

export async function POST(
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
    const allowedDomains = ["@mythoria.pt", "@caravanconcierge.com"];
    const isAllowedDomain = allowedDomains.some(domain => 
      session.user?.email?.endsWith(domain)
    );

    if (!isAllowedDomain) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    
    const { amount, eventType } = body;

    // Validate input
    if (!amount || amount < 1 || amount > 200) {
      return NextResponse.json({ error: 'Amount must be between 1 and 200' }, { status: 400 });
    }

    if (!['refund', 'voucher', 'promotion'].includes(eventType)) {
      return NextResponse.json({ error: 'Invalid event type' }, { status: 400 });
    }

    // Check if user exists
    const user = await adminService.getUserById(id);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Assign credits
    await adminService.assignCreditsToUser(
      id, 
      amount, 
      eventType
    );

    // Get updated balance
    const newBalance = await adminService.getUserCreditBalance(id);

    return NextResponse.json({ 
      success: true, 
      newBalance,
      message: `Successfully assigned ${amount} credits to ${user.displayName}` 
    });
  } catch (error) {
    console.error('Error assigning credits:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
