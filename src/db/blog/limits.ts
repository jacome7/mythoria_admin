import { sql } from 'drizzle-orm';
import { getMythoriaDb } from '@/db';

export interface BlogTranslationFieldLimits {
  slug?: number | null;
  title?: number | null;
  summary?: number | null;
}

const LIMIT_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes is plenty for schema metadata
let cachedLimits: BlogTranslationFieldLimits | null = null;
let lastFetched = 0;

const DEFAULT_LIMITS = {
  slug: 160,
  title: 255,
  summary: 1000,
} as const;

async function fetchLimitsFromDatabase(): Promise<BlogTranslationFieldLimits> {
  try {
    const db = getMythoriaDb();
    const result = await db.execute(
      sql`SELECT column_name, character_maximum_length FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'blog_post_translations' AND column_name IN ('slug','title','summary')`,
    );
    const limits: BlogTranslationFieldLimits = {};
    for (const row of result.rows as Array<{
      column_name: string;
      character_maximum_length: number | null;
    }>) {
      if (row.column_name === 'slug') limits.slug = row.character_maximum_length;
      if (row.column_name === 'title') limits.title = row.character_maximum_length;
      if (row.column_name === 'summary') limits.summary = row.character_maximum_length;
    }
    return limits;
  } catch (error) {
    console.error(
      'Failed to load blog translation limits from information_schema; falling back to defaults.',
      error,
    );
    return {};
  }
}

export async function getBlogTranslationFieldLimits(): Promise<BlogTranslationFieldLimits> {
  const now = Date.now();
  if (cachedLimits && now - lastFetched < LIMIT_CACHE_TTL_MS) {
    return cachedLimits;
  }
  const fresh = await fetchLimitsFromDatabase();
  cachedLimits = fresh;
  lastFetched = now;
  return fresh;
}

export type ResolvedBlogTranslationFieldLimits = Record<'slug' | 'title' | 'summary', number>;

export function resolveBlogFieldLimits(
  limits?: BlogTranslationFieldLimits,
): ResolvedBlogTranslationFieldLimits {
  return {
    slug: (limits?.slug ?? DEFAULT_LIMITS.slug) || DEFAULT_LIMITS.slug,
    title: (limits?.title ?? DEFAULT_LIMITS.title) || DEFAULT_LIMITS.title,
    summary: (limits?.summary ?? DEFAULT_LIMITS.summary) || DEFAULT_LIMITS.summary,
  };
}
