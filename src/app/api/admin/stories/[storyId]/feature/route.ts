import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { adminService } from '@/db/services';

export async function PATCH(
  request: Request, 
  { params }: { params: Promise<{ storyId: string }> }
) {
  try {
    // Check if user is authenticated and authorized
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user has admin access (email domain is already validated in auth.ts)
    const allowedDomains = ["@mythoria.pt", "@caravanconcierge.com"];
    const isAllowedDomain = allowedDomains.some(domain => 
      session.user?.email?.endsWith(domain)
    );

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

      return NextResponse.json(updatedStory);
    }
    
    // Otherwise, this is a feature request
    const { featureImageUri } = body;
    
    if (!featureImageUri || typeof featureImageUri !== 'string') {
      return NextResponse.json({ error: 'Feature image URI is required' }, { status: 400 });
    }

    // First check if story exists and is public
    const story = await adminService.getStoryById(storyId);
    if (!story) {
      return NextResponse.json({ error: 'Story not found' }, { status: 404 });
    }

    if (!story.isPublic) {
      return NextResponse.json({ error: 'Only public stories can be featured' }, { status: 400 });
    }
    
    // Feature the story (set isFeatured = true and update featureImageUri)
    const updatedStory = await adminService.featureStory(storyId, featureImageUri);
    
    if (!updatedStory) {
      return NextResponse.json({ error: 'Failed to feature story' }, { status: 500 });
    }

    return NextResponse.json(updatedStory);
  } catch (error) {
    console.error('Error featuring story:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
