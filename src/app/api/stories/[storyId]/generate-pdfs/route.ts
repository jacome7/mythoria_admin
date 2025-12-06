import { NextRequest, NextResponse } from 'next/server';
import { PubSub } from '@google-cloud/pubsub';
import { v4 as uuidv4 } from 'uuid';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ storyId: string }> },
) {
  const { storyId } = await params;
  if (!storyId) {
    return NextResponse.json({ success: false, error: 'Missing storyId' }, { status: 400 });
  }

  try {
    const topicName = process.env.PUBSUB_TOPIC_PRINT || 'mythoria-print-requests';
    const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;
    const pubsub = new PubSub({ projectId });
    const runId = uuidv4();
    const data = JSON.stringify({ storyId, runId, initiatedBy: 'adminPortal', origin: 'admin' });
    const dataBuffer = Buffer.from(data);
    await pubsub.topic(topicName).publishMessage({ data: dataBuffer });
    return NextResponse.json({ success: true, message: 'PDF generation triggered.' });
  } catch (err) {
    console.error('Failed to trigger PDF generation:', err);
    return NextResponse.json(
      { success: false, error: 'Failed to trigger PDF generation.' },
      { status: 500 },
    );
  }
}
