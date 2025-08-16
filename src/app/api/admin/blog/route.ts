import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { adminBlogService } from '@/db/services';
import { validateMdxSource } from '@/lib/blog/mdx-validate';

function ensureAdminEmail(email?: string | null) {
  if (!email) return false;
  const allowedDomains = ['@mythoria.pt', '@caravanconcierge.com'];
  return allowedDomains.some(d => email.endsWith(d));
}

export async function GET(req: Request) {
  const session = await auth();
  if (!ensureAdminEmail(session?.user?.email)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const url = new URL(req.url);
  const page = parseInt(url.searchParams.get('page') || '1');
  const limit = parseInt(url.searchParams.get('limit') || '50');
  const status = url.searchParams.get('status') || undefined;
  const locale = url.searchParams.get('locale') || undefined;
  const search = url.searchParams.get('search') || undefined;
  const data = await adminBlogService.list({ page, limit, status, locale, search });
  return NextResponse.json({ data, page, limit });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!ensureAdminEmail(session?.user?.email)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const body = await req.json();
  if (body.translations) {
    for (const tr of body.translations) {
      const result = validateMdxSource(tr.contentMdx || '');
      if (!result.ok) return NextResponse.json({ error: result.reason }, { status: 400 });
    }
  }
  try {
    const created = await adminBlogService.create(body);
    return NextResponse.json({ data: created });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Create failed';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
