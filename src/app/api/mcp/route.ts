import { NextRequest, NextResponse } from "next/server";
import { mcpServer, activeTransports } from "@/lib/mcp/server";
import { NextSSETransport } from "@/lib/mcp/NextSSETransport";
import crypto from "crypto";

// Security Middleware checking the Auth Header
function validateMcpAuth(req: NextRequest): boolean {
  // If no secret key is configured, reject everything.
  const secretKey = process.env.MCP_SECRET_KEY;
  if (!secretKey) {
    console.error("MCP_SECRET_KEY is not configured.");
    return false;
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return false;
  }

  const token = authHeader.split(" ")[1];
  
  if (token.length !== secretKey.length) {
    return false;
  }

  // Use timing-safe equal to prevent timing attacks
  return crypto.timingSafeEqual(Buffer.from(token), Buffer.from(secretKey));
}

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!validateMcpAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Standard endpoint config
  const transport = new NextSSETransport("/api/mcp/messages");
  
  // Register transport in memory so messages can be routed to it
  activeTransports.set(transport.sessionId, transport);

  transport.onclose = () => {
    activeTransports.delete(transport.sessionId);
  };

  // Connect the server to this transport. 
  // It handles its own responses and dispatches via transport.send()
  await mcpServer.connect(transport);

  // Return the standard SSE stream headers
  return new NextResponse(transport.responseStream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
