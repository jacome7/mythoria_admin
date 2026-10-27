import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerMcpTools } from './tools';
import { registerReferralMcpTools } from './referrals';
import type { McpPrincipal } from './auth';

/** One MCP protocol stack per HTTP request, isolated to the authenticated principal. */
export function createMcpServer(principal?: McpPrincipal): McpServer {
  const server = new McpServer({
    name: 'mythoria_admin',
    version: '1.0.0',
  });

  if (!principal || principal.legacy) registerMcpTools(server);
  if (principal && !principal.legacy) registerReferralMcpTools(server, principal.actor);

  return server;
}
