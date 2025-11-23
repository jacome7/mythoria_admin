import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { adminBlogService } from '@/db/services';
import { validateMdxSource } from '@/lib/blog/mdx-validate';
import { getBlogTranslationFieldLimits, resolveBlogFieldLimits } from '@/db/blog/limits';
import { normalizeAdminTranslations } from '@/lib/blog/normalize-translations';
import { ALLOWED_DOMAINS } from '@/config/auth';

function ensureAdminEmail(email?: string | null) {
  if (!email) return false;
  return ALLOWED_DOMAINS.some((d) => email.endsWith(d));
}

export async function GET(req: Request) {
  const session = await auth();
  if (!ensureAdminEmail(session?.user?.email)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const match = req.url.match(/\/api\/admin\/blog\/([^/]+)/);
  const id = match ? decodeURIComponent(match[1]) : null;
  if (!id) return NextResponse.json({ error: 'Invalid blog id' }, { status: 400 });
  const [data, limits] = await Promise.all([
    adminBlogService.getById(id),
    getBlogTranslationFieldLimits(),
  ]);
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const fieldLimits = resolveBlogFieldLimits(limits);
  return NextResponse.json({ data, fieldLimits });
}

export async function PUT(req: Request) {
  const session = await auth();
  if (!ensureAdminEmail(session?.user?.email)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const match = req.url.match(/\/api\/admin\/blog\/([^/]+)/);
  const id = match ? decodeURIComponent(match[1]) : null;
  if (!id) return NextResponse.json({ error: 'Invalid blog id' }, { status: 400 });
  const body = await req.json();
  if (!Array.isArray(body.translations) || body.translations.length === 0) {
    return NextResponse.json(
      { error: 'At least one translation is required when saving a blog post.' },
      { status: 400 },
    );
  }

  const rawLimits = await getBlogTranslationFieldLimits();
  const fieldLimits = resolveBlogFieldLimits(rawLimits);

  for (const tr of body.translations) {
    const result = validateMdxSource(tr.contentMdx || '');
    if (!result.ok) return NextResponse.json({ error: result.reason }, { status: 400 });
  }

  let normalizedTranslations;
  let warnings: string[] = [];
  try {
    const normalized = normalizeAdminTranslations(body.translations, rawLimits);
    normalizedTranslations = normalized.translations;
    warnings = normalized.warnings;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid translation payload';
    return NextResponse.json({ error: message }, { status: 400 });
  }

  try {
    const updated = await adminBlogService.update(id, {
      ...body,
      translations: normalizedTranslations,
    });
    return NextResponse.json({ data: updated, fieldLimits, warnings });
  } catch (e: unknown) {
    // Provide a cleaner error message
    const message = e instanceof Error ? e.message : 'Update failed';
    const friendly =
      message.includes('value too long') || message.includes('length')
        ? `One or more fields exceed the allowed length. Title max ${fieldLimits.title}, Summary max ${fieldLimits.summary}, Slug max ${fieldLimits.slug}.`
        : message;
    return NextResponse.json({ error: friendly }, { status: 400 });
  }
}

export async function DELETE(req: Request) {
  const session = await auth();
  if (!ensureAdminEmail(session?.user?.email)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const match = req.url.match(/\/api\/admin\/blog\/([^/]+)/);
  const id = match ? decodeURIComponent(match[1]) : null;
  if (!id) return NextResponse.json({ error: 'Invalid blog id' }, { status: 400 });
  await adminBlogService.delete(id);
  return NextResponse.json({ success: true });
}
