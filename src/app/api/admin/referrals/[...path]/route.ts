import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  requireAdminPermission,
  permissionForReferralOperation,
  ReferralAdminError,
} from '@/lib/referrals/permissions';
import { callReferralDomain } from '@/services/referrals';
export const dynamic = 'force-dynamic';
type Context = { params: Promise<{ path: string[] }> };
async function handle(request: NextRequest, context: Context) {
  try {
    if (request.method !== 'GET') {
      const origin = request.headers.get('origin');
      const expected = process.env.NEXTAUTH_URL || new URL(request.url).origin;
      if (!origin || origin !== new URL(expected).origin)
        throw new ReferralAdminError(403, 'Forbidden origin');
    }
    const path = (await context.params).path;
    if (path.length > 3) throw new ReferralAdminError(404, 'Not found');
    const [collection, id, action] = path;
    const body =
      request.method === 'GET' ? {} : z.record(z.string(), z.unknown()).parse(await request.json());
    const filter = Object.fromEntries(request.nextUrl.searchParams);
    let operation: string;
    let input: unknown = body;
    if (collection === 'owners') {
      if (!id) {
        operation = request.method === 'GET' ? 'list_referral_owners' : 'create_referral_owner';
      } else if (!action) {
        operation = request.method === 'GET' ? 'get_referral_owner' : 'update_referral_owner';
        input = { ...body, id };
      } else {
        operation = (
          {
            status: 'set_referral_owner_status',
            terms: 'set_referral_owner_rate',
            members: 'invite_referral_owner_member',
            suspendMember: 'suspend_referral_owner_member',
            summary: 'get_referral_summary',
          } as Record<string, string>
        )[action];
        input = { ...body, id, filters: filter };
      }
    } else if (collection === 'commissions') {
      operation = !id
        ? 'list_referral_commissions'
        : action === 'review'
          ? 'review_referral_commission'
          : action === 'adjust'
            ? 'create_referral_commission_adjustment'
            : '';
      input = id ? { ...body, id } : { ownerId: filter.ownerId, filters: filter };
    } else if (collection === 'settlements') {
      operation =
        id === 'preview'
          ? 'preview_referral_settlement'
          : action === 'paid'
            ? 'mark_referral_settlement_paid'
            : request.method === 'GET'
              ? 'list_referral_settlements'
              : 'create_referral_settlement';
      input =
        action === 'paid'
          ? { ...body, id }
          : request.method === 'GET'
            ? { ownerId: filter.ownerId, filters: filter }
            : body;
    } else if (collection === 'reconciliation') {
      operation = 'get_referral_reconciliation';
    } else throw new ReferralAdminError(404, 'Not found');
    if (!operation) throw new ReferralAdminError(404, 'Not found');
    const expectedMethod = /^(get|list)_/.test(operation)
      ? 'GET'
      : operation === 'update_referral_owner'
        ? 'PATCH'
        : 'POST';
    if (request.method !== expectedMethod) throw new ReferralAdminError(405, 'Method not allowed');
    if (request.method === 'GET' && !/^(get|list)_/.test(operation))
      throw new ReferralAdminError(405, 'Method not allowed');
    const actor = await requireAdminPermission(permissionForReferralOperation(operation));
    return NextResponse.json(
      { data: await callReferralDomain(operation, input, actor) },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch (error) {
    if (error instanceof ReferralAdminError)
      return NextResponse.json({ error: error.message }, { status: error.status });
    if (error instanceof z.ZodError)
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    console.error('[Referrals]', { event: 'admin_request_failed' });
    return NextResponse.json({ error: 'Request failed' }, { status: 500 });
  }
}
export const GET = handle;
export const POST = handle;
export const PATCH = handle;
