const STORAGE_ORIGIN = 'https://storage.googleapis.com';
const STORY_IMAGE_ORIGIN = `${STORAGE_ORIGIN}/mythoria-generated-stories/`;

const SIGNED_URL_PARAMETERS = ['X-Goog-Signature', 'Signature'];

function isSignedUrl(url: URL) {
  return SIGNED_URL_PARAMETERS.some((parameter) => url.searchParams.has(parameter));
}

function normalizeGoogleStorageUrl(uri: string) {
  const storagePath = uri.slice('gs://'.length);
  const separatorIndex = storagePath.indexOf('/');

  if (separatorIndex <= 0 || separatorIndex === storagePath.length - 1) {
    return null;
  }

  return new URL(storagePath, `${STORAGE_ORIGIN}/`);
}

function normalizeRelativeStoryImageUrl(uri: string, imageOrigin: string) {
  const baseUrl = new URL(imageOrigin);
  baseUrl.pathname = `${baseUrl.pathname.replace(/\/+$/, '')}/`;
  baseUrl.search = '';
  baseUrl.hash = '';

  const url = new URL(uri.replace(/^\/+/, ''), baseUrl);

  if (url.origin !== baseUrl.origin || !url.pathname.startsWith(baseUrl.pathname)) {
    return null;
  }

  url.search = '';
  url.hash = '';
  return url;
}

/**
 * Returns a browser-safe story image URL, or null when the stored URI cannot be rendered.
 * Mutable image URLs receive a cache key so regenerated assets are fetched again.
 */
export function getStoryImageUrl(
  uri: string | null | undefined,
  cacheKey?: string | number | null,
  relativeImageOrigin = STORY_IMAGE_ORIGIN,
) {
  if (typeof uri !== 'string') return null;

  const normalizedUri = uri.trim();
  if (!normalizedUri) return null;

  try {
    let url: URL;
    let isRelativeUrl = false;

    if (normalizedUri.toLowerCase().startsWith('gs://')) {
      const storageUrl = normalizeGoogleStorageUrl(normalizedUri);
      if (!storageUrl) return null;
      url = storageUrl;
    } else if (normalizedUri.startsWith('//')) {
      url = new URL(`https:${normalizedUri}`);
    } else if (/^https?:\/\//i.test(normalizedUri)) {
      url = new URL(normalizedUri);
    } else {
      // Reject unsupported schemes instead of passing them to next/image.
      if (/^[a-z][a-z\d+.-]*:/i.test(normalizedUri)) return null;
      isRelativeUrl = true;
      const storageUrl = normalizeRelativeStoryImageUrl(normalizedUri, relativeImageOrigin);
      if (!storageUrl) return null;
      url = storageUrl;
    }

    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;

    // Relative versioned paths are kept canonical, while signed GCS URLs cannot
    // accept extra parameters. Other mutable URLs receive the current cache key.
    if (cacheKey !== null && cacheKey !== undefined && !isRelativeUrl && !isSignedUrl(url)) {
      url.searchParams.set('v', String(cacheKey));
    }

    return url.href;
  } catch {
    return null;
  }
}
