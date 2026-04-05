import { NextRequest, NextResponse } from 'next/server';
import { createMcpServer, activeTransports } from '@/lib/mcp/server';
import { validateMcpAuth } from '@/lib/mcp/auth';
import { NextSSETransport } from '@/lib/mcp/NextSSETransport';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  if (!validateMcpAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const transport = new NextSSETransport('/api/mcp/messages');

  activeTransports.set(transport.sessionId, transport);

  transport.onclose = () => {
    activeTransports.delete(transport.sessionId);
  };

  const server = createMcpServer();
  await server.connect(transport);

  return new NextResponse(transport.responseStream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
