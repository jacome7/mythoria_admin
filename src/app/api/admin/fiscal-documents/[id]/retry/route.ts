import { NextRequest, NextResponse } from 'next/server';
import { fiscalDocumentAdminService } from '@/db/services/fiscal-documents';
import { authenticateAdmin } from '@/lib/api-helpers';

export const runtime = 'nodejs';

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await authenticateAdmin();
  if ('error' in admin) {
    return admin.error;
  }

  try {
    const { id } = await params;
    const document = await fiscalDocumentAdminService.getById(id);
    if (!document) {
      return NextResponse.json({ error: 'Fiscal document not found' }, { status: 404 });
    }

    if (!document.retryableNow) {
      return NextResponse.json(
        { error: 'Fiscal document is not retryable right now' },
        { status: 409 },
      );
    }

    const webappUrl = process.env.WEBAPP_URL;
    const adminApiKey = process.env.ADMIN_API_KEY;
    if (!webappUrl || !adminApiKey) {
      return NextResponse.json(
        { error: 'Fiscal document retry backend is not configured' },
        { status: 503 },
      );
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
          adminEmail: admin.email,
          source: 'mythoria-admin',
        }),
      },
    );

    const rawBody = await response.text();
    let payload: unknown = null;
    if (rawBody) {
      try {
        payload = JSON.parse(rawBody);
      } catch {
        payload = { message: rawBody.slice(0, 500) };
      }
    }

    if (!response.ok) {
      console.error('Fiscal document retry backend failed:', {
        status: response.status,
        documentId: id,
        response: summarizeRetryError(payload),
      });
      return NextResponse.json(payload ?? { error: 'Fiscal document retry failed' }, {
        status: response.status,
      });
    }

    return NextResponse.json(payload ?? { success: true });
  } catch (error) {
    console.error('Error retrying fiscal document:', error);
    return NextResponse.json({ error: 'Failed to retry fiscal document' }, { status: 500 });
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
