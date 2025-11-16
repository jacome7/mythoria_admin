import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { ALLOWED_DOMAINS } from '@/config/auth';
import { adminService } from '@/db/services';
import { isRegistrationRange, type RegistrationRange } from '@/lib/analytics/registrations';
import { normalizeRevenueAggregation } from '@/lib/analytics/revenue';
import { normalizeServiceUsageAggregation } from '@/lib/analytics/service-usage';

const DEFAULT_RANGE: RegistrationRange = '30d';
const DEFAULT_CURRENCY = 'EUR';

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

    const [revenueAggregation, usageAggregation] = await Promise.all([
      adminService.getRevenueSnapshot(range),
      adminService.getServiceUsage(range),
    ]);

    const revenueBuckets = normalizeRevenueAggregation(revenueAggregation);
    const usageBuckets = normalizeServiceUsageAggregation(usageAggregation);

    const totals = revenueBuckets.reduce(
      (acc, bucket) => {
        acc.revenue += bucket.revenue;
        acc.transactions += bucket.transactions;
        return acc;
      },
      { revenue: 0, transactions: 0 },
    );
    const averageOrderValue = totals.transactions ? totals.revenue / totals.transactions : 0;

    const usageSummary = usageBuckets.reduce(
      (acc, bucket) => {
        acc.totalActions += bucket.totalActions;
        acc.totalCredits += bucket.totalCredits;
        return acc;
      },
      { totalActions: 0, totalCredits: 0 },
    );

    return NextResponse.json({
      range,
      granularity: revenueAggregation.granularity,
      startDate: revenueAggregation.startDate,
      endDate: revenueAggregation.endDate,
      generatedAt: new Date().toISOString(),
      currency: DEFAULT_CURRENCY,
      totals: {
        revenue: totals.revenue,
        transactions: totals.transactions,
        averageOrderValue,
      },
      buckets: revenueBuckets,
      usageSummary,
    });
  } catch (error) {
    console.error('Error fetching revenue snapshot:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

function parseRange(value: string | null): RegistrationRange {
  if (isRegistrationRange(value)) {
    return value;
  }
  return DEFAULT_RANGE;
}
