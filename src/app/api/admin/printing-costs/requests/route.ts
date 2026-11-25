import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { ALLOWED_DOMAINS } from '@/config/auth';
import { isRegistrationRange } from '@/lib/analytics/registrations';
import { getPrintingCostRequests } from '@/db/services/printing-costs';

export async function GET(request: NextRequest) {
  try {
    const email = (await auth())?.user?.email;
    if (!email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!ALLOWED_DOMAINS.some((domain) => email.endsWith(domain))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const params = new URL(request.url).searchParams;
    const value = params.get('range');
    const range = isRegistrationRange(value) ? value : '30d';
    const inputPage = params.get('page') ?? '1';
    const page = Number(inputPage);
    if (!/^[1-9]\d*$/.test(inputPage) || !Number.isSafeInteger(page) || page > 1000000) {
      return NextResponse.json({ error: 'Invalid page' }, { status: 400 });
    }
    return NextResponse.json(await getPrintingCostRequests(range, page));
  } catch (error) {
    console.error('Error fetching print requests:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
