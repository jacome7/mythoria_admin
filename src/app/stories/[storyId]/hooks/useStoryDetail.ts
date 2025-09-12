'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';

export interface StoryDetail {
  storyId: string;
  title: string;
  author: {
    authorId: string;
    displayName: string;
    email: string;
  };
  status: 'draft' | 'writing' | 'published';
  chapterCount: number;
  createdAt: string;
  updatedAt: string;
  isPublic: boolean;
  isFeatured: boolean;
  interiorPdfUri: string | null;
  coverPdfUri: string | null;
  plotDescription: string | null;
  synopsis: string | null;
  place: string | null;
  additionalRequests: string | null;
  targetAudience: string | null;
  novelStyle: string | null;
  graphicalStyle: string | null;
  featureImageUri: string | null;
}

export function useStoryDetail(storyId: string, isReady: boolean) {
  const router = useRouter();
  const [story, setStory] = useState<StoryDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchStory = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/admin/stories/${storyId}`);
      if (response.ok) {
        const storyData = await response.json();
        setStory(storyData);
      } else if (response.status === 404) {
        router.push('/stories');
      } else {
        console.error('Failed to fetch story');
      }
    } catch (error) {
      console.error('Error fetching story:', error);
    } finally {
      setIsLoading(false);
    }
  }, [storyId, router]);

  useEffect(() => {
    if (isReady) {
      fetchStory();
    }
  }, [isReady, fetchStory]);

  return { story, isLoading, fetchStory, setStory };
}

