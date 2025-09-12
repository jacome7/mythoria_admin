'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { StoryDetail } from '@/app/stories/[storyId]/hooks/useStoryDetail';

interface DownloadLinksProps {
  story: StoryDetail;
  storyId: string;
}

export function DownloadLinks({ story, storyId }: DownloadLinksProps) {
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

  return (
    <div className="card bg-base-100 shadow-xl">
      <div className="card-body">
        <h2 className="card-title">Files &amp; Links</h2>
        <div className="mb-4">
          <button
            className={`btn btn-primary btn-sm ${isGeneratingPdfs ? 'loading' : ''}`}
            onClick={handleGeneratePdfs}
            disabled={isGeneratingPdfs || story.status !== 'published'}
          >
            {isGeneratingPdfs ? 'Triggering...' : 'Generate PDFs (Cover & Interior)'}
          </button>
          {pdfGenMessage && (
            <div
              className={`mt-2 text-sm ${
                pdfGenMessage.includes('success') ? 'text-success' : 'text-error'
              }`}
            >
              {pdfGenMessage}
            </div>
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
              <Link href={`/stories/${storyId}/read`} className="btn btn-sm btn-primary ml-2">
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
  );
}

