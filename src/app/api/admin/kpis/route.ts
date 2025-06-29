import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { adminService } from '@/db/services';

export async function GET() {
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

    // Get KPI data
    const [usersCount, storiesCount, leadsCount, printRequestsCount] = await Promise.all([
      adminService.getTotalAuthorsCount(),
      adminService.getTotalStoriesCount(),
      adminService.getTotalLeadsCount(),
      adminService.getTotalPrintRequestsCount()
    ]);

    const kpis = {
      users: usersCount,
      stories: storiesCount,
      leads: leadsCount,
      printRequests: printRequestsCount,
      revenue: 6324 // Fixed value as requested
    };

    return NextResponse.json(kpis);
  } catch (error) {
    console.error('Error fetching KPIs:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
