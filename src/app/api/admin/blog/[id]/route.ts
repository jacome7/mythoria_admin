import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { adminBlogService } from '@/db/services';
import { validateMdxSource } from '@/lib/blog/mdx-validate';
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
  const data = await adminBlogService.getById(id);
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ data });
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
  // Basic validation matching DB constraints
  if (Array.isArray(body.translations)) {
    for (const tr of body.translations) {
      // Validate MDX compiles
      const result = validateMdxSource(tr.contentMdx || '');
      if (!result.ok) return NextResponse.json({ error: result.reason }, { status: 400 });

      // Enforce length constraints to avoid DB errors
      const locale = tr.locale || 'unknown locale';
      if (
        typeof tr.slug !== 'string' ||
        tr.slug.length < 1 ||
        tr.slug.length > 160 ||
        !/^[a-z0-9-]+$/.test(tr.slug)
      ) {
        return NextResponse.json(
          {
            error: `Invalid slug for ${locale}. Use lowercase letters, numbers, and hyphens only, max 160 characters.`,
          },
          { status: 400 },
        );
      }
      if (typeof tr.title !== 'string' || tr.title.length < 1 || tr.title.length > 255) {
        return NextResponse.json(
          { error: `Title too long for ${locale}. Maximum 255 characters.` },
          { status: 400 },
        );
      }
      if (typeof tr.summary !== 'string' || tr.summary.length < 1 || tr.summary.length > 600) {
        return NextResponse.json(
          { error: `Summary too long for ${locale}. Maximum 600 characters.` },
          { status: 400 },
        );
      }
    }
  }
  try {
    const updated = await adminBlogService.update(id, body);
    return NextResponse.json({ data: updated });
  } catch (e: unknown) {
    // Provide a cleaner error message
    const message = e instanceof Error ? e.message : 'Update failed';
    const friendly =
      message.includes('value too long') || message.includes('length')
        ? 'One or more fields exceed the allowed length. Title max 255, Summary max 600, Slug max 160.'
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
