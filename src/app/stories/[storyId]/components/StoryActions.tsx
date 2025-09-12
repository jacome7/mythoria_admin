'use client';

import { useState } from 'react';
import Link from 'next/link';
import { StoryDetail } from '@/app/stories/[storyId]/hooks/useStoryDetail';

interface StoryActionsProps {
  story: StoryDetail;
  storyId: string;
  onStoryUpdate: (story: StoryDetail) => void;
}

export function StoryActions({ story, storyId, onStoryUpdate }: StoryActionsProps) {
  const [isFeatureModalOpen, setIsFeatureModalOpen] = useState(false);
  const [isUnfeatureModalOpen, setIsUnfeatureModalOpen] = useState(false);
  const [featureImagePath, setFeatureImagePath] = useState('');
  const [isUpdatingFeature, setIsUpdatingFeature] = useState(false);
  const [isRestartModalOpen, setIsRestartModalOpen] = useState(false);
  const [isRestartingGeneration, setIsRestartingGeneration] = useState(false);

  const handleFeatureStory = async () => {
    if (!featureImagePath.trim()) {
      alert('Please enter a valid image path');
      return;
    }

    try {
      setIsUpdatingFeature(true);
      const response = await fetch(`/api/admin/stories/${storyId}/feature`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ featureImageUri: featureImagePath.trim() }),
      });

      if (response.ok) {
        const updatedStory = await response.json();
        onStoryUpdate(updatedStory);
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ unfeature: true }),
      });

      if (response.ok) {
        const updatedStory = await response.json();
        onStoryUpdate(updatedStory);
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
        headers: { 'Content-Type': 'application/json' },
      });

      if (response.ok) {
        await response.json();
        setIsRestartModalOpen(false);
        alert('Story generation has been restarted successfully!');
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

  return (
    <>
      {story.status === 'writing' && (
        <button className="btn btn-warning" onClick={() => setIsRestartModalOpen(true)}>
          Restart Story Generation
        </button>
      )}
      {story.isPublic && !story.isFeatured && (
        <button className="btn btn-info" onClick={() => setIsFeatureModalOpen(true)}>
          Feature Story
        </button>
      )}
      {story.isFeatured && (
        <button className="btn btn-warning" onClick={() => setIsUnfeatureModalOpen(true)}>
          Unfeature Story
        </button>
      )}
      <Link href="/stories" className="btn btn-outline">
        Back to Stories
      </Link>

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
                <span className="label-text-alt">
                  This will set the story as featured and update the image URI
                </span>
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

      {isRestartModalOpen && (
        <div className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg">Restart Story Generation</h3>
            <p className="py-4">
              Are you sure you want to restart the story generation workflow?
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
    </>
  );
}

