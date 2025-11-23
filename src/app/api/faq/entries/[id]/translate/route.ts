import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { adminService } from '@/db/services';
import { ALLOWED_DOMAINS } from '@/config/auth';

const STORY_GENERATION_WORKFLOW_URL =
  process.env.STORY_GENERATION_WORKFLOW_URL || 'http://localhost:8080';
const STORY_GENERATION_WORKFLOW_API_KEY = process.env.STORY_GENERATION_WORKFLOW_API_KEY || '';

const SUPPORTED_LOCALES = ['en-US', 'pt-PT', 'es-ES', 'fr-FR', 'de-DE'] as const;

type SGWTranslationResponse = {
  success?: boolean;
  requestId?: string;
  translations?: Record<
    string,
    {
      title?: string;
      content?: string;
      contentFormat?: string;
    }
  >;
  notices?: Record<string, string[]>;
  error?: string;
};

type SGWTranslationEntry = NonNullable<SGWTranslationResponse['translations']>[string];

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

    // Get the source FAQ entry
    const sourceEntry = await adminService.getFaqEntryById(resolvedParams.id);

    if (!sourceEntry) {
      return NextResponse.json({ error: 'FAQ entry not found' }, { status: 404 });
    }

    // Get all existing translations for this FAQ key
    const existingTranslations = await adminService.getFaqEntriesByKey(sourceEntry.faqKey);
    const existingLocales = existingTranslations.map((e) => e.locale);

    // Determine target locales (all supported locales except those already translated)
    const targetLocales = SUPPORTED_LOCALES.filter((locale) => !existingLocales.includes(locale));

    if (targetLocales.length === 0) {
      return NextResponse.json({
        message: 'All locales already have translations',
        existingLocales,
      });
    }

    if (!STORY_GENERATION_WORKFLOW_URL || !STORY_GENERATION_WORKFLOW_API_KEY) {
      return NextResponse.json(
        {
          error:
            'Story Generation Workflow configuration is missing. Please set STORY_GENERATION_WORKFLOW_URL and STORY_GENERATION_WORKFLOW_API_KEY.',
        },
        { status: 500 },
      );
    }

    // Call the story-generation-workflow translation API
    const translationRequest = {
      requestId: `faq-${sourceEntry.id}`,
      resourceId: sourceEntry.faqKey,
      storyTitle: sourceEntry.title,
      sourceLocale: sourceEntry.locale,
      targetLocales,
      segments: {
        title: sourceEntry.title,
        content: sourceEntry.contentMdx,
        contentFormat: 'mdx',
      },
      metadata: {
        requestedBy: session.user.email,
        notes: `FAQ translation for section: ${sourceEntry.section?.defaultLabel || 'Unknown'}`,
      },
    };

    let translationResponse: Response;
    try {
      translationResponse = await fetch(`${STORY_GENERATION_WORKFLOW_URL}/ai/text/translate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': STORY_GENERATION_WORKFLOW_API_KEY,
        },
        body: JSON.stringify(translationRequest),
        cache: 'no-store',
      });
    } catch (error) {
      console.error('Failed to reach translation service:', error);
      return NextResponse.json(
        {
          error: 'Failed to reach translation service',
          details: error instanceof Error ? error.message : 'Unknown network error',
        },
        { status: 502 },
      );
    }

    let translationData: SGWTranslationResponse | null = null;
    try {
      translationData = (await translationResponse.json()) as SGWTranslationResponse;
    } catch (error) {
      console.error('Invalid response from translation service:', error);
    }

    if (!translationResponse.ok || translationData?.success === false) {
      console.error('Translation API error:', translationData);
      return NextResponse.json(
        {
          error: translationData?.error || 'Translation service failed',
          requestId: translationData?.requestId,
        },
        { status: translationResponse.status || 500 },
      );
    }

    const translationsMap: Record<string, SGWTranslationEntry> = {};
    if (translationData?.translations) {
      for (const [localeKey, translation] of Object.entries(translationData.translations)) {
        translationsMap[localeKey.toLowerCase()] = translation;
      }
    }

    // Create FAQ entries for each translated locale
    const createdEntries = [];
    const errors = [];

    for (const locale of targetLocales) {
      const normalizedLocale = locale.toLowerCase();
      const translation = translationsMap[normalizedLocale];

      if (!translation || !translation.title || !translation.content) {
        errors.push({
          locale,
          error: 'Translation incomplete or missing',
        });
        continue;
      }

      try {
        const newEntry = await adminService.createFaqEntry({
          sectionId: sourceEntry.sectionId,
          faqKey: sourceEntry.faqKey,
          locale,
          title: translation.title,
          contentMdx: translation.content,
          questionSortOrder: sourceEntry.questionSortOrder,
          isPublished: false, // Default to unpublished for review
        });

        createdEntries.push({
          locale,
          id: newEntry.id,
          title: newEntry.title,
        });
      } catch (error) {
        errors.push({
          locale,
          error: error instanceof Error ? error.message : 'Failed to create FAQ entry',
        });
      }
    }

    return NextResponse.json({
      success: true,
      sourceEntry: {
        id: sourceEntry.id,
        faqKey: sourceEntry.faqKey,
        locale: sourceEntry.locale,
      },
      created: createdEntries,
      errors: errors.length > 0 ? errors : undefined,
      message: `Successfully created ${createdEntries.length} translations${errors.length > 0 ? ` with ${errors.length} errors` : ''}`,
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
