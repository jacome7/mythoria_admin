export interface AudioChapter {
  chapterTitle: string;
  audioUri: string;
  duration: number;
  imageUri?: string;
}

export interface AudioPlayerState {
  currentlyPlaying: number | null;
  getAudioElement: (index: number) => HTMLAudioElement | undefined;
  audioProgress: Record<number, number>;
  audioLoading: Record<number, boolean>;
}

export interface AudioPlayerActions {
  playAudio: (chapterIndex: number) => Promise<void>;
  pauseAudio: (chapterIndex: number) => void;
  stopAudio: (chapterIndex: number) => void;
}

export interface AudioPlayerHookProps {
  audioEndpoint: string;
  onError?: (error: string) => void;
  totalChapters?: number;
}
