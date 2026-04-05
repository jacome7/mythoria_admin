import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { NextSSETransport } from './NextSSETransport';
import { registerMcpTools } from './tools';

/** One MCP protocol stack per SSE session (SDK Protocol allows only one transport at a time). */
export function createMcpServer(): McpServer {
  const server = new McpServer({
    name: 'mythoria_admin',
    version: '1.0.0',
  });

  registerMcpTools(server);

  return server;
}

const globalForMcp = globalThis as unknown as {
  activeTransports?: Map<string, NextSSETransport>;
};

export const activeTransports =
  globalForMcp.activeTransports ?? new Map<string, NextSSETransport>();

if (process.env.NODE_ENV !== 'production') {
  globalForMcp.activeTransports = activeTransports;
}
