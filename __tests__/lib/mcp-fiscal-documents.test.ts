import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { fiscalDocumentAdminService } from '@/db/services/fiscal-documents';
import { registerMcpTools } from '@/lib/mcp/tools';
import {
  FiscalDocumentRetryHttpError,
  requestFiscalDocumentRetry,
} from '@/services/fiscal-document-retry';

jest.mock('@/db/services/fiscal-documents', () => ({
  fiscalDocumentAdminService: {
    list: jest.fn(),
    getById: jest.fn(),
    getIssueCounts: jest.fn(),
  },
}));

jest.mock('@/services/fiscal-document-retry', () => {
  class FiscalDocumentRetryHttpError extends Error {
    constructor(
      readonly status: number,
      readonly payload: unknown,
    ) {
      super('retry failed');
    }
  }

  return {
    FiscalDocumentRetryHttpError,
    requestFiscalDocumentRetry: jest.fn(),
  };
});

type RegisteredTool = {
  handler: (args: Record<string, unknown>) => Promise<{
    isError?: boolean;
    content: Array<{ type: 'text'; text: string }>;
  }>;
};

const mockFiscalService = jest.mocked(fiscalDocumentAdminService);
const mockRequestFiscalDocumentRetry = jest.mocked(requestFiscalDocumentRetry);

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

describe('fiscal document MCP tools', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('maps list filters to the fiscal document service', async () => {
    const tools = captureTools();
    mockFiscalService.list.mockResolvedValue({
      data: [],
      pagination: {
        page: 1,
        limit: 25,
        totalCount: 0,
        totalPages: 0,
        hasNext: false,
        hasPrev: false,
      },
    });

    const result = await tools.get('list_fiscal_documents')!.handler({
      statuses: ['failed', 'pending'],
      needsAttention: true,
      customerMode: 'keyinvoice_client',
      provider: 'keyinvoice',
      dateFrom: '2026-06-01T00:00:00.000Z',
      dateTo: '2026-06-30T23:59:59.000Z',
      q: 'stripe',
      sort: 'updatedAt',
      sortOrder: 'asc',
      limit: 25,
    });

    expect(result.isError).toBeUndefined();
    expect(mockFiscalService.list).toHaveBeenCalledWith(
      expect.objectContaining({
        statuses: ['failed', 'pending'],
        needsAttention: true,
        customerMode: 'keyinvoice_client',
        provider: 'keyinvoice',
        q: 'stripe',
        sort: 'updatedAt',
        sortOrder: 'asc',
        limit: 25,
      }),
    );
    expect(mockFiscalService.list).toHaveBeenCalledWith(
      expect.objectContaining({
        dateFrom: new Date('2026-06-01T00:00:00.000Z'),
        dateTo: new Date('2026-06-30T23:59:59.000Z'),
      }),
    );
    expect(JSON.parse(result.content[0].text)).toEqual({
      fiscalDocuments: [],
      pagination: {
        page: 1,
        limit: 25,
        totalCount: 0,
        totalPages: 0,
        hasNext: false,
        hasPrev: false,
      },
    });
  });

  it('returns redacted fiscal document details', async () => {
    const tools = captureTools();
    mockFiscalService.getById.mockResolvedValue({
      id: 'doc-id',
      events: [
        {
          requestPayload: {
            apiKey: 'secret',
            nested: { authorization: 'bearer token', safe: 'visible' },
          },
          responsePayload: { sessionId: 'session' },
        },
      ],
    } as never);

    const result = await tools.get('get_fiscal_document_details')!.handler({ id: 'doc-id' });
    const payload = JSON.parse(result.content[0].text);

    expect(result.isError).toBeUndefined();
    expect(payload.events[0].requestPayload).toEqual({
      apiKey: '[REDACTED]',
      nested: { authorization: '[REDACTED]', safe: 'visible' },
    });
    expect(payload.events[0].responsePayload).toEqual({ sessionId: '[REDACTED]' });
  });

  it('returns issue counts', async () => {
    const tools = captureTools();
    mockFiscalService.getIssueCounts.mockResolvedValue({
      failed: 1,
      stalePending: 2,
      staleIssuing: 3,
      creditNoteRequired: 4,
      total: 10,
    });

    const result = await tools.get('get_fiscal_document_issue_counts')!.handler({});

    expect(result.isError).toBeUndefined();
    expect(JSON.parse(result.content[0].text)).toEqual({
      failed: 1,
      stalePending: 2,
      staleIssuing: 3,
      creditNoteRequired: 4,
      total: 10,
    });
  });

  it('passes retry requests to the shared retry service with MCP source', async () => {
    const tools = captureTools();
    mockRequestFiscalDocumentRetry.mockResolvedValue({ success: true });

    const result = await tools.get('retry_fiscal_document_keyinvoice')!.handler({
      id: 'doc-id',
      adminEmail: 'admin@mythoria.pt',
    });

    expect(result.isError).toBeUndefined();
    expect(mockRequestFiscalDocumentRetry).toHaveBeenCalledWith({
      id: 'doc-id',
      adminEmail: 'admin@mythoria.pt',
      source: 'mythoria-admin-mcp',
    });
  });

  it('surfaces retry helper failures as tool errors', async () => {
    const tools = captureTools();
    mockRequestFiscalDocumentRetry.mockRejectedValue(
      new FiscalDocumentRetryHttpError(409, {
        error: 'Fiscal document is not retryable right now',
      }),
    );

    const result = await tools.get('retry_fiscal_document_keyinvoice')!.handler({
      id: 'doc-id',
      adminEmail: 'admin@mythoria.pt',
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('status 409');
  });
});
