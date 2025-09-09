import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { adminService } from '@/db/services';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const allowedDomains = ["@mythoria.pt", "@caravanconcierge.com"]; 
    const isAllowedDomain = allowedDomains.some(domain => session.user?.email?.endsWith(domain));
    if (!isAllowedDomain) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    const stories = await adminService.getUserStories(id);
    return NextResponse.json({ data: stories });
  } catch (error) {
    console.error('Error fetching user stories:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
