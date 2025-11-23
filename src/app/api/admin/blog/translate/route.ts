import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { ALLOWED_DOMAINS } from '@/config/auth';
import { z } from 'zod';

const TargetLocaleEnum = z.enum(['pt-PT', 'es-ES', 'fr-FR', 'de-DE']);

const TranslateRequestSchema = z.object({
  blogId: z.string().min(1, 'blogId is required'),
  sourceLocale: z.literal('en-US').default('en-US'),
  targetLocales: z.array(TargetLocaleEnum).min(1, 'Select at least one locale to translate'),
  segments: z.object({
    slug: z.string().min(1).max(160),
    title: z.string().min(1).max(255),
    summary: z.string().max(1000).optional(),
    contentMdx: z.string().min(1),
  }),
});

type TranslateRequest = z.infer<typeof TranslateRequestSchema>;

type SGWTranslationResponse = {
  success?: boolean;
  requestId?: string;
  translations?: Record<
    string,
    {
      slug?: string;
      title?: string;
      summary?: string;
      content?: string;
      contentFormat?: string;
    }
  >;
  notices?: Record<string, string[]>;
  error?: string;
};

function ensureAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  return ALLOWED_DOMAINS.some((domain) => email.endsWith(domain));
}

export async function POST(req: Request) {
  const session = await auth();
  if (!ensureAdminEmail(session?.user?.email)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = TranslateRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid payload', issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const payload = parsed.data as TranslateRequest;

  const workflowUrl = process.env.STORY_GENERATION_WORKFLOW_URL;
  const workflowKey = process.env.STORY_GENERATION_WORKFLOW_API_KEY;

  if (!workflowUrl || !workflowKey) {
    return NextResponse.json(
      {
        error:
          'Story Generation Workflow configuration is missing. Please set STORY_GENERATION_WORKFLOW_URL and STORY_GENERATION_WORKFLOW_API_KEY.',
      },
      { status: 500 },
    );
  }

  const targetLocales = Array.from(new Set(payload.targetLocales));
  if (targetLocales.length === 0) {
    return NextResponse.json(
      { error: 'Select at least one locale to translate.' },
      { status: 400 },
    );
  }

  const upstreamPayload = {
    resourceId: payload.blogId,
    storyTitle: payload.segments.title,
    sourceLocale: payload.sourceLocale,
    targetLocales,
    segments: {
      slug: payload.segments.slug,
      title: payload.segments.title,
      summary: payload.segments.summary,
      content: payload.segments.contentMdx,
      contentFormat: 'mdx',
    },
    metadata: {
      requestedBy: session?.user?.email ?? 'admin-portal',
    },
  };

  let upstreamResponse: Response;
  try {
    upstreamResponse = await fetch(`${workflowUrl}/ai/text/translate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': workflowKey,
      },
      body: JSON.stringify(upstreamPayload),
      cache: 'no-store',
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Failed to reach the translation service',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 502 },
    );
  }

  let upstreamJson: SGWTranslationResponse;
  try {
    upstreamJson = (await upstreamResponse.json()) as SGWTranslationResponse;
  } catch {
    upstreamJson = { success: false, error: 'Invalid response from translation service.' };
  }

  if (!upstreamResponse.ok || upstreamJson.success === false) {
    return NextResponse.json(
      {
        error: upstreamJson.error || 'Translation service rejected the request',
        requestId: upstreamJson.requestId,
      },
      { status: upstreamResponse.status || 502 },
    );
  }

  const normalizedTranslations: Record<
    string,
    { slug: string; title: string; summary: string; contentMdx: string }
  > = {};

  for (const locale of targetLocales) {
    const translation = upstreamJson.translations?.[locale];
    if (!translation) {
      normalizedTranslations[locale] = { slug: '', title: '', summary: '', contentMdx: '' };
      continue;
    }
    normalizedTranslations[locale] = {
      slug: translation.slug ?? '',
      title: translation.title ?? '',
      summary: translation.summary ?? '',
      contentMdx: translation.content ?? '',
    };
  }

  return NextResponse.json({
    success: true,
    data: {
      requestId: upstreamJson.requestId,
      translations: normalizedTranslations,
      notices: upstreamJson.notices ?? {},
    },
  });
}
