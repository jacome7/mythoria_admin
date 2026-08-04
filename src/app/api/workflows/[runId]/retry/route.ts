import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { adminService } from '@/db/services';
import { ALLOWED_DOMAINS } from '@/config/auth';
import {
  restartStoryGeneration,
  StoryGenerationRestartError,
} from '@/services/story-generation-restart';

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

    const result = await restartStoryGeneration({
      storyId: originalRun.storyId,
      source: 'mythoria-admin',
      requestedBy: session.user.email,
    });
    const retryScheduled = result.status === 'retrying';

    return NextResponse.json(
      {
        success: true,
        message: retryScheduled
          ? 'Workflow retry queued; immediate dispatch failed and an automatic retry is scheduled'
          : 'Workflow retry dispatched successfully',
        ...result,
        newRunId: result.runId,
        originalRunId: runId,
        dispatchFailed: retryScheduled,
      },
      { status: retryScheduled ? 202 : 200 },
    );
  } catch (error) {
    if (error instanceof StoryGenerationRestartError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status },
      );
    }
    console.error('Error retrying workflow:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
