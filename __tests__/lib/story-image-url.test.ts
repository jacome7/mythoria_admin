import { getStoryImageUrl } from '@/lib/storyImageUrl';

describe('getStoryImageUrl', () => {
  const storyImageOrigin = 'https://storage.googleapis.com/mythoria-generated-stories/';

  it('keeps valid absolute HTTP URLs and adds a cache key', () => {
    expect(getStoryImageUrl(' https://images.example/story.png ', 'chapter-2')).toBe(
      'https://images.example/story.png?v=chapter-2',
    );
  });

  it('resolves relative URLs against the generated stories bucket', () => {
    expect(getStoryImageUrl('/images/story.png', 42)).toBe(`${storyImageOrigin}images/story.png`);
  });

  it('converts stored chapter paths to clean Google Storage URLs', () => {
    const storyId = '47217978-2075-4040-9cb9-02177ae1313f';
    const uri = `/${storyId}/images/chapter_1_v001.jpg?v=1784254477555-2-2026-07-16+16%3A00%3A56.632356%2B00`;

    expect(getStoryImageUrl(uri, 'latest')).toBe(
      `${storyImageOrigin}${storyId}/images/chapter_1_v001.jpg`,
    );
  });

  it('converts Google Storage URIs to HTTPS URLs', () => {
    expect(getStoryImageUrl('gs://story-bucket/chapters/one.png', 'latest')).toBe(
      'https://storage.googleapis.com/story-bucket/chapters/one.png?v=latest',
    );
  });

  it('does not modify signed URLs', () => {
    const signedUrl =
      'https://storage.googleapis.com/story-bucket/cover.png?X-Goog-Signature=signature';

    expect(getStoryImageUrl(signedUrl, 'latest')).toBe(signedUrl);
  });

  it.each(['', '   ', 'https://', 'gs://bucket', 'javascript:alert(1)'])(
    'returns null for an invalid or unsupported URI: %p',
    (uri) => {
      expect(getStoryImageUrl(uri, 'latest')).toBeNull();
    },
  );

  it('rejects relative paths that escape the generated stories bucket', () => {
    expect(getStoryImageUrl('../another-bucket/image.png', 'latest')).toBeNull();
  });

  it('returns null when persisted data is not a string at runtime', () => {
    expect(getStoryImageUrl(42 as unknown as string, 'latest')).toBeNull();
  });
});
