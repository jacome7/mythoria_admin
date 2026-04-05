import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { ALLOWED_DOMAINS } from '@/config/auth';
import {
  getTokenUsageStatsForWindow,
  windowFromAiUsagePeriod,
  type ModelUsage,
  type ActionUsage,
  type DailyUsage,
  type TokenUsageStatsResult,
} from '@/db/services/workflowTokenUsage';

export type TokenUsageStatsResponse = TokenUsageStatsResult;
export type { ModelUsage, ActionUsage, DailyUsage };

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
    const period = searchParams.get('period') || '30d';
    const window = windowFromAiUsagePeriod(period);

    const response = await getTokenUsageStatsForWindow(window, { includeBreakdowns: true });

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching token usage stats:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
