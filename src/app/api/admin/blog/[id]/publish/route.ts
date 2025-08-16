import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { adminBlogService } from '@/db/services';

function ensureAdminEmail(email?: string | null) {
  if (!email) return false;
  const allowedDomains = ['@mythoria.pt', '@caravanconcierge.com'];
  return allowedDomains.some(d => email.endsWith(d));
}

export async function POST(req: Request) {
  // Derive id from URL path to avoid relying on context param types
  const match = req.url.match(/\/api\/admin\/blog\/([^/]+)\/publish/);
  const id = match ? decodeURIComponent(match[1]) : null;
  if (!id) return NextResponse.json({ error: 'Invalid blog id' }, { status: 400 });
  const session = await auth();
  if (!ensureAdminEmail(session?.user?.email)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const updated = await adminBlogService.publish(id);
  return NextResponse.json({ data: updated });
}
