const DEFAULT_IMAGE_ORIGIN = 'https://mythoria.pt';
const STORAGE_ORIGIN = 'https://storage.googleapis.com';

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

/**
 * Returns a browser-safe story image URL, or null when the stored URI cannot be rendered.
 * Mutable image URLs receive a cache key so regenerated assets are fetched again.
 */
export function getStoryImageUrl(
  uri: string | null | undefined,
  cacheKey?: string | number | null,
  baseOrigin = process.env.NEXT_PUBLIC_ADMIN_URL || DEFAULT_IMAGE_ORIGIN,
) {
  if (typeof uri !== 'string') return null;

  const normalizedUri = uri.trim();
  if (!normalizedUri) return null;

  try {
    let url: URL;

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
      url = new URL(normalizedUri, baseOrigin);
    }

    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;

    // Extra query parameters invalidate signed GCS URLs. Their signatures already
    // provide a unique URL when a new signed link is generated.
    if (cacheKey !== null && cacheKey !== undefined && !isSignedUrl(url)) {
      url.searchParams.set('v', String(cacheKey));
    }

    return url.href;
  } catch {
    return null;
  }
}
