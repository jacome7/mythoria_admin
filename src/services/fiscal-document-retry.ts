import { fiscalDocumentAdminService } from '@/db/services/fiscal-documents';

export class FiscalDocumentRetryHttpError extends Error {
  constructor(
    readonly status: number,
    readonly payload: unknown,
  ) {
    super(getRetryErrorMessage(payload));
  }
}

export interface FiscalDocumentRetryParams {
  id: string;
  adminEmail: string;
  source: 'mythoria-admin' | 'mythoria-admin-mcp';
}

export async function requestFiscalDocumentRetry({
  id,
  adminEmail,
  source,
}: FiscalDocumentRetryParams): Promise<unknown> {
  const document = await fiscalDocumentAdminService.getById(id);
  if (!document) {
    throw new FiscalDocumentRetryHttpError(404, { error: 'Fiscal document not found' });
  }

  if (!document.retryableNow) {
    throw new FiscalDocumentRetryHttpError(409, {
      error: 'Fiscal document is not retryable right now',
    });
  }

  const webappUrl = process.env.WEBAPP_URL;
  const adminApiKey = process.env.ADMIN_API_KEY;
  if (!webappUrl || !adminApiKey) {
    throw new FiscalDocumentRetryHttpError(503, {
      error: 'Fiscal document retry backend is not configured',
    });
  }

  const response = await fetch(
    `${webappUrl.replace(/\/$/, '')}/api/admin/fiscal-documents/${encodeURIComponent(id)}/retry`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': adminApiKey,
      },
      body: JSON.stringify({
        adminEmail,
        source,
      }),
    },
  );

  const payload = await parseRetryResponsePayload(response);
  if (!response.ok) {
    console.error('Fiscal document retry backend failed:', {
      status: response.status,
      documentId: id,
      response: summarizeRetryError(payload),
    });
    throw new FiscalDocumentRetryHttpError(
      response.status,
      payload ?? { error: 'Fiscal document retry failed' },
    );
  }

  return payload ?? { success: true };
}

async function parseRetryResponsePayload(response: Response): Promise<unknown> {
  const rawBody = await response.text();
  if (!rawBody) {
    return null;
  }

  try {
    return JSON.parse(rawBody);
  } catch {
    return { message: rawBody.slice(0, 500) };
  }
}

function summarizeRetryError(payload: unknown): unknown {
  if (!payload || typeof payload !== 'object') {
    return payload;
  }

  return {
    error: 'error' in payload ? payload.error : undefined,
    message: 'message' in payload ? payload.message : undefined,
  };
}

function getRetryErrorMessage(payload: unknown): string {
  if (!payload || typeof payload !== 'object') {
    return 'Fiscal document retry failed';
  }

  const error = 'error' in payload ? payload.error : undefined;
  const message = 'message' in payload ? payload.message : undefined;
  return typeof error === 'string'
    ? error
    : typeof message === 'string'
      ? message
      : 'Fiscal document retry failed';
}
