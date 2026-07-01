import { NextRequest, NextResponse } from 'next/server';
import { authenticateAdmin } from '@/lib/api-helpers';
import {
  FiscalDocumentRetryHttpError,
  requestFiscalDocumentRetry,
} from '@/services/fiscal-document-retry';

export const runtime = 'nodejs';

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await authenticateAdmin();
  if ('error' in admin) {
    return admin.error;
  }

  try {
    const { id } = await params;
    const result = await requestFiscalDocumentRetry({
      id,
      adminEmail: admin.email,
      source: 'mythoria-admin',
    });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof FiscalDocumentRetryHttpError) {
      return NextResponse.json(error.payload, { status: error.status });
    }

    console.error('Error retrying fiscal document:', error);
    return NextResponse.json({ error: 'Failed to retry fiscal document' }, { status: 500 });
  }
}
