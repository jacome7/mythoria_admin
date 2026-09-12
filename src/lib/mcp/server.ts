import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { NextSSETransport } from './NextSSETransport';
import { registerMcpTools } from './tools';
import { registerReferralMcpTools } from './referrals';
import type { McpPrincipal } from './auth';

/** One MCP protocol stack per SSE session (SDK Protocol allows only one transport at a time). */
export function createMcpServer(principal?: McpPrincipal): McpServer {
  const server = new McpServer({
    name: 'mythoria_admin',
    version: '1.0.0',
  });

  if (!principal || principal.legacy) registerMcpTools(server);
  if (principal && !principal.legacy) registerReferralMcpTools(server, principal.actor);

  return server;
}

const globalForMcp = globalThis as unknown as {
  activeTransports?: Map<string, NextSSETransport>;
  transportPrincipals?: Map<string, string>;
};

export const activeTransports =
  globalForMcp.activeTransports ?? new Map<string, NextSSETransport>();
export const transportPrincipals = globalForMcp.transportPrincipals ?? new Map<string, string>();

if (process.env.NODE_ENV !== 'production') {
  globalForMcp.activeTransports = activeTransports;
  globalForMcp.transportPrincipals = transportPrincipals;
}
