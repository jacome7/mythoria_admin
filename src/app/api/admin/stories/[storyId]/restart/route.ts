import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { isAllowedEmailDomain } from '@/config/auth';
import {
  restartStoryGeneration,
  StoryGenerationRestartError,
} from '@/services/story-generation-restart';

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

    if (!isAllowedEmailDomain(session.user.email)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { storyId } = await params;

    const result = await restartStoryGeneration({
      storyId,
      source: 'mythoria-admin',
      requestedBy: session.user.email,
    });

    const retryScheduled = result.status === 'retrying';
    return NextResponse.json(
      {
        success: true,
        message: retryScheduled
          ? 'Story restart queued; immediate dispatch failed and an automatic retry is scheduled'
          : 'Story generation restart dispatched successfully',
        ...result,
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
    console.error('Error restarting story generation:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
