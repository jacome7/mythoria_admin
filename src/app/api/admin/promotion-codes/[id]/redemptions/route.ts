import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import type { Session } from 'next-auth';
import { adminService } from '@/db/services';
import { ALLOWED_DOMAINS } from '@/config/auth';

function ensureAdmin(session: Session | null) {
  const email = session?.user?.email;
  if (!email) return false;
  return ALLOWED_DOMAINS.some(domain => email.endsWith(domain));
}

interface RouteParams { id: string }

export async function GET(req: NextRequest, { params }: { params: Promise<RouteParams> }) {
  try {
    const session = await auth();
    if (!ensureAdmin(session)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { id } = await params;
    const searchParams = new URL(req.url).searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const result = await adminService.getPromotionCodeRedemptions(id, page, limit);
    return NextResponse.json(result);
  } catch (e) {
    console.error('Error listing promotion code redemptions', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
