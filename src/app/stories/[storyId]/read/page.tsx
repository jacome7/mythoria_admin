'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import AdminStoryReader from '../../../../components/AdminStoryReader';
import { useAdminAuth } from '@/lib/hooks/useAdminAuth';
import { getLatestChapterVersions } from '@/lib/storyChapters';

interface Chapter {
  id: string;
  chapterNumber: number;
  title: string;
  imageUri: string | null;
  imageThumbnailUri: string | null;
  htmlContent: string;
  audioUri: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}

interface Story {
  title: string;
  authorName: string;
  targetAudience?: string;
  graphicalStyle?: string;
  coverUri: string | null;
  backcoverUri: string | null;
  imageCacheKey: string;
}

export default function ReadStoryPage() {
  const { session, loading } = useAdminAuth();
  const router = useRouter();
  const params = useParams();
  const storyId = params?.storyId as string;

  const [story, setStory] = useState<Story | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStory = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/admin/stories/${storyId}/chapters`, {
        cache: 'no-store',
      });
      if (response.ok) {
        const data = await response.json();
        setStory(data.story);
        // Defensive: ensure only latest version per chapterNumber (in case API changes or caching returns older list)
        setChapters(getLatestChapterVersions(data.chapters as Chapter[]));
      } else if (response.status === 404) {
        setError('Story not found');
      } else if (response.status === 403) {
        setError('Access denied');
      } else {
        setError('Failed to load story');
      }
    } catch (error) {
      console.error('Error fetching story:', error);
      setError('Failed to load story');
    } finally {
      setIsLoading(false);
    }
  }, [storyId]);

  useEffect(() => {
    if (!loading && session?.user) {
      fetchStory();
    }
  }, [loading, session, fetchStory]);

  // Show loading state while checking authentication
  if (loading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="loading loading-spinner loading-lg"></div>
      </div>
    );
  }

  // Don't render content if not authorized
  if (!session?.user) {
    return null;
  }

  if (error) {
    return (
      <div className="min-h-screen bg-base-200">
        <main className="container mx-auto p-6">
          <div className="text-center">
            <div className="text-6xl mb-4">📚</div>
            <h1 className="text-3xl font-bold mb-4">Error</h1>
            <p className="text-lg mb-6">{error}</p>
            <button onClick={() => router.push(`/stories/${storyId}`)} className="btn btn-primary">
              Back to Story Details
            </button>
          </div>
        </main>
      </div>
    );
  }

  if (!story || chapters.length === 0) {
    return (
      <div className="min-h-screen bg-base-200">
        <main className="container mx-auto p-6">
          <div className="text-center">
            <h1 className="text-3xl font-bold mb-4">No Chapters Found</h1>
            <p className="text-lg mb-6">This story doesn&apos;t have any chapters!</p>
            <button onClick={() => router.push(`/stories/${storyId}`)} className="btn btn-primary">
              Back to Story Details
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 text-black">
      {/* Story Reader - First page with cover and table of contents */}
      <AdminStoryReader
        storyId={storyId}
        story={story}
        chapters={chapters}
        currentChapter={0} // 0 = first page
      />
    </div>
  );
}
