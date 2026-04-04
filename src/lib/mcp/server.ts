import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { NextSSETransport } from "./NextSSETransport";
import { registerMcpTools } from "./tools";

// Initialize the MCP Server (cached in global for Next.js hot reloads)
const initMcpServer = () => {
  const server = new McpServer({
    name: "mythoria_admin",
    version: "1.0.0",
  });

  registerMcpTools(server);

  return server;
};

// Global cache for singleton
const globalForMcp = globalThis as unknown as {
  mcpServer?: McpServer;
  activeTransports?: Map<string, NextSSETransport>;
};

export const mcpServer = globalForMcp.mcpServer ?? initMcpServer();
export const activeTransports = globalForMcp.activeTransports ?? new Map<string, NextSSETransport>();

if (process.env.NODE_ENV !== "production") {
  globalForMcp.mcpServer = mcpServer;
  globalForMcp.activeTransports = activeTransports;
}
