import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  FiscalDocumentManualIssueError,
  fiscalDocumentAdminService,
} from '@/db/services/fiscal-documents';
import { authenticateAdmin } from '@/lib/api-helpers';

export const runtime = 'nodejs';

const manualMarkIssuedSchema = z.object({
  docType: z.string().trim().min(1).max(20),
  docSeries: z.string().trim().min(1).max(80),
  docNum: z.string().trim().min(1).max(80),
  fullDocNumber: z.string().trim().max(160).optional().nullable(),
  atDocCodeId: z.string().trim().max(255).optional().nullable(),
  issuedAt: z.coerce.date(),
  reason: z.string().trim().min(3).max(2000),
  confirmation: z.literal(true),
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await authenticateAdmin();
  if ('error' in admin) {
    return admin.error;
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 422 });
  }

  const parsed = manualMarkIssuedSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: 'Invalid manual issued payload',
        details: parsed.error.flatten(),
      },
      { status: 422 },
    );
  }

  try {
    const { id } = await params;
    const document = await fiscalDocumentAdminService.markIssuedManually(id, {
      docType: parsed.data.docType,
      docSeries: parsed.data.docSeries,
      docNum: parsed.data.docNum,
      fullDocNumber: parsed.data.fullDocNumber,
      atDocCodeId: parsed.data.atDocCodeId,
      issuedAt: parsed.data.issuedAt,
      reason: parsed.data.reason,
      adminEmail: admin.email,
      source: 'mythoria-admin',
    });

    return NextResponse.json(document);
  } catch (error) {
    if (error instanceof FiscalDocumentManualIssueError) {
      return NextResponse.json(error.payload, { status: error.status });
    }

    console.error('Error manually marking fiscal document as issued:', error);
    return NextResponse.json(
      { error: 'Failed to manually mark fiscal document as issued' },
      { status: 500 },
    );
  }
}
