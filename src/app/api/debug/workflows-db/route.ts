import { NextRequest, NextResponse } from 'next/server';
import { getWorkflowsDb } from '@/db';
import { tokenUsageTracking } from '@/db/schema/workflows/token-usage';
import { sql } from 'drizzle-orm';

export async function GET() {
  try {
    const db = getWorkflowsDb();
    
    // Simple test query to check if we can connect and get data
    const result = await db
      .select({
        count: sql<number>`COUNT(*)`,
        latestRecord: sql<string>`MAX(${tokenUsageTracking.createdAt})`
      })
      .from(tokenUsageTracking);

    return NextResponse.json({
      status: 'success',
      message: 'Database connection working',
      data: {
        totalRecords: Number(result[0]?.count) || 0,
        latestRecord: result[0]?.latestRecord || null
      }
    });

  } catch (error) {
    console.error('Database test error:', error);
    return NextResponse.json({
      status: 'error',
      message: 'Database connection failed',
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
