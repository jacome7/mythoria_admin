import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { ALLOWED_DOMAINS } from '@/config/auth';
import { adminService } from '@/db/services';
import {
  normalizeRegistrationAggregation,
  isRegistrationRange,
  type RegistrationRange,
} from '@/lib/analytics/registrations';

const DEFAULT_RANGE: RegistrationRange = '30d';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const isAllowedDomain = ALLOWED_DOMAINS.some((domain) => session.user?.email?.endsWith(domain));
    if (!isAllowedDomain) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const range = parseRange(searchParams.get('range'));

    const aggregation = await adminService.getAuthorRegistrations(range);
    const buckets = normalizeRegistrationAggregation(aggregation);
    const totalRegistrations = buckets.reduce((sum, bucket) => sum + bucket.count, 0);

    return NextResponse.json({
      range,
      granularity: aggregation.granularity,
      startDate: aggregation.startDate,
      endDate: aggregation.endDate,
      generatedAt: new Date().toISOString(),
      totalRegistrations,
      buckets,
    });
  } catch (error) {
    console.error('Error fetching registration timeline:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

function parseRange(value: string | null): RegistrationRange {
  if (isRegistrationRange(value)) {
    return value;
  }
  return DEFAULT_RANGE;
}
