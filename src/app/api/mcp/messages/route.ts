import { NextRequest, NextResponse } from 'next/server';
import { validateMcpAuth } from '@/lib/mcp/auth';
import { activeTransports } from '@/lib/mcp/server';

export async function POST(request: NextRequest) {
  if (!validateMcpAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');

    if (!sessionId) {
      return NextResponse.json({ error: 'Missing sessionId parameter' }, { status: 400 });
    }

    const transport = activeTransports.get(sessionId);

    if (!transport) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const payload = await request.json();

    // Log the payload securely based on your audit config
    // In production, we'd log this payload to the database or cloud logging
    console.log(`[MCP AUDIT] Session ${sessionId} executing payload:`, JSON.stringify(payload));

    // Handle standard message
    try {
      transport.handleMessage(payload);
    } catch (e: unknown) {
      console.error('[MCP SERVER ERROR] Handling message:', e);
      // Wait, we shouldn't necessarily fail standard HTTP if the handler throws?
      // Actually MCP handler handles it internally and responds on the SSE connection.
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error processing MCP message:', error);
    return NextResponse.json({ error: 'Invalid JSON or Internal Error' }, { status: 500 });
  }
}
