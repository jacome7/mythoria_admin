import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { adminService } from '@/db/services';
import { TicketService } from '@/lib/ticketing/service';

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
    const [usersCount, storiesCount, ticketMetrics] = await Promise.all([
      adminService.getTotalAuthorsCount(),
      adminService.getTotalStoriesCount(),
      TicketService.getMetrics()
    ]);

    const kpis = {
      users: usersCount,
      stories: storiesCount,
      openTickets: ticketMetrics.openTickets + ticketMetrics.inProgressTickets
    };

    return NextResponse.json(kpis);
  } catch (error) {
    console.error('Error fetching KPIs:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
