import { NextRequest, NextResponse } from 'next/server';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { createMcpServer } from '@/lib/mcp/server';
import { getMcpPrincipal } from '@/lib/mcp/auth';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const principal = getMcpPrincipal(request);
  if (!principal) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let payload: unknown;

  if (request.method === 'POST') {
    try {
      payload = await request.clone().json();
      console.log('[MCP AUDIT] Streamable HTTP message received');
    } catch {
      console.error('[MCP SERVER ERROR] Invalid streamable HTTP payload');
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
    sessionIdGenerator: undefined,
  });
  const server = createMcpServer(principal);

  transport.onerror = () => {
    console.error('[MCP SERVER ERROR] Streamable HTTP transport');
  };

  try {
    await server.connect(transport);
    return await transport.handleRequest(request, { parsedBody: payload });
  } catch {
    console.error('[MCP SERVER ERROR] Streamable HTTP request');
    return NextResponse.json(
      {
        jsonrpc: '2.0',
        error: { code: -32603, message: 'Internal server error' },
        id: null,
      },
      { status: 500 },
    );
  } finally {
    // JSON responses are complete here; release the per-request protocol state.
    try {
      await server.close();
    } catch {
      console.error('[MCP SERVER ERROR] Closing streamable HTTP request');
    }
  }
}

function rejectStreamingRequest(request: NextRequest) {
  if (!getMcpPrincipal(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Optional client GET streams would keep request-based Cloud Run billing active.
  // MCP clients support 405 here and continue using the stateless POST transport.
  return NextResponse.json(
    { error: 'Method not allowed. Use HTTP POST /api/mcp.' },
    {
      status: 405,
      headers: { Allow: 'POST', 'Cache-Control': 'no-store' },
    },
  );
}

export async function GET(request: NextRequest) {
  return rejectStreamingRequest(request);
}

export async function DELETE(request: NextRequest) {
  return rejectStreamingRequest(request);
}
