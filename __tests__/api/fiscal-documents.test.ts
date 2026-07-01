import { NextResponse } from 'next/server';
import { GET as listFiscalDocuments } from '@/app/api/admin/fiscal-documents/route';
import { GET as getFiscalDocument } from '@/app/api/admin/fiscal-documents/[id]/route';
import { POST as markFiscalDocumentIssued } from '@/app/api/admin/fiscal-documents/[id]/mark-issued/route';
import { GET as getFiscalDocumentPdf } from '@/app/api/admin/fiscal-documents/[id]/pdf/route';
import { POST as retryFiscalDocument } from '@/app/api/admin/fiscal-documents/[id]/retry/route';
import { authenticateAdmin } from '@/lib/api-helpers';
import {
  FiscalDocumentManualIssueError,
  fiscalDocumentAdminService,
} from '@/db/services/fiscal-documents';
import {
  FiscalDocumentRetryHttpError,
  requestFiscalDocumentRetry,
} from '@/services/fiscal-document-retry';

jest.mock('@/lib/api-helpers', () => ({
  authenticateAdmin: jest.fn(),
}));

jest.mock('@/db/services/fiscal-documents', () => ({
  FiscalDocumentManualIssueError: class FiscalDocumentManualIssueError extends Error {
    constructor(
      readonly status: 404 | 409,
      readonly payload: unknown,
    ) {
      super('manual mark issued failed');
    }
  },
  fiscalDocumentAdminService: {
    list: jest.fn(),
    getById: jest.fn(),
    getIssueCounts: jest.fn(),
    markIssuedManually: jest.fn(),
  },
}));

jest.mock('@/lib/fiscal-pdf-storage', () => ({
  downloadFiscalDocumentPdf: jest.fn(),
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

const mockAuthenticateAdmin = jest.mocked(authenticateAdmin);
const mockFiscalService = jest.mocked(fiscalDocumentAdminService);
const mockRequestFiscalDocumentRetry = jest.mocked(requestFiscalDocumentRetry);

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

  it('passes retry requests to the shared retry helper', async () => {
    mockRequestFiscalDocumentRetry.mockResolvedValue({ success: true });

    const response = await retryFiscalDocument(new Request('http://localhost') as never, {
      params: Promise.resolve({ id: 'doc-id' }),
    });

    expect(response.status).toBe(200);
    expect(mockRequestFiscalDocumentRetry).toHaveBeenCalledWith({
      id: 'doc-id',
      adminEmail: 'admin@mythoria.pt',
      source: 'mythoria-admin',
    });
  });

  it('maps retry helper failures to HTTP responses', async () => {
    mockRequestFiscalDocumentRetry.mockRejectedValue(
      new FiscalDocumentRetryHttpError(503, { error: 'backend unavailable' }),
    );

    const response = await retryFiscalDocument(new Request('http://localhost') as never, {
      params: Promise.resolve({ id: 'doc-id' }),
    });

    expect(response.status).toBe(503);
  });

  it('rejects unauthenticated manual mark-issued requests', async () => {
    mockAuthenticateAdmin.mockResolvedValue({
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    });

    const response = await markFiscalDocumentIssued(new Request('http://localhost') as never, {
      params: Promise.resolve({ id: 'doc-id' }),
    });

    expect(response.status).toBe(401);
    expect(mockFiscalService.markIssuedManually).not.toHaveBeenCalled();
  });

  it('validates manual mark-issued payloads', async () => {
    const response = await markFiscalDocumentIssued(
      new Request('http://localhost', {
        method: 'POST',
        body: JSON.stringify({
          docType: '',
          docSeries: '23',
          docNum: '',
          issuedAt: 'not-a-date',
          reason: '',
          confirmation: false,
        }),
      }) as never,
      {
        params: Promise.resolve({ id: 'doc-id' }),
      },
    );

    expect(response.status).toBe(422);
    expect(mockFiscalService.markIssuedManually).not.toHaveBeenCalled();
  });

  it('passes normalized manual mark-issued data to the service', async () => {
    mockFiscalService.markIssuedManually.mockResolvedValue({
      id: 'doc-id',
      status: 'issued',
    } as never);

    const response = await markFiscalDocumentIssued(
      new Request('http://localhost', {
        method: 'POST',
        body: JSON.stringify({
          docType: ' 34 ',
          docSeries: ' 23 ',
          docNum: ' 9 ',
          fullDocNumber: '',
          atDocCodeId: ' AT ',
          issuedAt: '2026-07-01T12:00:00.000Z',
          reason: ' Verified manually ',
          confirmation: true,
        }),
      }) as never,
      {
        params: Promise.resolve({ id: 'doc-id' }),
      },
    );

    expect(response.status).toBe(200);
    expect(mockFiscalService.markIssuedManually).toHaveBeenCalledWith(
      'doc-id',
      expect.objectContaining({
        docType: '34',
        docSeries: '23',
        docNum: '9',
        fullDocNumber: '',
        atDocCodeId: 'AT',
        reason: 'Verified manually',
        adminEmail: 'admin@mythoria.pt',
        source: 'mythoria-admin',
      }),
    );
    expect(mockFiscalService.markIssuedManually.mock.calls[0][1].issuedAt).toBeInstanceOf(Date);
  });

  it('maps manual mark-issued service conflicts to HTTP responses', async () => {
    mockFiscalService.markIssuedManually.mockRejectedValue(
      new FiscalDocumentManualIssueError(409, {
        error: 'Another fiscal document already uses this KeyInvoice document identity',
        code: 'duplicate_document_identity',
      }),
    );

    const response = await markFiscalDocumentIssued(
      new Request('http://localhost', {
        method: 'POST',
        body: JSON.stringify({
          docType: '34',
          docSeries: '23',
          docNum: '9',
          issuedAt: '2026-07-01T12:00:00.000Z',
          reason: 'Verified manually',
          confirmation: true,
        }),
      }) as never,
      {
        params: Promise.resolve({ id: 'doc-id' }),
      },
    );

    expect(response.status).toBe(409);
  });
});
