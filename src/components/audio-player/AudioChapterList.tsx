'use client';

import Image from 'next/image';
import { FiBook, FiPlay, FiPause, FiSquare, FiLoader } from 'react-icons/fi';
import type { AudioChapter, AudioPlayerState, AudioPlayerActions } from './types';

interface AudioChapterListProps extends AudioPlayerState, AudioPlayerActions {
  chapters: AudioChapter[];
  formatDuration?: (seconds: number) => string;
}

const defaultFormatDuration = (seconds: number): string => {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
};

export function AudioChapterList({
  chapters,
  currentlyPlaying,
  audioProgress,
  audioLoading,
  playAudio,
  pauseAudio,
  stopAudio,
  formatDuration = defaultFormatDuration,
}: AudioChapterListProps) {
  return (
    <div className="space-y-4">
      {chapters.map((chapter, index) => (
        <div
          key={chapter.chapterTitle + index}
          className="bg-base-200 rounded-xl border border-base-300 p-4"
        >
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
            <div className="w-16 h-16 rounded-lg overflow-hidden bg-base-300 flex items-center justify-center">
              {chapter.imageUri ? (
                <Image
                  src={chapter.imageUri}
                  alt={`Chapter ${index + 1} art`}
                  width={64}
                  height={64}
                  className="w-16 h-16 object-cover"
                />
              ) : (
                <FiBook className="w-6 h-6 text-base-content/50" />
              )}
            </div>
            <div className="flex-1 w-full">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-base-content/80">Chapter {index + 1}</p>
                  <p className="text-lg font-bold text-base-content">{chapter.chapterTitle}</p>
                </div>
                {chapter.duration > 0 && (
                  <p className="text-sm text-base-content/70">{formatDuration(chapter.duration)}</p>
                )}
              </div>
              {audioProgress[index] > 0 && (
                <div className="mt-2">
                  <div className="w-full bg-base-300 rounded-full h-2">
                    <div
                      className="bg-primary h-2 rounded-full transition-all"
                      style={{ width: `${audioProgress[index]}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
            <div className="flex gap-2">
              {audioLoading[index] ? (
                <div className="w-10 h-10 flex items-center justify-center">
                  <FiLoader className="animate-spin text-base-content/50" />
                </div>
              ) : currentlyPlaying === index ? (
                <>
                  <button
                    className="btn btn-circle btn-sm btn-primary"
                    onClick={() => pauseAudio(index)}
                  >
                    <FiPause className="w-4 h-4" />
                  </button>
                  <button
                    className="btn btn-circle btn-sm btn-outline"
                    onClick={() => stopAudio(index)}
                  >
                    <FiSquare className="w-3 h-3" />
                  </button>
                </>
              ) : (
                <button
                  className="btn btn-circle btn-sm btn-primary"
                  onClick={() => playAudio(index)}
                >
                  <FiPlay className="w-4 h-4 ml-0.5" />
                </button>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
