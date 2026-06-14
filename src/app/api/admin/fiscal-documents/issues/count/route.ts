import { NextResponse } from 'next/server';
import { fiscalDocumentAdminService } from '@/db/services/fiscal-documents';
import { authenticateAdmin } from '@/lib/api-helpers';

export const runtime = 'nodejs';

export async function GET() {
  const admin = await authenticateAdmin();
  if ('error' in admin) {
    return admin.error;
  }

  try {
    const counts = await fiscalDocumentAdminService.getIssueCounts();
    return NextResponse.json(counts);
  } catch (error) {
    console.error('Error fetching fiscal document issue counts:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
