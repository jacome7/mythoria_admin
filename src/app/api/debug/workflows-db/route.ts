import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { isAllowedEmailDomain } from '@/config/auth';
import { getWorkflowsDb } from '@/db';
import { tokenUsageTracking } from '@/db/schema/workflows/token-usage';
import { sql } from 'drizzle-orm';

export async function GET() {
  const session = await auth();

  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!isAllowedEmailDomain(session.user.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const db = getWorkflowsDb();

    const result = await db
      .select({
        count: sql<number>`COUNT(*)`,
        latestRecord: sql<string>`MAX(${tokenUsageTracking.createdAt})`,
      })
      .from(tokenUsageTracking);

    return NextResponse.json({
      status: 'success',
      data: {
        totalRecords: Number(result[0]?.count) || 0,
        latestRecord: result[0]?.latestRecord || null,
      },
    });
  } catch {
    console.error('[WORKFLOWS DB DEBUG] Database probe failed');
    return NextResponse.json(
      {
        status: 'error',
      },
      { status: 500 },
    );
  }
}
