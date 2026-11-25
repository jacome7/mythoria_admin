import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { adminService } from '@/db/services';
import { ALLOWED_DOMAINS } from '@/config/auth';
import { premiumEditionSummary } from '@/lib/premium-edition';
import { isPremiumAudiobookPending, premiumAudiobookMetadata } from '@/lib/premium-audiobook';

export async function GET(request: Request, { params }: { params: Promise<{ storyId: string }> }) {
  try {
    // Check if user is authenticated and authorized
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user has admin access (email domain is already validated in auth.ts)
    const isAllowedDomain = ALLOWED_DOMAINS.some((domain) => session.user?.email?.endsWith(domain));

    if (!isAllowedDomain) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { storyId } = await params;

    // Get story data with author information
    const story = await adminService.getStoryByIdWithAuthor(storyId);

    if (!story) {
      return NextResponse.json({ error: 'Story not found' }, { status: 404 });
    }

    const premiumEdition = story.premiumEdition;
    const premiumAudio =
      premiumEdition?.state === 'published' && story.status === 'published'
        ? premiumAudiobookMetadata(premiumEdition.revision, story.audiobookUri)
        : null;
    return NextResponse.json(
      {
        ...story,
        premiumEdition,
        ...(premiumEdition && {
          audiobookUri: null,
          audiobookStatus:
            premiumEdition.state === 'published' &&
            isPremiumAudiobookPending(premiumEdition.revision, story.audiobookUri)
              ? 'generating'
              : story.audiobookStatus === 'failed'
                ? 'failed'
                : premiumAudio
                  ? 'completed'
                  : null,
          hasAudio: Boolean(premiumAudio),
          premiumAudio,
        }),
      },
      {
        headers: { 'Cache-Control': 'private, no-store' },
      },
    );
  } catch (error) {
    console.error('Error fetching story:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ storyId: string }> },
) {
  try {
    // Check if user is authenticated and authorized
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user has admin access (email domain is already validated in auth.ts)
    const isAllowedDomain = ALLOWED_DOMAINS.some((domain) => session.user?.email?.endsWith(domain));

    if (!isAllowedDomain) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { storyId } = await params;
    const body = await request.json();
    const current = await adminService.getStoryById(storyId);
    if (!current) return NextResponse.json({ error: 'Story not found' }, { status: 404 });
    if (premiumEditionSummary(current.features) || premiumEditionSummary(body?.features)) {
      return NextResponse.json(
        { error: 'Published edition data is managed by the premium workflow.' },
        { status: 409 },
      );
    }

    // Update story
    const updatedStory = await adminService.updateStory(storyId, body);

    if (!updatedStory) {
      return NextResponse.json({ error: 'Story not found' }, { status: 404 });
    }

    return NextResponse.json(updatedStory);
  } catch (error) {
    console.error('Error updating story:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
