import { NextRequest, NextResponse } from 'next/server';
import { validateMcpAuth } from '@/lib/mcp/auth';
import { activeTransports } from '@/lib/mcp/server';

function getPayloadAuditSummary(payload: unknown) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return { payloadType: typeof payload };
  }

  const record = payload as Record<string, unknown>;
  const method = typeof record.method === 'string' ? record.method : undefined;
  const id =
    typeof record.id === 'string' || typeof record.id === 'number' ? String(record.id) : undefined;
  const topLevelKeys = Object.keys(record).slice(0, 10);

  return {
    id,
    method,
    payloadType: 'object',
    topLevelKeys,
  };
}

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
    const payloadSummary = getPayloadAuditSummary(payload);

    console.log(`[MCP AUDIT] Session ${sessionId} executing message`, payloadSummary);

    try {
      transport.handleMessage(payload);
    } catch (e: unknown) {
      console.error('[MCP SERVER ERROR] Handling message:', e);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error processing MCP message:', error);
    return NextResponse.json({ error: 'Invalid JSON or Internal Error' }, { status: 500 });
  }
}
