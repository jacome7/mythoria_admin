import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { adminService } from '@/db/services';
import { ALLOWED_DOMAINS } from '@/config/auth';
import { premiumEditionSummary } from '@/lib/premium-edition';

function metadataResult(story: NonNullable<Awaited<ReturnType<typeof adminService.featureStory>>>) {
  return story.premiumEdition
    ? { isFeatured: story.isFeatured, featureImageUri: story.featureImageUri }
    : story;
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

    // Check if this is an unfeature request
    if (body.unfeature) {
      const updatedStory = await adminService.unfeatureStory(storyId);

      if (!updatedStory) {
        return NextResponse.json({ error: 'Story not found' }, { status: 404 });
      }

      return NextResponse.json(metadataResult(updatedStory));
    }

    // Otherwise, this is a feature request
    const { featureImageUri } = body;

    // First check if story exists and is public
    const story = await adminService.getStoryById(storyId);
    if (!story) {
      return NextResponse.json({ error: 'Story not found' }, { status: 404 });
    }

    if (!story.isPublic) {
      return NextResponse.json({ error: 'Only public stories can be featured' }, { status: 400 });
    }

    const premium = premiumEditionSummary(story.features);
    if (premium) {
      if (premium.state !== 'published' || story.status !== 'published' || !story.featureImageUri)
        return NextResponse.json(
          { error: 'The published edition and its feature image must be available.' },
          { status: 409 },
        );
      if (featureImageUri !== undefined)
        return NextResponse.json(
          { error: 'Feature the published edition with its existing artwork.' },
          { status: 409 },
        );
    } else if (!featureImageUri || typeof featureImageUri !== 'string') {
      return NextResponse.json({ error: 'Feature image URI is required' }, { status: 400 });
    }

    const updatedStory = await adminService.featureStory(
      storyId,
      premium ? undefined : featureImageUri,
    );

    if (!updatedStory) {
      return NextResponse.json({ error: 'Failed to feature story' }, { status: 500 });
    }

    return NextResponse.json(metadataResult(updatedStory));
  } catch (error) {
    console.error('Error featuring story:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
