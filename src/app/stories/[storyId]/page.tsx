'use client';

import { useParams } from 'next/navigation';
import { useAdminAuth } from '@/lib/hooks/useAdminAuth';
import { formatAdminDateTime } from '@/lib/date-utils';
import { useStoryDetail } from '@/app/stories/[storyId]/hooks/useStoryDetail';
import { StoryHeader } from '@/app/stories/[storyId]/components/StoryHeader';
import { StoryActions } from '@/app/stories/[storyId]/components/StoryActions';
import { ChapterTable } from '@/app/stories/[storyId]/components/ChapterTable';
import { DownloadLinks } from '@/app/stories/[storyId]/components/DownloadLinks';

export default function StoryDetailPage() {
  const { session, loading } = useAdminAuth();
  const params = useParams();
  const storyId = params?.storyId as string;
  const { story, isLoading, setStory } = useStoryDetail(storyId, !loading && !!session?.user);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'badge-neutral';
      case 'writing': return 'badge-warning';
      case 'published': return 'badge-success';
      default: return 'badge-neutral';
    }
  };

  if (loading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="loading loading-spinner loading-lg"></div>
      </div>
    );
  }

  if (!session?.user || !story) {
    return null;
  }

  return (
    <div className="min-h-screen bg-base-200">
      <main className="container mx-auto p-6">
        <StoryHeader title={story.title}>
          <StoryActions story={story} storyId={storyId} onStoryUpdate={setStory} />
        </StoryHeader>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <div className="card bg-base-100 shadow-xl">
            <div className="card-body">
              <h2 className="card-title">Basic Information</h2>
              <div className="space-y-3">
                <div>
                  <span className="font-semibold">Status:</span>
                  <span className={`badge ${getStatusColor(story.status)} ml-2 capitalize`}>
                    {story.status}
                  </span>
                </div>
                <div>
                  <span className="font-semibold">Chapters:</span>
                  <span className="ml-2">{story.chapterCount}</span>
                </div>
                <div>
                  <span className="font-semibold">Created:</span>
                  <span className="ml-2">{formatAdminDateTime(story.createdAt)}</span>
                </div>
                <div>
                  <span className="font-semibold">Updated:</span>
                  <span className="ml-2">{formatAdminDateTime(story.updatedAt)}</span>
                </div>
                <div className="flex gap-2 mt-4">
                  {story.isPublic && <span className="badge badge-success">Public</span>}
                  {story.isFeatured && <span className="badge badge-info">Featured</span>}
                </div>
              </div>
            </div>
          </div>

          <div className="card bg-base-100 shadow-xl">
            <div className="card-body">
              <h2 className="card-title">Author</h2>
              <div className="space-y-3">
                <div>
                  <span className="font-semibold">Name:</span>
                  <span className="ml-2">{story.author.displayName}</span>
                </div>
                <div>
                  <span className="font-semibold">Email:</span>
                  <span className="ml-2">{story.author.email}</span>
                </div>
                <div>
                  <span className="font-semibold">Author ID:</span>
                  <span className="ml-2 text-sm opacity-70">{story.author.authorId}</span>
                </div>
              </div>
            </div>
          </div>

          <DownloadLinks story={story} storyId={storyId} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="card bg-base-100 shadow-xl">
            <div className="card-body">
              <h2 className="card-title">Story Content</h2>
              <div className="space-y-4">
                {story.plotDescription && (
                  <div>
                    <h3 className="font-semibold">Plot Description:</h3>
                    <p className="text-sm mt-1">{story.plotDescription}</p>
                  </div>
                )}
                {story.synopsis && (
                  <div>
                    <h3 className="font-semibold">Synopsis:</h3>
                    <p className="text-sm mt-1">{story.synopsis}</p>
                  </div>
                )}
                {story.place && (
                  <div>
                    <h3 className="font-semibold">Setting:</h3>
                    <p className="text-sm mt-1">{story.place}</p>
                  </div>
                )}
                {story.additionalRequests && (
                  <div>
                    <h3 className="font-semibold">Additional Requests:</h3>
                    <p className="text-sm mt-1">{story.additionalRequests}</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="card bg-base-100 shadow-xl">
            <div className="card-body">
              <h2 className="card-title">Story Properties</h2>
              <div className="space-y-3">
                {story.targetAudience && (
                  <div>
                    <span className="font-semibold">Target Audience:</span>
                    <span className="ml-2 capitalize">{story.targetAudience}</span>
                  </div>
                )}
                {story.novelStyle && (
                  <div>
                    <span className="font-semibold">Novel Style:</span>
                    <span className="ml-2 capitalize">{story.novelStyle}</span>
                  </div>
                )}
                {story.graphicalStyle && (
                  <div>
                    <span className="font-semibold">Graphical Style:</span>
                    <span className="ml-2 capitalize">{story.graphicalStyle}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6">
          <ChapterTable storyId={storyId} />
        </div>
      </main>
    </div>
  );
}

