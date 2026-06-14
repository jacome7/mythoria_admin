import { NextResponse } from 'next/server';
import { GET as listFiscalDocuments } from '@/app/api/admin/fiscal-documents/route';
import { GET as getFiscalDocument } from '@/app/api/admin/fiscal-documents/[id]/route';
import { GET as getFiscalDocumentPdf } from '@/app/api/admin/fiscal-documents/[id]/pdf/route';
import { POST as retryFiscalDocument } from '@/app/api/admin/fiscal-documents/[id]/retry/route';
import { authenticateAdmin } from '@/lib/api-helpers';
import { fiscalDocumentAdminService } from '@/db/services/fiscal-documents';

jest.mock('@/lib/api-helpers', () => ({
  authenticateAdmin: jest.fn(),
}));

jest.mock('@/db/services/fiscal-documents', () => ({
  fiscalDocumentAdminService: {
    list: jest.fn(),
    getById: jest.fn(),
    getIssueCounts: jest.fn(),
  },
}));

jest.mock('@/lib/fiscal-pdf-storage', () => ({
  downloadFiscalDocumentPdf: jest.fn(),
}));

const mockAuthenticateAdmin = jest.mocked(authenticateAdmin);
const mockFiscalService = jest.mocked(fiscalDocumentAdminService);

describe('fiscal document API routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthenticateAdmin.mockResolvedValue({ email: 'admin@mythoria.pt' });
  });

  it('rejects unauthenticated list requests', async () => {
    mockAuthenticateAdmin.mockResolvedValue({
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    });

    const response = await listFiscalDocuments(
      new Request('http://localhost/api/admin/fiscal-documents') as never,
    );

    expect(response.status).toBe(401);
    expect(mockFiscalService.list).not.toHaveBeenCalled();
  });

  it('passes list filters to the service', async () => {
    mockFiscalService.list.mockResolvedValue({
      data: [],
      pagination: {
        page: 1,
        limit: 50,
        totalCount: 0,
        totalPages: 0,
        hasNext: false,
        hasPrev: false,
      },
    });

    const response = await listFiscalDocuments(
      new Request(
        'http://localhost/api/admin/fiscal-documents?status=failed,pending&needsAttention=true&q=stripe',
      ) as never,
    );

    expect(response.status).toBe(200);
    expect(mockFiscalService.list).toHaveBeenCalledWith(
      expect.objectContaining({
        statuses: ['failed', 'pending'],
        needsAttention: true,
        q: 'stripe',
      }),
    );
  });

  it('returns 404 when detail is missing', async () => {
    mockFiscalService.getById.mockResolvedValue(null);

    const response = await getFiscalDocument(new Request('http://localhost') as never, {
      params: Promise.resolve({ id: 'missing' }),
    });

    expect(response.status).toBe(404);
  });

  it('does not serve a PDF for non-issued documents', async () => {
    mockFiscalService.getById.mockResolvedValue({
      status: 'failed',
      pdfStoragePath: null,
    } as never);

    const response = await getFiscalDocumentPdf(new Request('http://localhost') as never, {
      params: Promise.resolve({ id: 'doc-id' }),
    });

    expect(response.status).toBe(404);
  });

  it('rejects retry when document is not retryable', async () => {
    mockFiscalService.getById.mockResolvedValue({
      retryableNow: false,
    } as never);

    const response = await retryFiscalDocument(new Request('http://localhost') as never, {
      params: Promise.resolve({ id: 'doc-id' }),
    });

    expect(response.status).toBe(409);
  });

  it('surfaces retry backend failures', async () => {
    mockFiscalService.getById.mockResolvedValue({
      retryableNow: true,
    } as never);
    process.env.WEBAPP_URL = 'http://webapp.local';
    process.env.ADMIN_API_KEY = 'test-key';
    const originalFetch = global.fetch;
    global.fetch = jest.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: 'backend unavailable' }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const response = await retryFiscalDocument(new Request('http://localhost') as never, {
      params: Promise.resolve({ id: 'doc-id' }),
    });

    expect(response.status).toBe(503);
    global.fetch = originalFetch;
  });
});
