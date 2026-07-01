import { requestFiscalDocumentRetry } from '@/services/fiscal-document-retry';
import { fiscalDocumentAdminService } from '@/db/services/fiscal-documents';

jest.mock('@/db/services/fiscal-documents', () => ({
  fiscalDocumentAdminService: {
    getById: jest.fn(),
  },
}));

const mockFiscalService = jest.mocked(fiscalDocumentAdminService);

describe('requestFiscalDocumentRetry', () => {
  const originalFetch = global.fetch;
  const originalWebappUrl = process.env.WEBAPP_URL;
  const originalAdminApiKey = process.env.ADMIN_API_KEY;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.WEBAPP_URL = 'http://webapp.local';
    process.env.ADMIN_API_KEY = 'test-key';
    global.fetch = jest.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    process.env.WEBAPP_URL = originalWebappUrl;
    process.env.ADMIN_API_KEY = originalAdminApiKey;
  });

  it('rejects documents that are not retryable now', async () => {
    mockFiscalService.getById.mockResolvedValue({ retryableNow: false } as never);

    await expect(
      requestFiscalDocumentRetry({
        id: 'doc-id',
        adminEmail: 'admin@mythoria.pt',
        source: 'mythoria-admin-mcp',
      }),
    ).rejects.toMatchObject({
      status: 409,
      payload: { error: 'Fiscal document is not retryable right now' },
    });
  });

  it('forwards the retry request to mythoria-webapp with audit source', async () => {
    mockFiscalService.getById.mockResolvedValue({ retryableNow: true } as never);
    jest
      .mocked(global.fetch)
      .mockResolvedValue(new Response(JSON.stringify({ success: true }), { status: 200 }));

    const result = await requestFiscalDocumentRetry({
      id: 'doc-id',
      adminEmail: 'admin@mythoria.pt',
      source: 'mythoria-admin-mcp',
    });

    expect(result).toEqual({ success: true });
    expect(global.fetch).toHaveBeenCalledWith(
      'http://webapp.local/api/admin/fiscal-documents/doc-id/retry',
      expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': 'test-key',
        },
        body: JSON.stringify({
          adminEmail: 'admin@mythoria.pt',
          source: 'mythoria-admin-mcp',
        }),
      }),
    );
  });

  it('surfaces retry backend failures', async () => {
    mockFiscalService.getById.mockResolvedValue({ retryableNow: true } as never);
    jest
      .mocked(global.fetch)
      .mockResolvedValue(
        new Response(JSON.stringify({ error: 'backend unavailable' }), { status: 503 }),
      );

    await expect(
      requestFiscalDocumentRetry({
        id: 'doc-id',
        adminEmail: 'admin@mythoria.pt',
        source: 'mythoria-admin',
      }),
    ).rejects.toMatchObject({
      status: 503,
      payload: { error: 'backend unavailable' },
    });
  });
});
