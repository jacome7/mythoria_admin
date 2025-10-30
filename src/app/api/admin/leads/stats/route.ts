import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { adminService } from '@/db/services';
import { ALLOWED_DOMAINS } from '@/config/auth';

/**
 * GET /api/admin/leads/stats
 * Get lead statistics for dashboard/overview.
 */
export async function GET() {
  try {
    // Check authentication
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const isAllowedDomain = ALLOWED_DOMAINS.some((domain) => session.user?.email?.endsWith(domain));
    if (!isAllowedDomain) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get lead statistics
    const stats = await adminService.getLeadStats();

    if (!stats) {
      return NextResponse.json({
        totalLeads: 0,
        readyCount: 0,
        sentCount: 0,
        openCount: 0,
        clickCount: 0,
        softBounceCount: 0,
        hardBounceCount: 0,
        unsubCount: 0,
      });
    }

    return NextResponse.json(stats);
  } catch (error) {
    console.error('Error fetching lead stats:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
