import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { adminService } from '@/db/services';
import { ALLOWED_DOMAINS } from '@/config/auth';
import { getLatestChapterVersions } from '@/lib/storyChapters';

// Minimal chapter shape expected from adminService.getStoryWithChapters
type ChapterResult = {
  chapterNumber: number;
  version: number;
  id?: string;
  title?: string;
  imageUri?: string | null;
  imageThumbnailUri?: string | null;
  htmlContent?: string;
  audioUri?: string | null;
  createdAt?: string;
  updatedAt?: string;
} & Record<string, unknown>;

export async function GET(request: Request, { params }: { params: Promise<{ storyId: string }> }) {
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
      coverUri: storyWithChapters.coverUri,
      backcoverUri: storyWithChapters.backcoverUri,
      imageCacheKey: Date.now().toString(),
      // Add other fields as needed
    };

    // Requirement: only return the most recent version of each chapter
    const latestChapters = getLatestChapterVersions(storyWithChapters.chapters as ChapterResult[]);

    return NextResponse.json(
      {
        story: transformedStory,
        chapters: latestChapters,
      },
      { headers: { 'Cache-Control': 'private, no-store, max-age=0' } },
    );
  } catch (error) {
    console.error('Error fetching story chapters:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
