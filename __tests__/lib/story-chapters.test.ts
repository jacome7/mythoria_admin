import { getLatestChapterVersions } from '@/lib/storyChapters';

describe('getLatestChapterVersions', () => {
  it('keeps the latest version of each chapter in chapter order', () => {
    const chapters = [
      { id: 'chapter-2-v1', chapterNumber: 2, version: 1 },
      { id: 'chapter-1-v2', chapterNumber: 1, version: 2 },
      { id: 'chapter-1-v1', chapterNumber: 1, version: 1 },
    ];

    expect(getLatestChapterVersions(chapters)).toEqual([
      { id: 'chapter-1-v2', chapterNumber: 1, version: 2 },
      { id: 'chapter-2-v1', chapterNumber: 2, version: 1 },
    ]);
  });
});
