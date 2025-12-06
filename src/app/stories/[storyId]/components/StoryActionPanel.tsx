'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { StoryDetail } from '@/app/stories/[storyId]/hooks/useStoryDetail';
import {
  useAudioPlayer,
  AudioChapterList,
  hasAudiobook,
  getAudioChapters,
} from '@/components/audio-player';
import { getAvailableVoices, getDefaultVoice } from '@/lib/voice-options';

interface StoryActionPanelProps {
  story: StoryDetail;
  storyId: string;
  onStoryRefresh: () => Promise<void>;
}

interface ChapterSummary {
  chapterNumber: number;
  title?: string | null;
  imageUri?: string | null;
}

const FALLBACK_TITLE = (chapterNumber: number) => `Chapter ${chapterNumber}`;

export function StoryActionPanel({ story, storyId, onStoryRefresh }: StoryActionPanelProps) {
  const [isGeneratingPdfs, setIsGeneratingPdfs] = useState(false);
  const [pdfGenMessage, setPdfGenMessage] = useState<string | null>(null);
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
  const [narrationMessage, setNarrationMessage] = useState<string | null>(null);
  const [chapters, setChapters] = useState<ChapterSummary[]>([]);
  const [isLoadingChapters, setIsLoadingChapters] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefreshAt, setLastRefreshAt] = useState<Date | null>(null);

  const audioAvailable = hasAudiobook(story.audiobookUri) || story.hasAudio;
  const [narrationPanelOpen, setNarrationPanelOpen] = useState(!audioAvailable);
  const [listenPanelOpen, setListenPanelOpen] = useState(audioAvailable);

  const [selectedVoice, setSelectedVoice] = useState(getDefaultVoice());
  const [includeBackgroundMusic, setIncludeBackgroundMusic] = useState(true);

  const voiceOptions = useMemo(() => getAvailableVoices(), []);

  const audioEndpoint = `/api/admin/stories/${storyId}/audio`;
  const audioChapters = useMemo(
    () => getAudioChapters(story.audiobookUri, chapters, FALLBACK_TITLE),
    [story.audiobookUri, chapters],
  );

  const audioPlayer = useAudioPlayer({
    audioEndpoint,
    totalChapters: audioChapters.length || story.chapterCount,
  });

  const fetchChapters = useCallback(async () => {
    setIsLoadingChapters(true);
    try {
      const response = await fetch(`/api/admin/stories/${storyId}/chapters`);
      if (!response.ok) {
        console.error('Failed to fetch chapters for listen panel');
        return;
      }
      const data = await response.json();
      const normalized: ChapterSummary[] = (data.chapters || []).map((chapter: ChapterSummary) => ({
        chapterNumber: chapter.chapterNumber,
        title: chapter.title,
        imageUri: chapter.imageUri,
      }));
      setChapters(normalized);
    } catch (error) {
      console.error('Error while loading chapters for narration tools', error);
    } finally {
      setIsLoadingChapters(false);
    }
  }, [storyId]);

  useEffect(() => {
    if (listenPanelOpen && audioAvailable && chapters.length === 0 && !isLoadingChapters) {
      fetchChapters();
    }
  }, [listenPanelOpen, audioAvailable, chapters.length, fetchChapters, isLoadingChapters]);

  const previousAudioAvailable = useRef(audioAvailable);
  useEffect(() => {
    if (!previousAudioAvailable.current && audioAvailable) {
      setListenPanelOpen(true);
      setNarrationPanelOpen(false);
      fetchChapters();
    }
    previousAudioAvailable.current = audioAvailable;
  }, [audioAvailable, fetchChapters]);

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
        setPdfGenMessage('PDF run dispatched. Peek back in a minute.');
      } else {
        setPdfGenMessage(result.error || 'Could not trigger PDF generation.');
      }
    } catch (error) {
      console.error('Failed to trigger PDF generation:', error);
      setPdfGenMessage('We could not call the PDF workflow.');
    } finally {
      setIsGeneratingPdfs(false);
    }
  };

  const handleNarrationRequest = async () => {
    setIsGeneratingAudio(true);
    setNarrationMessage('Sending narration job to the workflow...');
    try {
      const response = await fetch(`/api/admin/stories/${storyId}/generate-audiobook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voice: selectedVoice, includeBackgroundMusic }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Failed to enqueue narration');
      }
      setNarrationMessage(result.message || 'Narration queued. Refresh in a little bit.');
      await onStoryRefresh();
    } catch (error) {
      console.error('Narration request failed', error);
      const message =
        error instanceof Error ? error.message : 'Unexpected error starting narration';
      setNarrationMessage(message);
    } finally {
      setIsGeneratingAudio(false);
    }
  };

  const handleRefreshStatus = async () => {
    setIsRefreshing(true);
    try {
      await onStoryRefresh();
      await fetchChapters();
      setLastRefreshAt(new Date());
    } catch (error) {
      console.error('Manual refresh failed', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handlePrimaryActionClick = () => {
    if (audioAvailable) {
      setListenPanelOpen(true);
      if (chapters.length === 0) {
        fetchChapters();
      }
    } else {
      setNarrationPanelOpen(true);
    }
  };

  const narrationButtonLabel = audioAvailable ? 'Listen Story' : 'Narrate Story';

  const statusBadgeClass = (() => {
    switch (story.audiobookStatus) {
      case 'completed':
        return 'badge-success';
      case 'generating':
        return 'badge-warning';
      case 'failed':
        return 'badge-error';
      default:
        return 'badge-ghost';
    }
  })();

  const statusLabel = story.audiobookStatus ? story.audiobookStatus : 'not_started';

  const actionDisabled = story.status !== 'published';

  return (
    <div className="card bg-base-100 shadow-xl">
      <div className="card-body space-y-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="card-title">Story Actions</h2>
            <div className="badge badge-outline">Story #{story.storyId.slice(0, 8)}</div>
          </div>
          <div className="flex flex-col gap-2">
            {story.status === 'published' ? (
              <Link href={`/stories/${storyId}/read`} className="btn btn-primary">
                Read Story
              </Link>
            ) : (
              <div className="btn btn-disabled pointer-events-none">Read Story (not published)</div>
            )}
            <button
              className="btn btn-secondary"
              onClick={handlePrimaryActionClick}
              disabled={actionDisabled && !audioAvailable}
            >
              {narrationButtonLabel}
            </button>
            <button
              className={`btn btn-outline ${isGeneratingPdfs ? 'loading' : ''}`}
              onClick={handleGeneratePdfs}
              disabled={isGeneratingPdfs || actionDisabled}
            >
              {isGeneratingPdfs ? 'Triggering PDFs...' : 'Generate PDFs (Cover & Interior)'}
            </button>
            {pdfGenMessage && <p className="text-sm text-base-content/80">{pdfGenMessage}</p>}
          </div>
        </div>

        <div className="divider" />

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
              <span className="ml-2 text-base-content/50">Not available</span>
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
              <span className="ml-2 text-base-content/50">Not available</span>
            )}
          </div>
          {story.featureImageUri && (
            <div>
              <span className="font-semibold">Feature Image:</span>
              <div className="ml-2 mt-2">
                <Image
                  src={story.featureImageUri}
                  alt="Feature"
                  width={120}
                  height={120}
                  className="object-cover rounded"
                />
              </div>
            </div>
          )}
        </div>

        <div className="divider" />

        <section>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-lg font-semibold">Audio Narration</p>
              <p className="text-sm text-base-content/70">
                Admin narration ignores billing. Kick it off, then refresh manually to check
                progress.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                className="btn btn-ghost btn-xs"
                onClick={() => setNarrationPanelOpen((prev) => !prev)}
              >
                {narrationPanelOpen ? 'Hide form' : 'Show form'}
              </button>
              <span className={`badge ${statusBadgeClass} capitalize`}>
                {statusLabel.replace('_', ' ')}
              </span>
              <button
                className={`btn btn-ghost btn-xs ${isRefreshing ? 'loading' : ''}`}
                onClick={handleRefreshStatus}
              >
                {isRefreshing ? 'Refreshing' : 'Refresh status'}
              </button>
            </div>
          </div>
          {lastRefreshAt && (
            <p className="text-xs text-base-content/60 mt-1">
              Last checked at {lastRefreshAt.toLocaleTimeString()}
            </p>
          )}

          {narrationPanelOpen && (
            <div className="mt-4 space-y-4 bg-base-200 rounded-xl p-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <label className="form-control w-full">
                  <span className="label-text font-semibold mb-2">Voice</span>
                  <select
                    className="select select-bordered"
                    value={selectedVoice}
                    onChange={(event) => setSelectedVoice(event.target.value)}
                  >
                    {voiceOptions.map((voice) => (
                      <option key={voice.value} value={voice.value}>
                        {voice.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="form-control w-full">
                  <span className="label-text font-semibold mb-2">Background music</span>
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      className="toggle toggle-primary"
                      checked={includeBackgroundMusic}
                      onChange={(event) => setIncludeBackgroundMusic(event.target.checked)}
                    />
                    <span className="text-sm text-base-content/70">
                      Subtle ambience to keep the vibe magical.
                    </span>
                  </div>
                </label>
              </div>
              <button
                className={`btn btn-primary ${isGeneratingAudio ? 'loading' : ''}`}
                onClick={handleNarrationRequest}
                disabled={isGeneratingAudio || actionDisabled}
              >
                {isGeneratingAudio ? 'Contacting narrators...' : 'Generate narration'}
              </button>
              {narrationMessage && (
                <p className="text-sm text-base-content/80">{narrationMessage}</p>
              )}
            </div>
          )}

          {!narrationPanelOpen && (
            <p className="mt-3 text-sm text-base-content/70">
              {audioAvailable
                ? 'Need an alternate take? Open the form to fire another narration run.'
                : 'No audio yet. Tap "Narrate Story" above to start a run.'}
            </p>
          )}
        </section>

        <div className="divider" />

        <section>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-lg font-semibold">Listen & QA</p>
              <p className="text-sm text-base-content/70">
                Stream each chapter right here. Playback proxies every audio file through the admin
                API.
              </p>
            </div>
            <button
              className="btn btn-ghost btn-xs"
              onClick={() => setListenPanelOpen((prev) => !prev)}
              disabled={!audioAvailable}
            >
              {listenPanelOpen ? 'Hide player' : 'Show player'}
            </button>
          </div>

          {!audioAvailable && (
            <p className="mt-3 text-sm text-base-content/70">
              Waiting for narration output. Once the workflow finishes, hit refresh and the player
              will unlock.
            </p>
          )}

          {audioAvailable && listenPanelOpen && (
            <div className="mt-4">
              {isLoadingChapters ? (
                <div className="flex items-center justify-center py-6">
                  <span className="loading loading-spinner loading-md" />
                </div>
              ) : audioChapters.length > 0 ? (
                <AudioChapterList chapters={audioChapters} {...audioPlayer} />
              ) : (
                <p className="text-sm text-base-content/70">
                  Audio metadata is syncing. Refresh in a moment if the chapters are still missing.
                </p>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
