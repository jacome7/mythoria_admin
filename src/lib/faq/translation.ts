import { adminService } from '@/db/services';

const STORY_GENERATION_WORKFLOW_URL =
  process.env.STORY_GENERATION_WORKFLOW_URL || 'http://localhost:8080';
const STORY_GENERATION_WORKFLOW_API_KEY = process.env.STORY_GENERATION_WORKFLOW_API_KEY || '';

export const SUPPORTED_FAQ_LOCALES = ['en-US', 'pt-PT', 'es-ES', 'fr-FR', 'de-DE'] as const;

type SupportedFaqLocale = (typeof SUPPORTED_FAQ_LOCALES)[number];

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

export type FaqTranslationResult =
  | {
      outcome: 'not_found';
    }
  | {
      outcome: 'nothing_to_translate';
      sourceEntry: {
        id: string;
        faqKey: string;
        locale: string;
      };
      targetLocales: SupportedFaqLocale[];
      existingLocales: string[];
    }
  | {
      outcome: 'translated';
      requestId?: string;
      sourceEntry: {
        id: string;
        faqKey: string;
        locale: string;
      };
      targetLocales: SupportedFaqLocale[];
      createdEntries: { locale: string; id: string; title: string }[];
      errors?: { locale: string; error: string }[];
    };

export async function translateFaqEntryById(entryId: string, requestedBy: string): Promise<FaqTranslationResult> {
  const sourceEntry = await adminService.getFaqEntryById(entryId);

  if (!sourceEntry) {
    return { outcome: 'not_found' };
  }

  const existingTranslations = await adminService.getFaqEntriesByKey(sourceEntry.faqKey);
  const existingLocales = existingTranslations.map((entry) => entry.locale);

  const targetLocales = SUPPORTED_FAQ_LOCALES.filter((locale) => !existingLocales.includes(locale));

  if (targetLocales.length === 0) {
    return {
      outcome: 'nothing_to_translate',
      sourceEntry: {
        id: sourceEntry.id,
        faqKey: sourceEntry.faqKey,
        locale: sourceEntry.locale,
      },
      targetLocales,
      existingLocales,
    };
  }

  if (!STORY_GENERATION_WORKFLOW_URL || !STORY_GENERATION_WORKFLOW_API_KEY) {
    throw new Error(
      'Story Generation Workflow configuration is missing. Please set STORY_GENERATION_WORKFLOW_URL and STORY_GENERATION_WORKFLOW_API_KEY.',
    );
  }

  const translationRequest = {
    requestId: `faq-${sourceEntry.id}-${Date.now()}`,
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
      requestedBy,
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
    throw new Error('Failed to reach translation service');
  }

  let translationData: SGWTranslationResponse | null = null;
  try {
    translationData = (await translationResponse.json()) as SGWTranslationResponse;
  } catch (error) {
    console.error('Invalid response from translation service:', error);
  }

  if (!translationResponse.ok || translationData?.success === false) {
    console.error('Translation API error:', translationData);
    throw new Error(translationData?.error || 'Translation service failed');
  }

  const translationsMap: Record<string, SGWTranslationEntry> = {};
  if (translationData?.translations) {
    for (const [localeKey, translation] of Object.entries(translationData.translations)) {
      translationsMap[localeKey.toLowerCase()] = translation;
    }
  }

  const createdEntries = [] as { locale: string; id: string; title: string }[];
  const errors = [] as { locale: string; error: string }[];

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
        isPublished: true,
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

  return {
    outcome: 'translated',
    requestId: translationData?.requestId,
    sourceEntry: {
      id: sourceEntry.id,
      faqKey: sourceEntry.faqKey,
      locale: sourceEntry.locale,
    },
    targetLocales,
    createdEntries,
    errors: errors.length > 0 ? errors : undefined,
  };
}
