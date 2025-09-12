'use client';

import { useSession } from 'next-auth/react';
import { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import AdminStoryReader from '../../../../../../components/AdminStoryReader';

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
  coverUri: string;
  backcoverUri: string;
}

export default function ReadChapterPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const storyId = params?.storyId as string;
  const chapterNumber = parseInt(params?.chapterNumber as string);

  const [story, setStory] = useState<Story | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [currentChapter, setCurrentChapter] = useState<Chapter | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchChapter = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/admin/stories/${storyId}/chapters/${chapterNumber}`);
      if (response.ok) {
        const data = await response.json();
        setStory(data.story);
        // Ensure only the latest version of each chapter is kept (defensive in case API returns older versions)
        const latestByNumber: Record<number, Chapter> = {};
        for (const ch of data.chapters as Chapter[]) {
          const existing = latestByNumber[ch.chapterNumber];
          if (!existing || ch.version > existing.version) {
            latestByNumber[ch.chapterNumber] = ch;
          }
        }
        const deduped = Object.values(latestByNumber).sort((a, b) => a.chapterNumber - b.chapterNumber);
        setChapters(deduped);
        // Pick the latest version for the requested chapter number
        const latestRequested = deduped.find(c => c.chapterNumber === chapterNumber);
        setCurrentChapter(latestRequested || null);
      } else if (response.status === 404) {
        setError('Chapter not found');
      } else if (response.status === 403) {
        setError('Access denied');
      } else {
        setError('Failed to load chapter');
      }
    } catch (error) {
      console.error('Error fetching chapter:', error);
      setError('Failed to load chapter');
    } finally {
      setIsLoading(false);
    }
  }, [storyId, chapterNumber]);

  useEffect(() => {
    if (!loading && session?.user && storyId && chapterNumber) {
      fetchChapter();
    }
  }, [loading, session, fetchChapter, storyId, chapterNumber]);

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
            <button
              onClick={() => router.push(`/stories/${storyId}`)}
              className="btn btn-primary"
            >
              Back to Story Details
            </button>
          </div>
        </main>
      </div>
    );
  }

  if (!story || !currentChapter) {
    return (
      <div className="min-h-screen bg-base-200">
        <main className="container mx-auto p-6">
          <div className="text-center">
            <div className="text-6xl mb-4">📚</div>
            <h1 className="text-3xl font-bold mb-4">Chapter Not Found</h1>
            <p className="text-lg mb-6">The requested chapter could not be found.</p>
            <button
              onClick={() => router.push(`/stories/${storyId}/read`)}
              className="btn btn-primary"
            >
              Back to Story
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 text-black">
      
      {/* Story Reader */}
      <AdminStoryReader
        storyId={storyId}
        story={story}
        chapters={chapters}
        currentChapter={chapterNumber}
      />

    </div>
  );
}
