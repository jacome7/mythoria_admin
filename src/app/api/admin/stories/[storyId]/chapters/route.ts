import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { adminService } from '@/db/services';

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
  coverUri: storyWithChapters.coverUri,
  backcoverUri: storyWithChapters.backcoverUri,
      // Add other fields as needed
    };

    // Requirement: only return the most recent version of each chapter
  const latestChaptersByNumber: Map<number, ChapterResult> = new Map();
  for (const ch of storyWithChapters.chapters as ChapterResult[]) {
      const num = ch.chapterNumber as number;
      const existing = latestChaptersByNumber.get(num);
      if (!existing || (typeof ch.version === 'number' && ch.version > existing.version)) {
        latestChaptersByNumber.set(num, ch);
      }
    }
    // Convert map to sorted array
    const latestChapters = Array.from(latestChaptersByNumber.values())
      .sort((a, b) => (a.chapterNumber as number) - (b.chapterNumber as number));

    return NextResponse.json({
      story: transformedStory,
      chapters: latestChapters
    });
  } catch (error) {
    console.error('Error fetching story chapters:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
