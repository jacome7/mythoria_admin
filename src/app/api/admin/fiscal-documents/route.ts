import { NextRequest, NextResponse } from 'next/server';
import { authenticateAdmin } from '@/lib/api-helpers';
import { fiscalDocumentAdminService, type FiscalSort } from '@/db/services/fiscal-documents';
import {
  isFiscalCustomerMode,
  isFiscalDocumentStatus,
  type FiscalDocumentStatus,
} from '@/lib/fiscal-documents';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const admin = await authenticateAdmin();
  if ('error' in admin) {
    return admin.error;
  }

  try {
    const { searchParams } = new URL(request.url);
    const statuses = parseStatuses(searchParams.get('status'));
    const customerMode = searchParams.get('customerMode');

    const result = await fiscalDocumentAdminService.list({
      page: parseInteger(searchParams.get('page')),
      limit: parseInteger(searchParams.get('limit')),
      statuses,
      needsAttention: parseBoolean(searchParams.get('needsAttention')),
      hasError: parseBoolean(searchParams.get('hasError')),
      customerMode: customerMode && isFiscalCustomerMode(customerMode) ? customerMode : undefined,
      provider: searchParams.get('provider') === 'keyinvoice' ? 'keyinvoice' : undefined,
      dateFrom: parseDate(searchParams.get('dateFrom')),
      dateTo: parseDate(searchParams.get('dateTo')),
      q: searchParams.get('q') || searchParams.get('search') || undefined,
      sort: parseSort(searchParams.get('sort')),
      sortOrder: searchParams.get('sortOrder') === 'asc' ? 'asc' : 'desc',
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching fiscal documents:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

function parseStatuses(value: string | null): FiscalDocumentStatus[] | undefined {
  if (!value) {
    return undefined;
  }

  const statuses = value
    .split(',')
    .map((item) => item.trim())
    .filter(isFiscalDocumentStatus);

  return statuses.length ? statuses : undefined;
}

function parseInteger(value: string | null): number | undefined {
  if (!value) {
    return undefined;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseBoolean(value: string | null): boolean | undefined {
  if (value === 'true') {
    return true;
  }
  if (value === 'false') {
    return false;
  }
  return undefined;
}

function parseDate(value: string | null): Date | undefined {
  if (!value) {
    return undefined;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function parseSort(value: string | null): FiscalSort | undefined {
  if (
    value === 'createdAt' ||
    value === 'updatedAt' ||
    value === 'attemptCount' ||
    value === 'nextRetryAt' ||
    value === 'issuedAt' ||
    value === 'attention'
  ) {
    return value;
  }
  return undefined;
}
