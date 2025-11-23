import {
  ADMIN_BLOG_LOCALES,
  type AdminBlogLocale,
  type AdminTranslationInput,
} from '@/db/services/blog';
import type { BlogTranslationFieldLimits } from '@/db/blog/limits';
import { resolveBlogFieldLimits } from '@/db/blog/limits';

const SLUG_REGEX = /^[a-z0-9-]+$/;

interface RawTranslation {
  locale: string;
  slug: string;
  title: string;
  summary: string;
  contentMdx: string;
}

export interface NormalizeTranslationsResult {
  translations: AdminTranslationInput[];
  warnings: string[];
}

function assertLocale(locale: string): locale is AdminBlogLocale {
  return ADMIN_BLOG_LOCALES.includes(locale as AdminBlogLocale);
}

export function normalizeAdminTranslations(
  rawTranslations: RawTranslation[] = [],
  limits?: BlogTranslationFieldLimits,
): NormalizeTranslationsResult {
  const resolvedLimits = resolveBlogFieldLimits(limits);
  const warnings: string[] = [];
  const normalized: AdminTranslationInput[] = [];

  for (const candidate of rawTranslations) {
    if (!candidate || typeof candidate !== 'object') {
      throw new Error('Invalid translation payload.');
    }

    const locale = (candidate.locale || '').trim();
    if (!assertLocale(locale)) {
      throw new Error(`Unsupported locale: ${candidate.locale ?? 'undefined'}`);
    }

    const slug = (candidate.slug || '').trim();
    if (!slug) {
      throw new Error(`Slug is required for ${locale}.`);
    }
    if (!SLUG_REGEX.test(slug)) {
      throw new Error(
        `Invalid slug for ${locale}. Use lowercase letters, numbers, and hyphens only.`,
      );
    }
    if (slug.length > resolvedLimits.slug) {
      throw new Error(`Slug for ${locale} exceeds ${resolvedLimits.slug} characters.`);
    }

    const title = (candidate.title || '').trim();
    if (!title) {
      throw new Error(`Title is required for ${locale}.`);
    }
    if (title.length > resolvedLimits.title) {
      throw new Error(`Title for ${locale} exceeds ${resolvedLimits.title} characters.`);
    }

    let summary = (candidate.summary || '').trim();
    if (!summary) {
      throw new Error(`Summary is required for ${locale}.`);
    }
    if (resolvedLimits.summary && summary.length > resolvedLimits.summary) {
      warnings.push(
        `Summary for ${locale} exceeded ${resolvedLimits.summary} characters and was truncated.`,
      );
      summary = summary.slice(0, resolvedLimits.summary);
    }

    const contentMdx = candidate.contentMdx ?? '';

    normalized.push({
      locale,
      slug,
      title,
      summary,
      contentMdx,
    });
  }

  return { translations: normalized, warnings };
}
