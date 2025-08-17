'use client';

import { useSession } from 'next-auth/react';
import { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import AdminHeader from '../../../../components/AdminHeader';
import AdminFooter from '../../../../components/AdminFooter';
import AdminStoryReader from '../../../../components/AdminStoryReader';

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
}

export default function ReadStoryPage() {
  const { data: session, status } = useSession();
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
      const response = await fetch(`/api/admin/stories/${storyId}/chapters`);
      if (response.ok) {
        const data = await response.json();
        setStory(data.story);
        setChapters(data.chapters);
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
    if (status === 'loading') return;

    if (status === 'unauthenticated') {
      router.push('/auth/signin');
      return;
    }

    if (session?.user) {
      // Check if user has the required email domain
      const allowedDomains = ["@mythoria.pt", "@caravanconcierge.com"];
      const isAllowedDomain = allowedDomains.some(domain => 
        session.user?.email?.endsWith(domain)
      );

      if (!isAllowedDomain) {
        router.push('/auth/error');
        return;
      }

      // Fetch story data
      fetchStory();
    }
  }, [status, session, router, fetchStory]);

  // Show loading state while checking authentication
  if (status === 'loading' || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="loading loading-spinner loading-lg"></div>
      </div>
    );
  }

  // Don't render content if not authorized
  if (status === 'unauthenticated' || !session?.user) {
    return null;
  }

  if (error) {
    return (
      <div className="min-h-screen bg-base-200">
        <AdminHeader />
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
        <AdminFooter />
      </div>
    );
  }

  if (!story || chapters.length === 0) {
    return (
      <div className="min-h-screen bg-base-200">
        <AdminHeader />
        <main className="container mx-auto p-6">
          <div className="text-center">
            <h1 className="text-3xl font-bold mb-4">No Chapters Found</h1>
            <p className="text-lg mb-6">This story doesn&apos;t have any chapters!</p>
            <button
              onClick={() => router.push(`/stories/${storyId}`)}
              className="btn btn-primary"
            >
              Back to Story Details
            </button>
          </div>
        </main>
        <AdminFooter />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 text-black">
      <AdminHeader />
      
      {/* Story Reader - First page with cover and table of contents */}
      <AdminStoryReader
        storyId={storyId}
        story={story}
        chapters={chapters}
        currentChapter={0} // 0 = first page
      />

  <AdminFooter />
    </div>
  );
}
