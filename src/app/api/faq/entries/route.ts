import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { adminService } from '@/db/services';
import { ALLOWED_DOMAINS } from '@/config/auth';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const isAllowedDomain = ALLOWED_DOMAINS.some((domain) => session.user?.email?.endsWith(domain));

    if (!isAllowedDomain) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const searchTerm = searchParams.get('search') || undefined;
    const sectionId = searchParams.get('sectionId') || undefined;
    const locale = searchParams.get('locale') || undefined;
    const faqKey = searchParams.get('faqKey') || undefined;
    const isPublishedFilter = searchParams.get('isPublished') || undefined;
    const sortFieldParam = searchParams.get('sortField');
    const sortOrderParam = searchParams.get('sortOrder');

    const allowedSortFields = [
      'questionSortOrder',
      'section',
      'locale',
      'title',
      'faqKey',
    ] as const;
    const sortField = allowedSortFields.includes(
      sortFieldParam as (typeof allowedSortFields)[number],
    )
      ? (sortFieldParam as (typeof allowedSortFields)[number])
      : 'questionSortOrder';
    const sortOrder = sortOrderParam === 'desc' ? 'desc' : 'asc';

    const result = await adminService.getFaqEntries(
      page,
      limit,
      searchTerm,
      sectionId,
      locale,
      faqKey,
      isPublishedFilter,
      sortField,
      sortOrder,
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching FAQ entries:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const isAllowedDomain = ALLOWED_DOMAINS.some((domain) => session.user?.email?.endsWith(domain));

    if (!isAllowedDomain) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();

    // Validate required fields
    if (!body.sectionId || !body.faqKey || !body.locale || !body.title || !body.contentMdx) {
      return NextResponse.json(
        { error: 'sectionId, faqKey, locale, title, and contentMdx are required' },
        { status: 400 },
      );
    }

    const entry = await adminService.createFaqEntry(body);

    return NextResponse.json(entry, { status: 201 });
  } catch (error) {
    console.error('Error creating FAQ entry:', error);
    if (error instanceof Error && error.message.includes('already exists')) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const isAllowedDomain = ALLOWED_DOMAINS.some((domain) => session.user?.email?.endsWith(domain));

    if (!isAllowedDomain) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const ids = searchParams.get('ids')?.split(',') || [];

    if (ids.length === 0) {
      return NextResponse.json({ error: 'No IDs provided' }, { status: 400 });
    }

    const deletedEntries = await adminService.bulkDeleteFaqEntries(ids);

    return NextResponse.json({
      success: true,
      deletedCount: deletedEntries.length,
    });
  } catch (error) {
    console.error('Error bulk deleting FAQ entries:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
