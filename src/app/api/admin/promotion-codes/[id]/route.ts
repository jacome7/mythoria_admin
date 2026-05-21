import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import type { Session } from 'next-auth';
import { adminService } from '@/db/services';
import { ALLOWED_DOMAINS } from '@/config/auth';

function ensureAdmin(session: Session | null) {
  const email = session?.user?.email;
  if (!email) return false;
  return ALLOWED_DOMAINS.some((domain) => email.endsWith(domain));
}

interface RouteParams {
  id: string;
}

interface PromotionCodeBody {
  code: string;
  type?: 'partner' | 'referral' | 'book_qr';
  creditAmount: number;
  maxGlobalRedemptions?: number | null;
  maxRedemptionsPerUser?: number;
  validFrom?: string | null;
  validUntil?: string | null;
  active?: boolean;
}

function errorResponse(err: unknown) {
  const code = (err as { code?: string }).code;
  if (code === 'code_exists') return NextResponse.json({ error: 'code_exists' }, { status: 409 });
  if (code === 'promotion_code_used')
    return NextResponse.json({ error: 'promotion_code_used' }, { status: 409 });
  if (code === 'promotion_code_active')
    return NextResponse.json({ error: 'promotion_code_active' }, { status: 409 });
  if (code === 'invalid_code_format')
    return NextResponse.json({ error: 'invalid_code_format' }, { status: 400 });
  if (code === 'invalid_credit_amount')
    return NextResponse.json({ error: 'invalid_credit_amount' }, { status: 400 });
  if (code === 'invalid_redemption_limit')
    return NextResponse.json({ error: 'invalid_redemption_limit' }, { status: 400 });
  if (code === 'invalid_validity_window')
    return NextResponse.json({ error: 'invalid_validity_window' }, { status: 400 });
  return null;
}

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

export async function PUT(req: NextRequest, { params }: { params: Promise<RouteParams> }) {
  try {
    const session = await auth();
    if (!ensureAdmin(session)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const raw = (await req.json()) as PromotionCodeBody;
    const body: Required<PromotionCodeBody> = {
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
      const updated = await adminService.updatePromotionCode(id, body);
      if (!updated) return NextResponse.json({ error: 'not_found' }, { status: 404 });
      const code = await adminService.getPromotionCodeById(id);
      return NextResponse.json({ promotionCode: code ?? updated });
    } catch (err) {
      const response = errorResponse(err);
      if (response) return response;
      throw err;
    }
  } catch (e) {
    console.error('Error updating promotion code', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<RouteParams> }) {
  try {
    const session = await auth();
    if (!ensureAdmin(session)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    try {
      const deleted = await adminService.deletePromotionCode(id);
      if (!deleted) return NextResponse.json({ error: 'not_found' }, { status: 404 });
      return NextResponse.json({ success: true });
    } catch (err) {
      const response = errorResponse(err);
      if (response) return response;
      throw err;
    }
  } catch (e) {
    console.error('Error deleting promotion code', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
