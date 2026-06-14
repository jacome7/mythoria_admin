import { NextRequest, NextResponse } from 'next/server';
import { fiscalDocumentAdminService } from '@/db/services/fiscal-documents';
import { authenticateAdmin } from '@/lib/api-helpers';
import { redactFiscalPayload } from '@/lib/fiscal-documents';

export const runtime = 'nodejs';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

    return NextResponse.json({
      ...document,
      events: document.events.map((event) => ({
        ...event,
        requestPayload: redactFiscalPayload(event.requestPayload),
        responsePayload: redactFiscalPayload(event.responsePayload),
      })),
    });
  } catch (error) {
    console.error('Error fetching fiscal document detail:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
