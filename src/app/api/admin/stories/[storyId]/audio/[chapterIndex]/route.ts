import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { ALLOWED_DOMAINS } from '@/config/auth';
import { adminService } from '@/db/services';
import { premiumEditionSummary } from '@/lib/premium-edition';
import { premiumAudiobookMetadata } from '@/lib/premium-audiobook';
import { getPremiumAudioTrack } from '@/services/premium-audiobook';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ storyId: string; chapterIndex: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const isAllowedDomain = ALLOWED_DOMAINS.some((domain) => session.user?.email?.endsWith(domain));
    if (!isAllowedDomain) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { storyId, chapterIndex } = await params;
    const chapterIdx = Number(chapterIndex);
    if (!storyId || !/^\d+$/.test(chapterIndex) || !Number.isSafeInteger(chapterIdx)) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }

    const story = await adminService.getStoryById(storyId);
    if (!story) {
      return NextResponse.json({ error: 'Story not found' }, { status: 404 });
    }

    const premium = premiumEditionSummary(story.features);
    if (premium) {
      const metadata =
        premium.state === 'published' && story.status === 'published'
          ? premiumAudiobookMetadata(premium.revision, story.audiobookUri)
          : null;
      const runId = new URL(request.url).searchParams.get('runId');
      if (!metadata || runId !== metadata.runId || !metadata.tracks[chapterIdx]) {
        return new NextResponse(null, { status: 404 });
      }
      return await getPremiumAudioTrack(storyId, runId, chapterIdx, request.headers.get('range'));
    }

    if (!story.audiobookUri || typeof story.audiobookUri !== 'object') {
      return NextResponse.json({ error: 'No audiobook available for this story' }, { status: 404 });
    }

    let audioUri: string | undefined;

    // New structured array format
    if (Array.isArray(story.audiobookUri)) {
      const chapter = story.audiobookUri[chapterIdx];
      if (chapter && typeof chapter === 'object' && 'audioUri' in chapter) {
        audioUri = (chapter as { audioUri?: unknown }).audioUri as string | undefined;
      }
    } else {
      // Legacy map formats
      const audiobookData = story.audiobookUri as Record<string, unknown>;
      let chapterKey = `chapter_${chapterIdx + 1}`;
      audioUri = audiobookData[chapterKey] as string | undefined;
      if (!audioUri) {
        chapterKey = String(chapterIdx + 1);
        audioUri = audiobookData[chapterKey] as string | undefined;
      }
    }

    if (!audioUri || typeof audioUri !== 'string') {
      return NextResponse.json({ error: 'Chapter audio not found' }, { status: 404 });
    }

    let finalAudioUri = audioUri;
    if (finalAudioUri.startsWith('gs://')) {
      const gsPath = finalAudioUri.replace('gs://', '');
      const [bucket, ...pathSegments] = gsPath.split('/');
      finalAudioUri = `https://storage.googleapis.com/${bucket}/${pathSegments.join('/')}`;
    }
    if (finalAudioUri.startsWith('http://')) {
      finalAudioUri = finalAudioUri.replace('http://', 'https://');
    }

    const upstreamResponse = await fetch(finalAudioUri);
    if (!upstreamResponse.ok) {
      const upstreamHost = (() => {
        try {
          return new URL(finalAudioUri).host;
        } catch {
          return 'invalid-url';
        }
      })();
      console.error('Failed to fetch proxied audio', {
        status: upstreamResponse.status,
        upstreamHost,
      });
      return NextResponse.json({ error: 'Failed to fetch audio file' }, { status: 502 });
    }

    const audioBuffer = await upstreamResponse.arrayBuffer();
    const headers = new Headers();
    headers.set('Content-Type', upstreamResponse.headers.get('content-type') || 'audio/mpeg');
    headers.set('Accept-Ranges', 'bytes');
    headers.set('Cache-Control', 'public, max-age=600');
    const contentLength = upstreamResponse.headers.get('content-length');
    if (contentLength) {
      headers.set('Content-Length', contentLength);
    }

    return new NextResponse(audioBuffer, { status: 200, headers });
  } catch (error) {
    console.error('Admin audio proxy failure:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
