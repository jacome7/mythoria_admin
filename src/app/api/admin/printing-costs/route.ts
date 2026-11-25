import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { ALLOWED_DOMAINS } from '@/config/auth';
import { isRegistrationRange } from '@/lib/analytics/registrations';
import { getPrintingCosts } from '@/db/services/printing-costs';

export async function GET(request: NextRequest) {
  try {
    const email = (await auth())?.user?.email;
    if (!email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!ALLOWED_DOMAINS.some((domain) => email.endsWith(domain))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const value = new URL(request.url).searchParams.get('range');
    const range = isRegistrationRange(value) ? value : '30d';
    return NextResponse.json(await getPrintingCosts(range));
  } catch (error) {
    console.error('Error fetching printing costs:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
