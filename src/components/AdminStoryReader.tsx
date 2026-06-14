'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

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

interface AdminStoryReaderProps {
  storyId: string;
  story: {
    title: string;
    authorName: string;
    targetAudience?: string;
    graphicalStyle?: string;
    coverUri?: string;
    backcoverUri?: string;
  };
  chapters: Chapter[];
  currentChapter?: number;
}

export default function AdminStoryReader({
  storyId,
  story,
  chapters,
  currentChapter,
}: AdminStoryReaderProps) {
  const router = useRouter();
  const [isContentLoaded, setIsContentLoaded] = useState(false);
  const [showTableOfContents, setShowTableOfContents] = useState(false);

  // Determine what to show based on current chapter
  const isFirstPage = !currentChapter || currentChapter === 0;
  const currentChapterData = currentChapter
    ? chapters.find((ch) => ch.chapterNumber === currentChapter)
    : null;
  const totalChapters = chapters.length;

  // Mark content as loaded after a short delay
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsContentLoaded(true);
    }, 100);

    return () => clearTimeout(timer);
  }, []);

  // Navigation functions
  const navigateToChapter = (chapterNumber: number) => {
    if (chapterNumber === 0) {
      router.push(`/stories/${storyId}/read`);
    } else {
      router.push(`/stories/${storyId}/read/chapter/${chapterNumber}`);
    }
  };

  const navigateToNextChapter = () => {
    if (isFirstPage) {
      navigateToChapter(1);
    } else if (currentChapter && currentChapter < totalChapters) {
      navigateToChapter(currentChapter + 1);
    }
  };

  const navigateToPreviousChapter = () => {
    if (currentChapter && currentChapter > 1) {
      navigateToChapter(currentChapter - 1);
    } else if (currentChapter === 1) {
      navigateToChapter(0); // Go to first page
    }
  };

  // Convert relative URLs to absolute URLs for images
  const toAbsoluteImageUrl = (uri: string | null) => {
    if (!uri) return null;
    if (uri.startsWith('http')) return uri;
    return `${process.env.NEXT_PUBLIC_APP_URL || 'https://mythoria.pt'}${uri}`;
  };

  // Render first page content
  const renderFirstPage = () => (
    <div className="story-container max-w-4xl mx-auto p-8 bg-white text-black">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold mb-4 text-black">{story.title}</h1>
        <p className="text-xl text-gray-700 mb-8">by {story.authorName}</p>
        {/* Front Cover Image (after title/author) */}
        {story.coverUri && toAbsoluteImageUrl(story.coverUri) && (
          <div className="flex justify-center mb-8">
            <Image
              src={toAbsoluteImageUrl(story.coverUri)!}
              alt="Front Cover"
              className="rounded-lg shadow-md"
              width={400}
              height={600}
              style={{ height: 'auto', maxWidth: '100%' }}
              priority
            />
          </div>
        )}
      </div>

      {/* Table of Contents */}
      <div className="bg-gray-50 rounded-lg p-6 mb-8">
        <h2 className="text-2xl font-bold mb-4 text-center text-black">Table of Contents</h2>
        <div className="space-y-2">
          {chapters.map((chapter) => (
            <button
              key={chapter.id}
              onClick={() => navigateToChapter(chapter.chapterNumber)}
              className="toc-button w-full text-left p-3 rounded bg-white text-black hover:bg-gray-100 transition-colors"
              aria-label={`Go to chapter ${chapter.chapterNumber}: ${chapter.title}`}
            >
              <span className="font-medium">
                {chapter.chapterNumber}. {chapter.title}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Start Reading Button */}
      <div className="text-center">
        <button
          onClick={() => navigateToChapter(1)}
          className="btn btn-primary btn-lg"
          disabled={chapters.length === 0}
        >
          Start Reading
        </button>
      </div>

      {/* Back Cover Image (after table of contents and start button) */}
      {story.backcoverUri && toAbsoluteImageUrl(story.backcoverUri) && (
        <div className="mt-12 flex justify-center">
          <Image
            src={toAbsoluteImageUrl(story.backcoverUri)!}
            alt="Back Cover"
            className="rounded-lg shadow-sm"
            width={400}
            height={600}
            style={{ height: 'auto', maxWidth: '100%' }}
          />
        </div>
      )}
    </div>
  );

  // Render chapter content
  const renderChapter = () => {
    if (!currentChapterData) {
      return (
        <div className="story-container max-w-4xl mx-auto p-8">
          <div className="text-center py-16">
            <h2 className="text-2xl font-bold mb-4">Chapter not found</h2>
            <p className="text-lg text-gray-600 mb-6">The requested chapter could not be found.</p>
            <button onClick={() => navigateToChapter(0)} className="btn btn-primary">
              Back to Story
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="story-container max-w-4xl mx-auto p-8 bg-white text-black">
        <div className="mb-8">
          <h2 className="text-3xl font-bold mb-6 text-center text-black">
            {currentChapterData.title}
          </h2>

          {/* Chapter Image */}
          {currentChapterData.imageUri && toAbsoluteImageUrl(currentChapterData.imageUri) && (
            <div className="text-center mb-6">
              <Image
                src={toAbsoluteImageUrl(currentChapterData.imageUri)!}
                alt={`Chapter ${currentChapterData.chapterNumber} illustration`}
                className="rounded-lg shadow-lg"
                width={600}
                height={400}
                style={{ maxWidth: '100%', height: 'auto' }}
              />
            </div>
          )}

          {/* Chapter Content */}
          <div
            className="prose prose-lg max-w-none text-black"
            dangerouslySetInnerHTML={{ __html: currentChapterData.htmlContent }}
          />
        </div>

        {/* Navigation Controls */}
        <div className="flex justify-between items-center py-8 border-t border-gray-200">
          <div>
            {(currentChapter && currentChapter > 1) || currentChapter === 1 ? (
              <button onClick={navigateToPreviousChapter} className="btn btn-outline">
                {currentChapter === 1 ? '← Back to Story' : `← Chapter ${currentChapter - 1}`}
              </button>
            ) : (
              <div></div>
            )}
          </div>

          <div className="text-center">
            <span className="text-sm text-gray-600">
              Chapter {currentChapter} of {totalChapters}
            </span>
          </div>

          <div>
            {currentChapter && currentChapter < totalChapters ? (
              <button onClick={navigateToNextChapter} className="btn btn-primary">
                Chapter {currentChapter + 1} →
              </button>
            ) : (
              <div></div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // Table of Contents Modal
  const renderTableOfContentsModal = () =>
    showTableOfContents && (
      <div className="modal modal-open">
        <div className="modal-box bg-white text-black">
          <h3 className="font-bold text-lg mb-4 text-black">Table of Contents</h3>
          <div className="space-y-2">
            <button
              onClick={() => {
                navigateToChapter(0);
                setShowTableOfContents(false);
              }}
              className="btn btn-ghost btn-sm w-full justify-start text-black"
            >
              Cover & Introduction
            </button>
            {chapters.map((chapter) => (
              <button
                key={chapter.id}
                onClick={() => {
                  navigateToChapter(chapter.chapterNumber);
                  setShowTableOfContents(false);
                }}
                className={`btn btn-ghost btn-sm w-full justify-start text-black ${
                  currentChapter === chapter.chapterNumber ? 'bg-gray-100' : ''
                }`}
              >
                {chapter.chapterNumber}. {chapter.title}
              </button>
            ))}
          </div>
          <div className="modal-action">
            <button onClick={() => setShowTableOfContents(false)} className="btn btn-sm">
              Close
            </button>
          </div>
        </div>
      </div>
    );

  return (
    <div className="story-reader min-h-screen bg-gray-100 text-black">
      {/* Reading Toolbar */}
      <div className="bg-white border-b border-gray-200 p-4 print:hidden">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <button
            onClick={() => router.push(`/stories/${storyId}`)}
            className="btn btn-ghost btn-sm"
          >
            ← Back to Story Details
          </button>

          <div className="flex items-center gap-2">
            <button onClick={() => setShowTableOfContents(true)} className="btn btn-ghost btn-sm">
              📋 Table of Contents
            </button>
          </div>
        </div>
      </div>

      {/* Story Content */}
      <div className="py-8">
        {!isContentLoaded ? (
          // Loading state
          <div className="flex flex-col items-center justify-center py-16">
            <div className="loading loading-spinner loading-lg mb-4"></div>
            <p className="text-lg text-gray-600">Loading story...</p>
          </div>
        ) : (
          // Story content
          <div>{isFirstPage ? renderFirstPage() : renderChapter()}</div>
        )}
      </div>

      {/* Table of Contents Modal */}
      {renderTableOfContentsModal()}
    </div>
  );
}
