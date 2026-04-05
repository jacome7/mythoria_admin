/**
 * @jest-environment node
 */

import { beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { NextRequest } from 'next/server';

jest.mock('@/lib/mcp/tools', () => ({
  registerMcpTools: jest.fn(),
}));

async function readStreamPrefix(
  body: ReadableStream<Uint8Array> | null,
  maxBytes = 4096,
): Promise<string> {
  if (!body) return '';
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let out = '';
  try {
    while (out.length < maxBytes) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) out += decoder.decode(value, { stream: true });
      if (out.includes('\n\n')) break;
    }
  } finally {
    await reader.cancel();
  }
  return out;
}

let mcpGet: typeof import('@/app/api/mcp/route').GET;
let mcpMessagesPost: typeof import('@/app/api/mcp/messages/route').POST;

const SECRET = 'x'.repeat(32);

beforeAll(async () => {
  ({ GET: mcpGet } = await import('@/app/api/mcp/route'));
  ({ POST: mcpMessagesPost } = await import('@/app/api/mcp/messages/route'));
});

describe('MCP SSE routes', () => {
  beforeEach(() => {
    process.env.MCP_SECRET_KEY = SECRET;
    jest.clearAllMocks();
  });

  it('returns 200 and endpoint event for two parallel authenticated GETs', async () => {
    const headers = { Authorization: `Bearer ${SECRET}` };

    const [r1, r2] = await Promise.all([
      mcpGet(new NextRequest('http://localhost:3001/api/mcp', { headers })),
      mcpGet(new NextRequest('http://localhost:3001/api/mcp', { headers })),
    ]);

    expect(r1.status).toBe(200);
    expect(r2.status).toBe(200);

    const [chunk1, chunk2] = await Promise.all([
      readStreamPrefix(r1.body),
      readStreamPrefix(r2.body),
    ]);

    expect(chunk1).toContain('event: endpoint');
    expect(chunk1).toContain('/api/mcp/messages?sessionId=');
    expect(chunk2).toContain('event: endpoint');
    expect(chunk2).toContain('/api/mcp/messages?sessionId=');
  });

  it('rejects MCP messages POST without Bearer auth', async () => {
    const res = await mcpMessagesPost(
      new NextRequest('http://localhost:3001/api/mcp/messages?sessionId=fake', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'ping' }),
      }),
    );
    expect(res.status).toBe(401);
  });
});
