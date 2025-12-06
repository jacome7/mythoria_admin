import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { auth } from '@/auth';
import { ALLOWED_DOMAINS } from '@/config/auth';
import { adminService } from '@/db/services';
import { publishAudiobookRequest } from '@/lib/pubsub';
import { getDefaultVoice, isValidVoice } from '@/lib/voice-options';

export async function POST(request: Request, { params }: { params: Promise<{ storyId: string }> }) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const isAllowedDomain = ALLOWED_DOMAINS.some((domain) => session.user?.email?.endsWith(domain));
    if (!isAllowedDomain) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { storyId } = await params;
    if (!storyId) {
      return NextResponse.json({ error: 'Story ID is required' }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const requestedVoice = typeof body.voice === 'string' ? body.voice : undefined;
    const includeBackgroundMusic = body.includeBackgroundMusic !== false;

    const voice =
      requestedVoice && isValidVoice(requestedVoice) ? requestedVoice : getDefaultVoice();

    const story = await adminService.getStoryByIdWithAuthor(storyId);
    if (!story) {
      return NextResponse.json({ error: 'Story not found' }, { status: 404 });
    }

    if (story.status !== 'published') {
      return NextResponse.json(
        { error: 'Story must be published before narration can run' },
        { status: 400 },
      );
    }

    const runId = uuidv4();

    await adminService.updateStory(storyId, {
      audiobookStatus: 'generating',
    });

    try {
      await publishAudiobookRequest({
        storyId,
        runId,
        voice,
        includeBackgroundMusic,
        requestedBy: session.user.email,
        requestedAt: new Date().toISOString(),
        source: 'admin-portal',
      });
    } catch (error) {
      console.error('Failed to publish audiobook request from admin portal', error);
      await adminService.updateStory(storyId, {
        audiobookStatus: story.audiobookStatus ?? null,
      });
      return NextResponse.json(
        { error: 'Failed to enqueue audiobook generation request' },
        { status: 500 },
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Narration requested. Refresh to monitor the status.',
        storyId,
        runId,
        voice,
        includeBackgroundMusic,
      },
      { status: 202 },
    );
  } catch (error) {
    console.error('Unexpected error in admin audiobook generation route:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
