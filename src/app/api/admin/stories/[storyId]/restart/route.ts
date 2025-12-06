import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { adminService } from '@/db/services';
import { publishStoryRequest } from '@/lib/pubsub';
import { ALLOWED_DOMAINS } from '@/config/auth';

// POST /api/admin/stories/[storyId]/restart - Restart story generation workflow
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ storyId: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user has admin access
    const isAllowedDomain = ALLOWED_DOMAINS.some((domain) => session.user?.email?.endsWith(domain));

    if (!isAllowedDomain) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { storyId } = await params;

    // Verify the story exists and can be restarted from its current status
    const story = await adminService.getStoryByIdWithAuthor(storyId);

    if (!story) {
      return NextResponse.json({ error: 'Story not found' }, { status: 404 });
    }

    const canRestart = story.status === 'writing' || story.status === 'published';

    if (!canRestart) {
      return NextResponse.json(
        {
          error: 'Only stories in "writing" or "published" status can be restarted',
        },
        { status: 400 },
      );
    }

    // Generate a new runId for workflow tracking
    const { randomUUID } = await import('crypto');
    const runId = randomUUID();

    // Create a new workflow run record with the same runId
    const workflowRun = await adminService.createWorkflowRun(storyId, undefined, runId);

    // Publish the Pub/Sub message to trigger the workflow
    try {
      await publishStoryRequest({
        storyId: storyId,
        runId: workflowRun.runId,
        timestamp: new Date().toISOString(),
      });

      console.log(
        `Story generation restart request published for story ${storyId}, run ${workflowRun.runId}`,
      );
    } catch (pubsubError) {
      console.error('Failed to publish story restart request:', pubsubError);

      return NextResponse.json(
        { error: 'Failed to restart story generation workflow' },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Story generation restarted successfully',
      storyId: storyId,
      runId: workflowRun.runId,
      status: 'queued',
    });
  } catch (error) {
    console.error('Error restarting story generation:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
