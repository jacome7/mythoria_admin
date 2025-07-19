import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { adminService } from '@/db/services';

export async function GET(
  request: Request, 
  { params }: { params: Promise<{ storyId: string }> }
) {
  try {
    // Check if user is authenticated and authorized
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user has admin access
    const allowedDomains = ["@mythoria.pt", "@caravanconcierge.com"];
    const isAllowedDomain = allowedDomains.some(domain => 
      session.user?.email?.endsWith(domain)
    );

    if (!isAllowedDomain) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { storyId } = await params;
    
    // Get story data with chapters
    const storyWithChapters = await adminService.getStoryWithChapters(storyId);
    
    if (!storyWithChapters) {
      return NextResponse.json({ error: 'Story not found' }, { status: 404 });
    }

    // Transform story data for the story reader
    const transformedStory = {
      title: storyWithChapters.title,
      authorName: storyWithChapters.author.displayName,
      targetAudience: storyWithChapters.targetAudience,
      graphicalStyle: storyWithChapters.graphicalStyle,
      // Add other fields as needed
    };

    return NextResponse.json({
      story: transformedStory,
      chapters: storyWithChapters.chapters
    });
  } catch (error) {
    console.error('Error fetching story chapters:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
