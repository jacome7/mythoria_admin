import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { validateMdxSource } from '@/lib/blog/mdx-validate';
import remarkGfm from 'remark-gfm';
import rehypeSlug from 'rehype-slug';
import rehypeAutolinkHeadings from 'rehype-autolink-headings';
import rehypePrettyCode from 'rehype-pretty-code';
import { VFile } from 'vfile';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import rehypeStringify from 'rehype-stringify';
import { ALLOWED_DOMAINS } from '@/config/auth';

function ensureAdminEmail(email?: string | null) {
  if (!email) return false;
  return ALLOWED_DOMAINS.some((d) => email.endsWith(d));
}

export async function POST(req: Request) {
  const session = await auth();
  if (!ensureAdminEmail(session?.user?.email)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { contentMdx } = await req.json();
  const validation = validateMdxSource(contentMdx || '');
  if (!validation.ok) return NextResponse.json({ error: validation.reason }, { status: 400 });
  try {
    // Simpler: treat as Markdown + limited MDX (we already block import/export) and produce HTML via remark+rehype.
    const file = await unified()
      .use(remarkParse)
      .use(remarkGfm)
      // NOTE: We skip actual MDX component evaluation for simplicity.
      .use(remarkRehype)
      .use(rehypeSlug)
      .use(rehypeAutolinkHeadings, { behavior: 'wrap' })
      .use(rehypePrettyCode, { theme: 'github-dark' })
      .use(rehypeStringify)
      .process(new VFile({ value: contentMdx }));
    const html = String(file.value);
    return new NextResponse(html, { headers: { 'Content-Type': 'text/html' } });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Compile failed';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
