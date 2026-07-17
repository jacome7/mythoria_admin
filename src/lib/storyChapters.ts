export interface VersionedChapter {
  chapterNumber: number;
  version: number;
}

/** Selects the highest stored version for every chapter number. */
export function getLatestChapterVersions<T extends VersionedChapter>(chapters: T[]) {
  const latestByNumber = new Map<number, T>();

  for (const chapter of chapters) {
    const existing = latestByNumber.get(chapter.chapterNumber);
    if (!existing || chapter.version > existing.version) {
      latestByNumber.set(chapter.chapterNumber, chapter);
    }
  }

  return Array.from(latestByNumber.values()).sort(
    (first, second) => first.chapterNumber - second.chapterNumber,
  );
}
