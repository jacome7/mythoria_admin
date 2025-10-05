import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { adminService } from '@/db/services';
import { ALLOWED_DOMAINS } from '@/config/auth';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ storyId: string; chapterNumber: string }> },
) {
  try {
    // Check if user is authenticated and authorized
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user has admin access
    const isAllowedDomain = ALLOWED_DOMAINS.some((domain) => session.user?.email?.endsWith(domain));

    if (!isAllowedDomain) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { storyId, chapterNumber } = await params;

    const chapterNum = parseInt(chapterNumber);
    if (isNaN(chapterNum) || chapterNum < 1) {
      return NextResponse.json({ error: 'Invalid chapter number' }, { status: 400 });
    }

    // Get story data
    const story = await adminService.getStoryByIdWithAuthor(storyId);
    if (!story) {
      return NextResponse.json({ error: 'Story not found' }, { status: 404 });
    }

    // Get the specific chapter
    const chapter = await adminService.getStoryChapter(storyId, chapterNum);
    if (!chapter) {
      return NextResponse.json({ error: 'Chapter not found' }, { status: 404 });
    }

    // Get all chapters for navigation
    const allChapters = await adminService.getStoryChapters(storyId);

    // Transform story data for the story reader
    const transformedStory = {
      title: story.title,
      authorName: story.author.displayName,
      targetAudience: story.targetAudience,
      graphicalStyle: story.graphicalStyle,
      coverUri: story.coverUri,
      backcoverUri: story.backcoverUri,
      // Add other fields as needed
    };

    return NextResponse.json({
      story: transformedStory,
      chapters: allChapters,
      currentChapter: chapter,
    });
  } catch (error) {
    console.error('Error fetching story chapter:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
