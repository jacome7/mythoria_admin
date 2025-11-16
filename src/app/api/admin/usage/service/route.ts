import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { ALLOWED_DOMAINS } from '@/config/auth';
import { adminService } from '@/db/services';
import {
  normalizeServiceUsageAggregation,
  SERVICE_USAGE_EVENT_TYPES,
} from '@/lib/analytics/service-usage';
import { isRegistrationRange, type RegistrationRange } from '@/lib/analytics/registrations';

const DEFAULT_RANGE: RegistrationRange = '30d';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    const userEmail = session?.user?.email;
    if (!userEmail) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const isAllowedDomain = ALLOWED_DOMAINS.some((domain) => userEmail.endsWith(domain));
    if (!isAllowedDomain) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const range = parseRange(searchParams.get('range'));

    const aggregation = await adminService.getServiceUsage(range);
    const buckets = normalizeServiceUsageAggregation(aggregation);
    const totalActions = buckets.reduce((sum, bucket) => sum + bucket.totalActions, 0);
    const totalCredits = buckets.reduce((sum, bucket) => sum + bucket.totalCredits, 0);

    return NextResponse.json({
      range,
      granularity: aggregation.granularity,
      startDate: aggregation.startDate,
      endDate: aggregation.endDate,
      generatedAt: new Date().toISOString(),
      totalActions,
      totalCredits,
      eventTypes: SERVICE_USAGE_EVENT_TYPES,
      buckets,
    });
  } catch (error) {
    console.error('Error fetching service usage timeline:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

function parseRange(value: string | null): RegistrationRange {
  if (isRegistrationRange(value)) {
    return value;
  }
  return DEFAULT_RANGE;
}
