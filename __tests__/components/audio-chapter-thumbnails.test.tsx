import { render, screen } from '@testing-library/react';
import { AudioChapterList } from '@/components/audio-player/AudioChapterList';
import { getAudioChapters } from '@/components/audio-player/utils';

const relativeArtwork = 'example-story/images/chapter_1_v001.jpg';
const expectedUrl = `https://storage.googleapis.com/mythoria-generated-stories/${relativeArtwork}`;

describe('audiobook chapter thumbnails', () => {
  it.each([{ chapter_1: 'chapter.mp3' }, { 1: 'chapter.mp3' }, [{ audioUri: 'chapter.mp3' }]])(
    'resolves stored chapter artwork for supported audiobook formats',
    (audiobook) => {
      const chapters = getAudioChapters(
        audiobook,
        [{ chapterNumber: 1, imageUri: relativeArtwork }],
        () => 'Chapter 1',
      );
      render(
        <AudioChapterList
          chapters={chapters}
          currentlyPlaying={null}
          audioProgress={{}}
          audioLoading={{}}
          getAudioElement={() => undefined}
          playAudio={jest.fn()}
          pauseAudio={jest.fn()}
          stopAudio={jest.fn()}
        />,
      );
      expect(screen.getByRole('img', { name: 'Chapter 1 art' })).toHaveAttribute(
        'src',
        expectedUrl,
      );
    },
  );

  it('uses valid embedded artwork and omits unsupported image sources', () => {
    const signedUrl = 'https://storage.googleapis.com/bucket/cover.jpg?X-Goog-Signature=abc';
    const chapters = getAudioChapters(
      [
        { audioUri: 'one.mp3', imageUri: signedUrl },
        { audioUri: 'two.mp3', imageUri: 'file:///private/chapter.jpg' },
      ],
      [],
      () => 'Chapter',
    );
    expect(chapters.map((chapter) => chapter.imageUri)).toEqual([signedUrl, undefined]);
  });
});
