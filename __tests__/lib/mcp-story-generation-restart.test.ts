import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerMcpTools } from '@/lib/mcp/tools';
import { restartStoryGeneration } from '@/services/story-generation-restart';

jest.mock('@/services/story-generation-restart', () => ({
  restartStoryGeneration: jest.fn(),
}));

jest.mock('@/services/fiscal-document-retry', () => ({
  FiscalDocumentRetryHttpError: class FiscalDocumentRetryHttpError extends Error {},
}));

type RegisteredTool = {
  handler: (args: Record<string, unknown>) => Promise<{
    isError?: boolean;
    content: Array<{ type: 'text'; text: string }>;
  }>;
};

const mockRestartStoryGeneration = jest.mocked(restartStoryGeneration);

function captureTools(): Map<string, RegisteredTool> {
  const tools = new Map<string, RegisteredTool>();
  const server = {
    tool: jest.fn(
      (
        name: string,
        _description: string,
        _schema: unknown,
        handler: RegisteredTool['handler'],
      ) => {
        tools.set(name, { handler });
      },
    ),
  } as unknown as McpServer;

  registerMcpTools(server);
  return tools;
}

describe('story generation restart MCP tool', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('uses the same durable dispatcher as the Admin UI route', async () => {
    mockRestartStoryGeneration.mockResolvedValue({
      storyId: 'story-1',
      runId: 'run-1',
      status: 'published',
      messageId: 'message-1',
    });

    const result = await captureTools().get('restart_story_workflow')!.handler({
      storyId: 'story-1',
    });

    expect(result.isError).toBeUndefined();
    expect(mockRestartStoryGeneration).toHaveBeenCalledWith({
      storyId: 'story-1',
      source: 'mythoria-admin-mcp',
      requestedBy: 'mcp',
    });
    expect(JSON.parse(result.content[0].text).run.status).toBe('published');
  });

  it('exposes the durable retry state', async () => {
    mockRestartStoryGeneration.mockResolvedValue({
      storyId: 'story-1',
      runId: 'run-1',
      status: 'retrying',
      dispatchError: 'Pub/Sub unavailable',
    });

    const result = await captureTools().get('restart_story_workflow')!.handler({
      storyId: 'story-1',
    });
    const payload = JSON.parse(result.content[0].text);

    expect(payload.run.status).toBe('retrying');
    expect(payload.message).toContain('automatic retry');
  });
});
