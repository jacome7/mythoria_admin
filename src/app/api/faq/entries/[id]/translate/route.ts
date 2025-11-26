import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { ALLOWED_DOMAINS } from '@/config/auth';
import { translateFaqEntryById } from '@/lib/faq/translation';

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const resolvedParams = await params;
    const session = await auth();

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const isAllowedDomain = ALLOWED_DOMAINS.some((domain) => session.user?.email?.endsWith(domain));

    if (!isAllowedDomain) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const result = await translateFaqEntryById(resolvedParams.id, session.user.email);

    if (result.outcome === 'not_found') {
      return NextResponse.json({ error: 'FAQ entry not found' }, { status: 404 });
    }

    if (result.outcome === 'nothing_to_translate') {
      return NextResponse.json({
        message: 'All locales already have translations',
        existingLocales: result.existingLocales,
      });
    }

    return NextResponse.json({
      success: true,
      sourceEntry: result.sourceEntry,
      created: result.createdEntries,
      errors: result.errors,
      requestId: result.requestId,
      message: `Successfully created ${result.createdEntries.length} translations${
        result.errors?.length ? ` with ${result.errors.length} errors` : ''
      }`,
    });
  } catch (error) {
    console.error('Error translating FAQ entry:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
