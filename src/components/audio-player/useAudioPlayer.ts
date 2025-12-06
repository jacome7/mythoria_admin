'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { AudioPlayerState, AudioPlayerActions, AudioPlayerHookProps } from './types';

const ERROR_MESSAGES = {
  generic: 'We could not play that audio clip. Give it another go.',
  permission: 'Tap play again to let the browser start the audio.',
  unsupported: 'This browser cannot play the requested audio format.',
};

export function useAudioPlayer({
  audioEndpoint,
  onError,
  totalChapters,
}: AudioPlayerHookProps): AudioPlayerState & AudioPlayerActions {
  const [currentlyPlaying, setCurrentlyPlaying] = useState<number | null>(null);
  const [audioProgress, setAudioProgress] = useState<Record<number, number>>({});
  const [audioLoading, setAudioLoading] = useState<Record<number, boolean>>({});

  const audioElementsRef = useRef<Record<number, HTMLAudioElement>>({});
  const totalChaptersRef = useRef(totalChapters ?? 0);
  const playAudioRef = useRef<(index: number) => Promise<void>>(async () => {});

  useEffect(() => {
    totalChaptersRef.current = totalChapters ?? 0;
  }, [totalChapters]);

  const playAudio = useCallback(
    async (chapterIndex: number) => {
      try {
        if (currentlyPlaying !== null && audioElementsRef.current[currentlyPlaying]) {
          const currentAudio = audioElementsRef.current[currentlyPlaying];
          currentAudio.pause();
          currentAudio.currentTime = 0;
          currentAudio.load();
        }

        setAudioLoading((prev) => ({ ...prev, [chapterIndex]: true }));
        const proxyAudioUri = `${audioEndpoint}/${chapterIndex}`;

        if (!audioElementsRef.current[chapterIndex]) {
          const audio = new Audio();
          audio.preload = 'metadata';

          audio.addEventListener('loadedmetadata', () => {
            setAudioLoading((prev) => ({ ...prev, [chapterIndex]: false }));
          });

          audio.addEventListener('timeupdate', () => {
            if (audio.duration) {
              const progress = (audio.currentTime / audio.duration) * 100;
              setAudioProgress((prev) => ({ ...prev, [chapterIndex]: progress }));
            }
          });

          audio.addEventListener('ended', () => {
            setCurrentlyPlaying(null);
            setAudioProgress((prev) => ({ ...prev, [chapterIndex]: 0 }));
            const nextIndex = chapterIndex + 1;
            if (totalChaptersRef.current > 0 && nextIndex < totalChaptersRef.current) {
              setTimeout(() => {
                playAudioRef.current(nextIndex);
              }, 150);
            }
          });

          audio.addEventListener('error', (e) => {
            console.error('Audio playback error', e);
            setAudioLoading((prev) => ({ ...prev, [chapterIndex]: false }));
            setCurrentlyPlaying(null);
            const message = ERROR_MESSAGES.generic;
            if (onError) {
              onError(message);
            } else {
              alert(message);
            }
          });

          audioElementsRef.current[chapterIndex] = audio;
          audio.src = proxyAudioUri;

          await audio.play();
          setCurrentlyPlaying(chapterIndex);
        } else {
          const audio = audioElementsRef.current[chapterIndex];
          if (audio.src !== proxyAudioUri) {
            audio.pause();
            audio.currentTime = 0;
            audio.load();
            audio.src = proxyAudioUri;
          }

          await audio.play();
          setCurrentlyPlaying(chapterIndex);
          setAudioLoading((prev) => ({ ...prev, [chapterIndex]: false }));
        }
      } catch (error) {
        console.error('Error playing audio', error);
        setAudioLoading((prev) => ({ ...prev, [chapterIndex]: false }));

        let message = ERROR_MESSAGES.generic;
        if (error instanceof Error && error.name === 'NotAllowedError') {
          message = ERROR_MESSAGES.permission;
        } else if (error instanceof Error && error.name === 'NotSupportedError') {
          message = ERROR_MESSAGES.unsupported;
        }

        if (onError) {
          onError(message);
        } else {
          alert(message);
        }
      }
    },
    [audioEndpoint, currentlyPlaying, onError],
  );

  useEffect(() => {
    playAudioRef.current = playAudio;
  }, [playAudio]);

  const pauseAudio = useCallback((chapterIndex: number) => {
    const target = audioElementsRef.current[chapterIndex];
    if (target) {
      target.pause();
      setCurrentlyPlaying(null);
    }
  }, []);

  const stopAudio = useCallback((chapterIndex: number) => {
    const target = audioElementsRef.current[chapterIndex];
    if (target) {
      target.pause();
      target.currentTime = 0;
      target.load();
      setCurrentlyPlaying(null);
      setAudioProgress((prev) => ({ ...prev, [chapterIndex]: 0 }));
    }
  }, []);

  useEffect(() => {
    const elements = audioElementsRef.current;
    return () => {
      Object.values(elements).forEach((audio) => {
        audio.pause();
        audio.currentTime = 0;
        audio.removeAttribute('src');
        audio.load();
      });
    };
  }, []);

  const getAudioElement = useCallback((index: number) => audioElementsRef.current[index], []);

  return {
    currentlyPlaying,
    getAudioElement,
    audioProgress,
    audioLoading,
    playAudio,
    pauseAudio,
    stopAudio,
  };
}
