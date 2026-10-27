/** @jest-environment node */

import { NextRequest } from 'next/server';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { DELETE, GET, POST } from '@/app/api/mcp/route';
import { POST as legacyMessages } from '@/app/api/mcp/messages/route';
import { createMcpServer } from '@/lib/mcp/server';

jest.mock('@/lib/mcp/server', () => ({ createMcpServer: jest.fn() }));

const endpoint = 'http://localhost:3001/api/mcp';
const credentials = {
  MCP_SECRET_KEY: 'test-admin-mcp-key',
  REFERRAL_MCP_MANAGEMENT_KEY: 'test-management-mcp-key',
  REFERRAL_MCP_FINANCE_KEY: 'test-finance-mcp-key',
};
const mockCreateServer = jest.mocked(createMcpServer);

function request(method: string, token?: string, payload?: unknown) {
  return new NextRequest(endpoint, {
    method,
    headers: {
      Accept: 'application/json, text/event-stream',
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(payload === undefined ? {} : { body: JSON.stringify(payload) }),
  });
}

describe('stateless MCP HTTP transport', () => {
  const savedCredentials = Object.fromEntries(
    Object.keys(credentials).map((key) => [key, process.env[key]]),
  );
  let closeSpies: jest.SpyInstance[];

  beforeEach(() => {
    Object.assign(process.env, credentials);
    closeSpies = [];
    mockCreateServer.mockReset();
    mockCreateServer.mockImplementation((principal) => {
      const server = new McpServer({ name: 'transport-test', version: '1.0.0' });
      server.registerTool(
        'read_identity',
        { description: 'Read the test principal' },
        async () => ({
          content: [{ type: 'text', text: principal!.id }],
        }),
      );
      closeSpies.push(jest.spyOn(server, 'close'));
      return server;
    });
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    for (const [key, value] of Object.entries(savedCredentials)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    jest.restoreAllMocks();
  });

  it.each([GET, POST, DELETE, legacyMessages])(
    'rejects missing and invalid credentials',
    async (handler) => {
      for (const token of [undefined, 'incorrect-test-key']) {
        const response = await handler(request(handler === GET ? 'GET' : 'POST', token));
        expect(response.status).toBe(401);
      }
      expect(mockCreateServer).not.toHaveBeenCalled();
    },
  );

  it.each([GET, DELETE])(
    'returns a finite 405 without allocating a protocol server',
    async (handler) => {
      const response = await handler(
        request(handler === GET ? 'GET' : 'DELETE', credentials.MCP_SECRET_KEY),
      );
      expect(response.status).toBe(405);
      expect(response.headers.get('allow')).toBe('POST');
      expect(response.headers.get('content-type')).toContain('application/json');
      expect(response.headers.get('cache-control')).toBe('no-store');
      expect(await response.json()).toHaveProperty('error');
      expect(mockCreateServer).not.toHaveBeenCalled();
    },
  );

  it('retires legacy message sessions without parsing or executing their payload', async () => {
    const response = await legacyMessages(request('POST', credentials.MCP_SECRET_KEY));
    expect(response.status).toBe(410);
    expect(await response.json()).toEqual({
      error: 'Legacy SSE transport has been retired. Use HTTP POST /api/mcp.',
    });
    expect(mockCreateServer).not.toHaveBeenCalled();
  });

  it('rejects malformed JSON before allocating a protocol server', async () => {
    const response = await POST(
      new NextRequest(endpoint, {
        method: 'POST',
        headers: { Authorization: `Bearer ${credentials.MCP_SECRET_KEY}` },
        body: '{',
      }),
    );
    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe(-32700);
    expect(mockCreateServer).not.toHaveBeenCalled();
  });

  it('closes the protocol server when connecting fails', async () => {
    const server = new McpServer({ name: 'failure-test', version: '1.0.0' });
    jest.spyOn(server, 'connect').mockRejectedValue(new Error('test connect failure'));
    const close = jest.spyOn(server, 'close');
    mockCreateServer.mockReturnValue(server);
    const response = await POST(
      request('POST', credentials.MCP_SECRET_KEY, {
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list',
      }),
    );
    expect(response.status).toBe(500);
    expect(close).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['admin', credentials.MCP_SECRET_KEY, 'legacy-admin'],
    ['management', credentials.REFERRAL_MCP_MANAGEMENT_KEY, 'referral-management'],
    ['finance', credentials.REFERRAL_MCP_FINANCE_KEY, 'referral-finance'],
  ])(
    'supports SDK initialization, optional GET, tool discovery and a read-only call for %s',
    async (_name, token, identity) => {
      const getStatuses: number[] = [];
      const responses: Response[] = [];
      const transport = new StreamableHTTPClientTransport(new URL(endpoint), {
        requestInit: { headers: { Authorization: `Bearer ${token}` } },
        fetch: async (input, init) => {
          const req = new NextRequest(input instanceof Request ? input : input.toString(), {
            ...init,
            signal: init?.signal ?? undefined,
          });
          const response = await (req.method === 'GET'
            ? GET(req)
            : req.method === 'DELETE'
              ? DELETE(req)
              : POST(req));
          if (req.method === 'GET') getStatuses.push(response.status);
          else responses.push(response);
          return response;
        },
      });
      const client = new Client({ name: 'transport-test-client', version: '1.0.0' });
      try {
        await client.connect(transport);
        const tools = await client.listTools();
        expect(tools.tools.map((tool) => tool.name)).toContain('read_identity');
        const result = await client.callTool({ name: 'read_identity', arguments: {} });
        expect(result.content).toEqual([{ type: 'text', text: identity }]);
        expect(getStatuses).toEqual([405]);
        expect(transport.sessionId).toBeUndefined();
        for (const response of responses) {
          expect(response.headers.get('mcp-session-id')).toBeNull();
          expect(response.headers.get('content-type')).not.toBe('text/event-stream');
        }
        expect(mockCreateServer.mock.calls.every(([principal]) => principal?.id === identity)).toBe(
          true,
        );
        expect(closeSpies.length).toBeGreaterThanOrEqual(4);
        for (const close of closeSpies) expect(close).toHaveBeenCalledTimes(1);
      } finally {
        await client.close();
      }
    },
  );
});
