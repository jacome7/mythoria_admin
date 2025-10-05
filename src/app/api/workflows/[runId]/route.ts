import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { adminService } from '@/db/services';

// GET /api/workflows/[runId] - Get workflow run details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ runId: string }> },
) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { runId } = await params;

    // Get workflow run details
    const workflowRun = await adminService.getWorkflowRunById(runId);

    if (!workflowRun) {
      return NextResponse.json({ error: 'Workflow run not found' }, { status: 404 });
    }

    // Get workflow steps
    const steps = await adminService.getWorkflowSteps(runId);

    return NextResponse.json({
      workflowRun,
      steps,
    });
  } catch (error) {
    console.error('Error fetching workflow run:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
