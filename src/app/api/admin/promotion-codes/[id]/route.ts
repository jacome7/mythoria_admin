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

export async function GET(_req: NextRequest, { params }: { params: Promise<RouteParams> }) {
  try {
    const session = await auth();
    if (!ensureAdmin(session)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { id } = await params;
    const code = await adminService.getPromotionCodeById(id);
    if (!code) return NextResponse.json({ error: 'not_found' }, { status: 404 });
    return NextResponse.json({ promotionCode: code });
  } catch (e) {
    console.error('Error getting promotion code', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
