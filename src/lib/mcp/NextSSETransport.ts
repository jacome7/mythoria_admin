import { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { JSONRPCMessage } from "@modelcontextprotocol/sdk/types.js";

export class NextSSETransport implements Transport {
  public onmessage?: (message: JSONRPCMessage) => void;
  public onclose?: () => void;
  public onerror?: (error: Error) => void;

  private _controller?: ReadableStreamDefaultController;
  public readonly responseStream: ReadableStream;
  public readonly sessionId: string;
  private _endpoint: string;

  constructor(endpoint: string) {
    this.sessionId = crypto.randomUUID();
    this._endpoint = endpoint;
    this.responseStream = new ReadableStream({
      start: (controller) => {
        this._controller = controller;
        // Send the endpoint event as per MCP SSE spec
        const endpointUrl = new URL(this._endpoint, "http://localhost");
        endpointUrl.searchParams.set("sessionId", this.sessionId);
        const relativeOrAbsoluteUrl = `${endpointUrl.pathname}${endpointUrl.search}`;
        controller.enqueue(new TextEncoder().encode(`event: endpoint\ndata: ${relativeOrAbsoluteUrl}\n\n`));
      },
      cancel: () => {
        if (this.onclose) this.onclose();
      },
    });
  }

  async start(): Promise<void> {
    // Stream starts automatically when read
  }

  async close(): Promise<void> {
    if (this._controller) {
      this._controller.close();
    }
    if (this.onclose) {
      this.onclose();
    }
  }

  async send(message: JSONRPCMessage): Promise<void> {
    if (!this._controller) {
      throw new Error("Cannot send on closed stream");
    }
    const data = JSON.stringify(message);
    this._controller.enqueue(new TextEncoder().encode(`event: message\ndata: ${data}\n\n`));
  }

  // Called from POST route
  public handleMessage(message: unknown): void {
    if (this.onmessage) {
      this.onmessage(message as JSONRPCMessage);
    }
  }
}
