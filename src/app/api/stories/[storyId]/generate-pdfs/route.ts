import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { publishPrintRequest } from '@/lib/pubsub';
import { authenticateAdmin } from '@/lib/api-helpers';
import { adminService } from '@/db/services';
import { premiumEditionSummary } from '@/lib/premium-edition';
import { z } from 'zod';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ storyId: string }> },
) {
  const actor = await authenticateAdmin();
  if ('error' in actor) return actor.error;
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin)
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { storyId } = await params;
  if (!z.uuid().safeParse(storyId).success)
    return NextResponse.json({ success: false, error: 'Invalid story ID' }, { status: 400 });

  try {
    const story = await adminService.getStoryById(storyId);
    if (!story) return NextResponse.json({ error: 'Story not found' }, { status: 404 });
    if (premiumEditionSummary(story.features))
      return NextResponse.json(
        { error: 'Prepare square print files from the edition’s print proof ticket.' },
        { status: 409 },
      );
    const runId = randomUUID();
    await publishPrintRequest({ storyId, runId, initiatedBy: 'adminPortal', origin: 'admin' });
    return NextResponse.json({ success: true, message: 'PDF generation triggered.', runId });
  } catch (err) {
    console.error('Failed to trigger PDF generation:', err);
    return NextResponse.json(
      { success: false, error: 'Failed to trigger PDF generation.' },
      { status: 500 },
    );
  }
}
