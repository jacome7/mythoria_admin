import { getStoryImageUrl } from '@/lib/storyImageUrl';

describe('getStoryImageUrl', () => {
  const baseOrigin = 'http://localhost:3001';

  it('keeps valid absolute HTTP URLs and adds a cache key', () => {
    expect(getStoryImageUrl(' https://images.example/story.png ', 'chapter-2', baseOrigin)).toBe(
      'https://images.example/story.png?v=chapter-2',
    );
  });

  it('resolves relative URLs against the admin origin', () => {
    expect(getStoryImageUrl('/images/story.png', 42, baseOrigin)).toBe(
      'http://localhost:3001/images/story.png?v=42',
    );
  });

  it('converts Google Storage URIs to HTTPS URLs', () => {
    expect(getStoryImageUrl('gs://story-bucket/chapters/one.png', 'latest', baseOrigin)).toBe(
      'https://storage.googleapis.com/story-bucket/chapters/one.png?v=latest',
    );
  });

  it('does not modify signed URLs', () => {
    const signedUrl =
      'https://storage.googleapis.com/story-bucket/cover.png?X-Goog-Signature=signature';

    expect(getStoryImageUrl(signedUrl, 'latest', baseOrigin)).toBe(signedUrl);
  });

  it.each(['', '   ', 'https://', 'gs://bucket', 'javascript:alert(1)'])(
    'returns null for an invalid or unsupported URI: %p',
    (uri) => {
      expect(getStoryImageUrl(uri, 'latest', baseOrigin)).toBeNull();
    },
  );

  it('returns null when persisted data is not a string at runtime', () => {
    expect(getStoryImageUrl(42 as unknown as string, 'latest', baseOrigin)).toBeNull();
  });
});
