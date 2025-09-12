'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { formatAdminDateTime } from '@/lib/date-utils';
import { useAdminAuth } from '@/lib/hooks/useAdminAuth';

interface StoryDetail {
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

export default function StoryDetailPage() {
  const { session, loading } = useAdminAuth();
  const router = useRouter();
  const params = useParams();
  const storyId = params?.storyId as string;

  const [story, setStory] = useState<StoryDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isFeatureModalOpen, setIsFeatureModalOpen] = useState(false);
  const [isUnfeatureModalOpen, setIsUnfeatureModalOpen] = useState(false);
  const [featureImagePath, setFeatureImagePath] = useState('');
  const [isUpdatingFeature, setIsUpdatingFeature] = useState(false);
  const [isRestartModalOpen, setIsRestartModalOpen] = useState(false);
  const [isRestartingGeneration, setIsRestartingGeneration] = useState(false);
  const [isGeneratingPdfs, setIsGeneratingPdfs] = useState(false);
  const [pdfGenMessage, setPdfGenMessage] = useState<string | null>(null);
  const handleGeneratePdfs = async () => {
    setPdfGenMessage(null);
    setIsGeneratingPdfs(true);
    try {
      const response = await fetch(`/api/stories/${storyId}/generate-pdfs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const result = await response.json();
      if (response.ok && result.success) {
        setPdfGenMessage('PDF generation triggered successfully!');
      } else {
        setPdfGenMessage(result.error || 'Failed to trigger PDF generation.');
      }
    } catch (err) {
      console.error('Failed to trigger PDF generation:', err);
      setPdfGenMessage('Failed to trigger PDF generation.');
    } finally {
      setIsGeneratingPdfs(false);
    }
  };

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
    if (!loading && session?.user) {
      fetchStory();
    }
  }, [loading, session, storyId, fetchStory]);

  const handleFeatureStory = async () => {
    if (!featureImagePath.trim()) {
      alert('Please enter a valid image path');
      return;
    }

    try {
      setIsUpdatingFeature(true);
      const response = await fetch(`/api/admin/stories/${storyId}/feature`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          featureImageUri: featureImagePath.trim(),
        }),
      });

      if (response.ok) {
        const updatedStory = await response.json();
        setStory(updatedStory);
        setIsFeatureModalOpen(false);
        setFeatureImagePath('');
        alert('Story has been featured successfully!');
      } else {
        const error = await response.json();
        alert(`Error: ${error.error}`);
      }
    } catch (error) {
      console.error('Error featuring story:', error);
      alert('Error featuring story');
    } finally {
      setIsUpdatingFeature(false);
    }
  };

  const handleUnfeatureStory = async () => {
    try {
      setIsUpdatingFeature(true);
      const response = await fetch(`/api/admin/stories/${storyId}/feature`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          unfeature: true,
        }),
      });

      if (response.ok) {
        const updatedStory = await response.json();
        setStory(updatedStory);
        setIsUnfeatureModalOpen(false);
        alert('Story has been unfeatured successfully!');
      } else {
        const error = await response.json();
        alert(`Error: ${error.error}`);
      }
    } catch (error) {
      console.error('Error unfeaturing story:', error);
      alert('Error unfeaturing story');
    } finally {
      setIsUpdatingFeature(false);
    }
  };

  const handleRestartGeneration = async () => {
    try {
      setIsRestartingGeneration(true);
      const response = await fetch(`/api/admin/stories/${storyId}/restart`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const result = await response.json();
        setIsRestartModalOpen(false);
        // Since we don't have a toast system, we'll use alert for now
        alert('Story generation has been restarted successfully!');
        console.log('Story generation restarted:', result);
      } else {
        const error = await response.json();
        alert(`Error: ${error.error}`);
      }
    } catch (error) {
      console.error('Error restarting story generation:', error);
      alert('Error restarting story generation');
    } finally {
      setIsRestartingGeneration(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'badge-neutral';
      case 'writing': return 'badge-warning';
      case 'published': return 'badge-success';
      default: return 'badge-neutral';
    }
  };

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

  if (!story) {
    return (
      <div className="min-h-screen bg-base-200">
        <main className="container mx-auto p-6">
          <div className="text-center">
            <h1 className="text-2xl font-bold">Story Not Found</h1>
            <Link href="/stories" className="btn btn-primary mt-4">
              Back to Stories
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-base-200">
      <main className="container mx-auto p-6">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <div className="breadcrumbs text-sm">
              <ul>
                <li><Link href="/stories">Stories</Link></li>
                <li>Story Details</li>
              </ul>
            </div>
            <h1 className="text-3xl font-bold">{story.title}</h1>
          </div>
          <div className="flex gap-2">
            {story.status === 'writing' && (
              <button
                className="btn btn-warning"
                onClick={() => setIsRestartModalOpen(true)}
              >
                Restart Story Generation
              </button>
            )}
            {story.isPublic && !story.isFeatured && (
              <button
                className="btn btn-info"
                onClick={() => setIsFeatureModalOpen(true)}
              >
                Feature Story
              </button>
            )}
            {story.isFeatured && (
              <button
                className="btn btn-warning"
                onClick={() => setIsUnfeatureModalOpen(true)}
              >
                Unfeature Story
              </button>
            )}
            <Link href="/stories" className="btn btn-outline">
              Back to Stories
            </Link>
          </div>
        </div>

        {/* Story Information Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          {/* Basic Information */}
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
                  {story.isPublic && (
                    <span className="badge badge-success">Public</span>
                  )}
                  {story.isFeatured && (
                    <span className="badge badge-info">Featured</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Author Information */}
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

          {/* Files & Links */}
          <div className="card bg-base-100 shadow-xl">
            <div className="card-body">
              <h2 className="card-title">Files & Links</h2>
              {/* PDF Generation Button */}
              <div className="mb-4">
                <button
                  className={`btn btn-primary btn-sm ${isGeneratingPdfs ? 'loading' : ''}`}
                  onClick={handleGeneratePdfs}
                  disabled={isGeneratingPdfs || story.status !== 'published'}
                >
                  {isGeneratingPdfs ? 'Triggering...' : 'Generate PDFs (Cover & Interior)'}
                </button>
                {pdfGenMessage && (
                  <div className={`mt-2 text-sm ${pdfGenMessage.includes('success') ? 'text-success' : 'text-error'}`}>{pdfGenMessage}</div>
                )}
              </div>
              <div className="space-y-3">
                <div>
                  <span className="font-semibold">Interior PDF:</span>
                  {story.interiorPdfUri ? (
                    <a
                      href={story.interiorPdfUri}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-sm btn-outline ml-2"
                    >
                      View Interior
                    </a>
                  ) : (
                    <span className="ml-2 text-gray-400">Not available</span>
                  )}
                </div>
                <div>
                  <span className="font-semibold">Cover PDF:</span>
                  {story.coverPdfUri ? (
                    <a
                      href={story.coverPdfUri}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-sm btn-outline ml-2"
                    >
                      View Cover Spread
                    </a>
                  ) : (
                    <span className="ml-2 text-gray-400">Not available</span>
                  )}
                </div>
                <div>
                  <span className="font-semibold">Read Story:</span>
                  {story.status === 'published' ? (
                    <Link
                      href={`/stories/${storyId}/read`}
                      className="btn btn-sm btn-primary ml-2"
                    >
                      Read Story
                    </Link>
                  ) : (
                    <span className="ml-2 text-gray-400">Story not published</span>
                  )}
                </div>
                {story.featureImageUri && (
                  <div>
                    <span className="font-semibold">Feature Image:</span>
                    <div className="ml-2 mt-2">
                      <Image
                        src={story.featureImageUri}
                        alt="Feature"
                        width={96}
                        height={96}
                        className="object-cover rounded"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Story Details */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Plot & Synopsis */}
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

          {/* Story Properties */}
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
      </main>

      {/* Feature Story Modal */}
      {isFeatureModalOpen && (
        <div className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg">Feature Story</h3>
            <p className="py-4">
              Enter the relative path to the feature image for this story:
            </p>
            <div className="form-control">
              <label className="label">
                <span className="label-text">Feature Image Path</span>
              </label>
              <input
                type="text"
                placeholder="e.g., /images/featured/story-image.jpg"
                className="input input-bordered w-full"
                value={featureImagePath}
                onChange={(e) => setFeatureImagePath(e.target.value)}
              />
              <label className="label">
                <span className="label-text-alt">This will set the story as featured and update the image URI</span>
              </label>
            </div>
            <div className="modal-action">
              <button
                className="btn btn-ghost"
                onClick={() => {
                  setIsFeatureModalOpen(false);
                  setFeatureImagePath('');
                }}
                disabled={isUpdatingFeature}
              >
                Cancel
              </button>
              <button
                className={`btn btn-info ${isUpdatingFeature ? 'loading' : ''}`}
                onClick={handleFeatureStory}
                disabled={isUpdatingFeature || !featureImagePath.trim()}
              >
                {isUpdatingFeature ? 'Updating...' : 'Feature Story'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Unfeature Story Modal */}
      {isUnfeatureModalOpen && (
        <div className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg">Unfeature Story</h3>
            <p className="py-4">
              Are you sure you want to unfeature this story? This will:
            </p>
            <div className="alert alert-warning">
              <div className="flex-1">
                <ul className="list-disc list-inside space-y-1">
                  <li>Remove the story from the featured section</li>
                  <li>Set isFeatured to false</li>
                  <li>Keep the feature image URI for future reference</li>
                </ul>
              </div>
            </div>
            <div className="modal-action">
              <button
                className="btn btn-ghost"
                onClick={() => setIsUnfeatureModalOpen(false)}
                disabled={isUpdatingFeature}
              >
                Cancel
              </button>
              <button
                className={`btn btn-warning ${isUpdatingFeature ? 'loading' : ''}`}
                onClick={handleUnfeatureStory}
                disabled={isUpdatingFeature}
              >
                {isUpdatingFeature ? 'Updating...' : 'Unfeature Story'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Restart Story Generation Modal */}
      {isRestartModalOpen && (
        <div className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg">Restart Story Generation</h3>
            <p className="py-4">
              Are you sure you want to restart the story generation workflow? This will:
            </p>
            <div className="alert alert-warning">
              <div className="flex-1">
                <ul className="list-disc list-inside space-y-1">
                  <li>Create a new workflow run for this story</li>
                  <li>Trigger the story generation workflow again</li>
                  <li>The story will remain in &quot;writing&quot; status</li>
                  <li>Any previous generation progress may be overwritten</li>
                </ul>
              </div>
            </div>
            <div className="modal-action">
              <button
                className="btn btn-ghost"
                onClick={() => setIsRestartModalOpen(false)}
                disabled={isRestartingGeneration}
              >
                Cancel
              </button>
              <button
                className={`btn btn-warning ${isRestartingGeneration ? 'loading' : ''}`}
                onClick={handleRestartGeneration}
                disabled={isRestartingGeneration}
              >
                {isRestartingGeneration ? 'Restarting...' : 'Restart Generation'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
