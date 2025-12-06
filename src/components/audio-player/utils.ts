import { AudioChapter } from './types';

type StructuredAudiobookChapter = {
  chapterTitle?: string;
  audioUri: string;
  duration?: number;
  imageUri?: string;
};

export interface ChapterSnapshot {
  chapterNumber: number;
  title?: string | null;
  imageUri?: string | null;
}

export function hasAudiobook(audiobookUri: unknown): boolean {
  if (!audiobookUri) return false;

  if (Array.isArray(audiobookUri)) {
    return audiobookUri.length > 0;
  }

  if (typeof audiobookUri === 'object') {
    const entries = Object.entries(audiobookUri as Record<string, unknown>);
    return entries.some(
      ([key, value]) =>
        (key.startsWith('chapter_') || /^\d+$/.test(key)) && typeof value === 'string',
    );
  }

  return false;
}

export function getAudioChapters(
  audiobookUri: unknown,
  chapters: ChapterSnapshot[],
  fallbackTitle: (chapterNumber: number) => string,
): AudioChapter[] {
  if (!audiobookUri) return [];

  const chapterLookup = new Map<number, ChapterSnapshot>();
  chapters.forEach((chapter) => {
    chapterLookup.set(chapter.chapterNumber, chapter);
  });

  if (Array.isArray(audiobookUri)) {
    return (audiobookUri as StructuredAudiobookChapter[]).map((entry, index) => {
      const number = index + 1;
      const chapterFromDb = chapterLookup.get(number);
      return {
        chapterTitle: chapterFromDb?.title || entry.chapterTitle || fallbackTitle(number),
        audioUri: entry.audioUri,
        duration: entry.duration ?? 0,
        imageUri: chapterFromDb?.imageUri || entry.imageUri,
      } satisfies AudioChapter;
    });
  }

  if (typeof audiobookUri === 'object') {
    const raw = audiobookUri as Record<string, unknown>;
    const audioChapters: AudioChapter[] = [];

    let keys = Object.keys(raw)
      .filter((key) => key.startsWith('chapter_'))
      .sort(
        (a, b) => parseInt(a.replace('chapter_', ''), 10) - parseInt(b.replace('chapter_', ''), 10),
      );

    if (keys.length === 0) {
      keys = Object.keys(raw)
        .filter((key) => /^\d+$/.test(key))
        .sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
    }

    keys.forEach((key) => {
      const number = key.startsWith('chapter_')
        ? parseInt(key.replace('chapter_', ''), 10)
        : parseInt(key, 10);
      const uri = raw[key];
      if (typeof uri === 'string') {
        const chapterFromDb = chapterLookup.get(number);
        audioChapters.push({
          chapterTitle: chapterFromDb?.title || fallbackTitle(number),
          audioUri: uri,
          duration: 0,
          imageUri: chapterFromDb?.imageUri || undefined,
        });
      }
    });

    return audioChapters;
  }

  return [];
}
