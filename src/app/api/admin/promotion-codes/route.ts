import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { adminService } from '@/db/services';
import { ALLOWED_DOMAINS } from '@/config/auth';

import type { Session } from 'next-auth';

function ensureAdmin(session: Session | null) {
  const email = session?.user?.email;
  if (!email) return false;
  return ALLOWED_DOMAINS.some(domain => email.endsWith(domain));
}

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!ensureAdmin(session)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const search = searchParams.get('search') || '';
    const type = searchParams.get('type') || undefined; // 'partner' | 'referral' | 'book_qr'
    const active = searchParams.get('active') || undefined; // 'true' | 'false'

    const result = await adminService.getPromotionCodes(page, limit, search, type, active);
    return NextResponse.json(result);
  } catch (e) {
    console.error('Error listing promotion codes', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

interface CreatePromotionCodeBody {
  code: string;
  type?: 'partner' | 'referral' | 'book_qr';
  creditAmount: number;
  maxGlobalRedemptions?: number | null;
  maxRedemptionsPerUser?: number;
  validFrom?: string | null;
  validUntil?: string | null;
  active?: boolean;
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!ensureAdmin(session)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const raw = (await req.json()) as CreatePromotionCodeBody;
    const body: Required<CreatePromotionCodeBody> = {
      code: raw.code,
      type: raw.type ?? 'partner',
      creditAmount: raw.creditAmount,
      maxGlobalRedemptions: raw.maxGlobalRedemptions ?? null,
      maxRedemptionsPerUser: raw.maxRedemptionsPerUser ?? 1,
      validFrom: raw.validFrom ?? null,
      validUntil: raw.validUntil ?? null,
      active: raw.active ?? true,
    };
    try {
      const created = await adminService.createPromotionCode(body);
      return NextResponse.json(created, { status: 201 });
    } catch (err) {
      const code = (err as { code?: string }).code;
      if (code === 'code_exists') return NextResponse.json({ error: 'code_exists' }, { status: 409 });
      if (code === 'invalid_code_format') return NextResponse.json({ error: 'invalid_code_format' }, { status: 400 });
      if (code === 'invalid_credit_amount') return NextResponse.json({ error: 'invalid_credit_amount' }, { status: 400 });
      if (code === 'invalid_validity_window') return NextResponse.json({ error: 'invalid_validity_window' }, { status: 400 });
      throw err;
    }
  } catch (e) {
    console.error('Error creating promotion code', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
