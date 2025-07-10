/**
 * Workflow Monitoring API Routes
 * Admin endpoints for monitoring and managing workflow execution status
 */

import { NextRequest, NextResponse } from 'next/server';
import { workflowMonitor } from '@/services/workflow-monitor';

/**
 * GET /api/admin/workflows
 * Check status of all running workflows
 */
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const action = url.searchParams.get('action');

    if (action === 'status') {
      const statuses = await workflowMonitor.checkAllRunningWorkflows();

      const summary = {
        total: statuses.length,
        statusMatch: statuses.filter(s => s.statusMatch).length,
        statusMismatch: statuses.filter(s => !s.statusMatch).length,
        stale: statuses.filter(s => s.isStale).length,
        needsSync: statuses.filter(s => !s.statusMatch || s.isStale).length
      };

      return NextResponse.json({
        success: true,
        summary,
        workflows: statuses
      });
    }

    if (action === 'health') {
      const statuses = await workflowMonitor.checkAllRunningWorkflows();
      
      return NextResponse.json({
        success: true,
        healthy: true,
        timestamp: new Date().toISOString(),
        runningWorkflows: statuses.length
      });
    }

    return NextResponse.json({
      success: false,
      error: 'Invalid action parameter'
    }, { status: 400 });

  } catch (error) {
    console.error('Admin API: Failed to check workflow statuses', error);

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    }, { status: 500 });
  }
}

/**
 * POST /api/admin/workflows
 * Synchronize workflow runs
 */
export async function POST(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const action = url.searchParams.get('action');

    if (action === 'sync-all') {
      const results = await workflowMonitor.syncAllWorkflows();

      const summary = {
        total: results.length,
        completed: results.filter(r => r.newStatus === 'completed').length,
        failed: results.filter(r => r.newStatus === 'failed').length,
        cancelled: results.filter(r => r.newStatus === 'cancelled').length,
        staleTimeouts: results.filter(r => r.syncReason === 'stale_timeout').length
      };

      return NextResponse.json({
        success: true,
        summary,
        synced: results
      });
    }

    if (action === 'cleanup-stale') {
      const results = await workflowMonitor.cleanupStaleWorkflows();

      const summary = {
        cleaned: results.length,
        failed: results.filter(r => r.newStatus === 'failed').length
      };

      return NextResponse.json({
        success: true,
        summary,
        cleaned: results
      });
    }

    return NextResponse.json({
      success: false,
      error: 'Invalid action parameter'
    }, { status: 400 });

  } catch (error) {
    console.error('Admin API: Failed to process workflow request', error);

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    }, { status: 500 });
  }
}
