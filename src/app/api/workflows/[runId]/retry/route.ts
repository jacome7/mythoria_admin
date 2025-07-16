import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { adminService } from '@/db/services';
import { publishStoryRequest } from '@/lib/pubsub';

// POST /api/workflows/[runId]/retry - Retry a failed workflow
export async function POST(request: NextRequest, { params }: { params: Promise<{ runId: string }> }) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { runId } = await params;
    
    // Get the original workflow run
    const originalRun = await adminService.getWorkflowRunById(runId);
    
    if (!originalRun) {
      return NextResponse.json({ error: 'Workflow run not found' }, { status: 404 });
    }

    // Only allow retry of failed workflows
    if (originalRun.status !== 'failed') {
      return NextResponse.json({ 
        error: 'Only failed workflows can be retried' 
      }, { status: 400 });
    }

    // Generate a new runId for workflow tracking
    const { randomUUID } = await import('crypto');
    const newRunId = randomUUID();

    // Create a new workflow run record with the new runId
    const workflowRun = await adminService.createWorkflowRun(originalRun.storyId, undefined, newRunId);

    // Publish the Pub/Sub message to trigger the workflow
    try {
      await publishStoryRequest({
        storyId: originalRun.storyId,
        runId: workflowRun.runId,
        timestamp: new Date().toISOString(),
      });
      
      console.log(`Workflow retry request published for story ${originalRun.storyId}, run ${workflowRun.runId}`);
    } catch (pubsubError) {
      console.error('Failed to publish workflow retry request:', pubsubError);
      
      return NextResponse.json(
        { error: 'Failed to retry workflow' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Workflow retry initiated',
      newRunId: workflowRun.runId,
      originalRunId: runId,
    });
  } catch (error) {
    console.error('Error retrying workflow:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
