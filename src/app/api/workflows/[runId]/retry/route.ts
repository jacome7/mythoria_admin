import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { adminService } from '@/db/services';
import { publishStoryRequest } from '@/lib/pubsub';
import { ALLOWED_DOMAINS } from '@/config/auth';

// POST /api/workflows/[runId]/retry - Retry a failed workflow
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ runId: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const isAllowedDomain = ALLOWED_DOMAINS.some((domain) => session.user!.email!.endsWith(domain));

    if (!isAllowedDomain) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { runId } = await params;

    // Get the original workflow run
    const originalRun = await adminService.getWorkflowRunById(runId);

    if (!originalRun) {
      return NextResponse.json({ error: 'Workflow run not found' }, { status: 404 });
    }

    // Only allow retry of failed workflows
    if (originalRun.status !== 'failed') {
      return NextResponse.json(
        {
          error: 'Only failed workflows can be retried',
        },
        { status: 400 },
      );
    }

    // Generate a new runId for workflow tracking.
    // Only persist the retry run after Pub/Sub publish succeeds, to avoid orphan queued runs.
    const { randomUUID } = await import('crypto');
    const newRunId = randomUUID();

    try {
      await publishStoryRequest({
        storyId: originalRun.storyId,
        runId: newRunId,
        timestamp: new Date().toISOString(),
      });

      const workflowRun = await adminService.createWorkflowRun(
        originalRun.storyId,
        undefined,
        newRunId,
      );

      console.log(
        `Workflow retry request published for story ${originalRun.storyId}, run ${newRunId}`,
      );

      return NextResponse.json({
        success: true,
        message: 'Workflow retry initiated',
        newRunId: workflowRun.runId,
        originalRunId: runId,
      });
    } catch (pubsubError) {
      console.error('Failed to publish workflow retry request:', pubsubError);

      return NextResponse.json({ error: 'Failed to retry workflow' }, { status: 500 });
    }
  } catch (error) {
    console.error('Error retrying workflow:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
