import { NextRequest, NextResponse } from 'next/server';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { createMcpServer, activeTransports } from '@/lib/mcp/server';
import { validateMcpAuth } from '@/lib/mcp/auth';
import { NextSSETransport } from '@/lib/mcp/NextSSETransport';

export const dynamic = 'force-dynamic';

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

async function handleStreamableHttpRequest(request: NextRequest) {
  if (!validateMcpAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let payload: unknown;

  if (request.method === 'POST') {
    try {
      payload = await request.clone().json();
      console.log('[MCP AUDIT] Streamable HTTP message', getPayloadAuditSummary(payload));
    } catch (error) {
      console.error('[MCP SERVER ERROR] Invalid streamable HTTP payload:', error);
      return NextResponse.json(
        {
          jsonrpc: '2.0',
          error: { code: -32700, message: 'Parse error: Invalid JSON' },
          id: null,
        },
        { status: 400 },
      );
    }
  }

  const transport = new WebStandardStreamableHTTPServerTransport({
    enableJsonResponse: true,
  });
  const server = createMcpServer();

  transport.onerror = (error) => {
    console.error('[MCP SERVER ERROR] Streamable HTTP transport:', error);
  };

  await server.connect(transport);

  try {
    return await transport.handleRequest(request, { parsedBody: payload });
  } catch (error) {
    console.error('[MCP SERVER ERROR] Streamable HTTP request:', error);
    return NextResponse.json(
      {
        jsonrpc: '2.0',
        error: { code: -32603, message: 'Internal server error' },
        id: null,
      },
      { status: 500 },
    );
  }
}

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

export async function POST(request: NextRequest) {
  return handleStreamableHttpRequest(request);
}

export async function DELETE(request: NextRequest) {
  return handleStreamableHttpRequest(request);
}
