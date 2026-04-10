/**
 * Per-Run Workflow Monitoring API
 * Admin endpoints for monitoring and managing individual workflow runs
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
 * GET /api/admin/workflows/[runId]
 * Check status of a specific workflow run
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ runId: string }> }) {
  try {
    const authError = await requireAdminAccess();
    if (authError) {
      return authError;
    }

    const { runId } = await params;
    const url = new URL(req.url);
    const action = url.searchParams.get('action');

    if (action === 'status') {
      const status = await workflowMonitor.checkWorkflowRunStatus(runId);

      return NextResponse.json({
        success: true,
        workflow: status,
      });
    }

    if (action === 'logs') {
      try {
        const logs = await workflowMonitor.getWorkflowExecutionLogs(runId);

        return NextResponse.json({
          success: true,
          logs,
        });
      } catch (error) {
        return NextResponse.json(
          {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to retrieve workflow logs',
          },
          { status: 500 },
        );
      }
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Invalid action parameter. Use ?action=status or ?action=logs',
      },
      { status: 400 },
    );
  } catch (error) {
    console.error('Admin API: Failed to check workflow run status', error);

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
 * POST /api/admin/workflows/[runId]
 * Synchronize a specific workflow run
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ runId: string }> }) {
  try {
    const authError = await requireAdminAccess();
    if (authError) {
      return authError;
    }

    const { runId } = await params;
    const url = new URL(req.url);
    const action = url.searchParams.get('action');

    if (action === 'sync') {
      const result = await workflowMonitor.syncWorkflowStatus(runId, 'manual_sync');

      return NextResponse.json({
        success: true,
        synced: result,
      });
    }

    if (action === 'mark-failed') {
      // Force mark as failed - useful for stuck workflows
      const result = await workflowMonitor.forceMarkAsFailed(
        runId,
        'Manually marked as failed by admin',
      );

      return NextResponse.json({
        success: true,
        updated: result,
      });
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Invalid action parameter. Use ?action=sync or ?action=mark-failed',
      },
      { status: 400 },
    );
  } catch (error) {
    console.error('Admin API: Failed to sync workflow run', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 },
    );
  }
}
