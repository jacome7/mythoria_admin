import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { auth } from '@/auth';
import { ALLOWED_DOMAINS } from '@/config/auth';
import { adminService } from '@/db/services';
import { hasTrustedAdminOrigin } from '@/lib/admin-request-origin';
import { publishAudiobookRequest } from '@/lib/pubsub';
import { logAdminAudit } from '@/lib/audit';
import { isPremiumAudiobookPending } from '@/lib/premium-audiobook';
import {
  getAvailableVoices,
  getRecommendedVoice,
  getTTSProvider,
  isValidVoice,
} from '@/lib/voice-options';

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

    if (!hasTrustedAdminOrigin(request)) {
      console.warn(
        JSON.stringify({
          severity: 'WARNING',
          message: 'Admin audiobook request rejected: untrusted origin',
        }),
      );
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { storyId } = await params;
    if (!storyId) {
      return NextResponse.json({ error: 'Story ID is required' }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const requestedVoice = typeof body.voice === 'string' ? body.voice : undefined;
    const includeBackgroundMusic = body.includeBackgroundMusic !== false;

    if (requestedVoice && !isValidVoice(requestedVoice)) {
      return NextResponse.json(
        {
          error: `Invalid voice "${requestedVoice}". Allowed voices: ${getAvailableVoices()
            .map((option) => option.value)
            .join(', ')}`,
        },
        { status: 400 },
      );
    }

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

    const edition = story.premiumEdition;
    const premiumRevision = edition?.state === 'published' ? edition.revision : undefined;
    if (
      edition &&
      (!premiumRevision ||
        (body.premiumRevision !== undefined && body.premiumRevision !== premiumRevision))
    ) {
      return NextResponse.json(
        { error: 'The requested premium edition is unavailable' },
        { status: 409 },
      );
    }
    if (premiumRevision && isPremiumAudiobookPending(premiumRevision, story.audiobookUri)) {
      return NextResponse.json({ error: 'Narration is already in progress' }, { status: 409 });
    }

    const voice = requestedVoice || getRecommendedVoice(getTTSProvider(), story.targetAudience);

    const runId = uuidv4();

    try {
      await publishAudiobookRequest({
        storyId,
        runId,
        voice,
        includeBackgroundMusic,
        ...(premiumRevision && { premiumRevision }),
        requestedBy: session.user.email,
        requestedAt: new Date().toISOString(),
        source: 'admin-portal',
      });

      if (premiumRevision) {
        await logAdminAudit({
          actorEmail: session.user.email,
          action: 'premium_audiobook.requested',
          entityType: 'story',
          entityId: storyId,
          metadata: { revision: premiumRevision, runId },
        });
      } else {
        await adminService.updateStory(storyId, { audiobookStatus: 'generating' });
      }
    } catch (error) {
      console.error('Failed to publish audiobook request from admin portal', error);
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
