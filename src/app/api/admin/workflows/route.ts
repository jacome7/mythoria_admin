/**
 * Workflow Monitoring API Routes
 * Admin endpoints for monitoring and managing workflow execution status
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { ALLOWED_DOMAINS } from '@/config/auth';
import { workflowMonitor } from '@/services/workflow-monitor';

async function requireAdminAccess() {
  const session = await auth();

  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const isAllowedDomain = ALLOWED_DOMAINS.some((domain) => session.user?.email?.endsWith(domain));

  if (!isAllowedDomain) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  return null;
}

/**
 * GET /api/admin/workflows
 * Check status of all running workflows
 */
export async function GET(req: NextRequest) {
  try {
    const authError = await requireAdminAccess();
    if (authError) {
      return authError;
    }

    const url = new URL(req.url);
    const action = url.searchParams.get('action');

    if (action === 'status') {
      const statuses = await workflowMonitor.checkAllRunningWorkflows();

      const summary = {
        total: statuses.length,
        statusMatch: statuses.filter((s) => s.statusMatch).length,
        statusMismatch: statuses.filter((s) => !s.statusMatch).length,
        stale: statuses.filter((s) => s.isStale).length,
        needsSync: statuses.filter((s) => !s.statusMatch || s.isStale).length,
      };

      return NextResponse.json({
        success: true,
        summary,
        workflows: statuses,
      });
    }

    if (action === 'health') {
      const statuses = await workflowMonitor.checkAllRunningWorkflows();
      const stale = statuses.filter((s) => s.isStale).length;
      const mismatches = statuses.filter((s) => !s.statusMatch).length;
      const healthy = stale === 0 && mismatches === 0;

      return NextResponse.json(
        {
          success: true,
          healthy,
          timestamp: new Date().toISOString(),
          runningWorkflows: statuses.length,
          stale,
          mismatches,
        },
        { status: healthy ? 200 : 503 },
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Invalid action parameter',
      },
      { status: 400 },
    );
  } catch (error) {
    console.error('Admin API: Failed to check workflow statuses', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 },
    );
  }
}

/**
 * POST /api/admin/workflows
 * Synchronize workflow runs
 */
export async function POST(req: NextRequest) {
  try {
    const authError = await requireAdminAccess();
    if (authError) {
      return authError;
    }

    const url = new URL(req.url);
    const action = url.searchParams.get('action');

    if (action === 'sync-all') {
      const results = await workflowMonitor.syncAllWorkflows();

      const summary = {
        total: results.length,
        completed: results.filter((r) => r.newStatus === 'completed').length,
        failed: results.filter((r) => r.newStatus === 'failed').length,
        cancelled: results.filter((r) => r.newStatus === 'cancelled').length,
        staleTimeouts: results.filter((r) => r.syncReason === 'stale_timeout').length,
      };

      return NextResponse.json({
        success: true,
        summary,
        synced: results,
      });
    }

    if (action === 'cleanup-stale') {
      const results = await workflowMonitor.cleanupStaleWorkflows();

      const summary = {
        cleaned: results.length,
        failed: results.filter((r) => r.newStatus === 'failed').length,
      };

      return NextResponse.json({
        success: true,
        summary,
        cleaned: results,
      });
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Invalid action parameter',
      },
      { status: 400 },
    );
  } catch (error) {
    console.error('Admin API: Failed to process workflow request', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 },
    );
  }
}
