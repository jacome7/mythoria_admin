import { getMythoriaDb } from '../index';
import { blogPosts, blogPostTranslations } from '../schema/blog/blog';
import { and, asc, desc, eq } from 'drizzle-orm';

export const ADMIN_BLOG_LOCALES = ['en-US', 'pt-PT', 'es-ES', 'fr-FR'] as const;
export type AdminBlogLocale = typeof ADMIN_BLOG_LOCALES[number];

export interface AdminCreatePostInput {
  slugBase: string;
  heroImageUrl?: string | null;
  translations?: Array<AdminTranslationInput>;
}

export interface AdminTranslationInput {
  locale: AdminBlogLocale;
  slug: string;
  title: string;
  summary: string;
  contentMdx: string;
}

export interface AdminUpdatePostInput {
  heroImageUrl?: string | null;
  // Optional status & publishedAt when saving from the editor
  status?: 'draft' | 'published' | 'archived';
  publishedAt?: Date | null;
  translations: Array<AdminTranslationInput>; // replace/upsert all provided locales
}

function isValidSlug(str: string) {
  return /^[a-z0-9-]+$/.test(str);
}

export const adminBlogService = {
  async list(options: { page?: number; limit?: number; status?: string; locale?: string; search?: string } = {}) {
    const db = getMythoriaDb();
    const page = options.page ?? 1;
    const limit = options.limit ?? 50;
    const offset = (page - 1) * limit;
    const statusFilter = options.status;
    const localeFilter = options.locale as AdminBlogLocale | undefined;
    const search = options.search?.toLowerCase();

    const rows = await db.select({
      id: blogPosts.id,
      slugBase: blogPosts.slugBase,
      status: blogPosts.status,
      publishedAt: blogPosts.publishedAt,
      heroImageUrl: blogPosts.heroImageUrl,
      translationId: blogPostTranslations.id,
      locale: blogPostTranslations.locale,
      slug: blogPostTranslations.slug,
      title: blogPostTranslations.title,
      summary: blogPostTranslations.summary,
    }).from(blogPosts)
      .leftJoin(blogPostTranslations, eq(blogPostTranslations.postId, blogPosts.id))
      .orderBy(desc(blogPosts.createdAt))
      .limit(limit)
      .offset(offset);

    // Group by post id
  interface TransRow { locale: string; slug: string; title: string; summary: string; }
  interface ListRow { id: string; slugBase: string; status: 'draft' | 'published' | 'archived'; publishedAt: Date | null; heroImageUrl: string | null; translations: TransRow[] }
  const map: Record<string, ListRow> = {};
    for (const r of rows) {
      if (!map[r.id]) {
    map[r.id] = { id: r.id, slugBase: r.slugBase, status: r.status, publishedAt: r.publishedAt, heroImageUrl: r.heroImageUrl, translations: [] };
      }
      if (r.translationId) {
  // translationId implies all translation columns are present (left join)
  map[r.id].translations.push({ locale: r.locale!, slug: r.slug!, title: r.title!, summary: r.summary! });
      }
    }
  let list: ListRow[] = Object.values(map);
  if (statusFilter) list = list.filter(p => p.status === statusFilter);
  if (localeFilter) list = list.filter(p => p.translations.some(t => t.locale === localeFilter));
  if (search) list = list.filter(p => p.slugBase.includes(search) || p.translations.some(t => t.title?.toLowerCase().includes(search)));
    return list;
  },

  async create(input: AdminCreatePostInput) {
    const db = getMythoriaDb();
    if (!isValidSlug(input.slugBase)) throw new Error('Invalid slug_base format');
    const [post] = await db.insert(blogPosts).values({ slugBase: input.slugBase, heroImageUrl: input.heroImageUrl ?? null }).returning();
    if (input.translations?.length) {
      for (const tr of input.translations) {
        await this.upsertTranslation(post.id, tr);
      }
    }
    return this.getById(post.id);
  },

  async getById(id: string) {
    const db = getMythoriaDb();
    const [post] = await db.select().from(blogPosts).where(eq(blogPosts.id, id));
    if (!post) return null;
    const translations = await db.select().from(blogPostTranslations).where(eq(blogPostTranslations.postId, id)).orderBy(asc(blogPostTranslations.locale));
    return { post, translations };
  },

  async upsertTranslation(postId: string, tr: AdminTranslationInput) {
    const db = getMythoriaDb();
    if (!isValidSlug(tr.slug)) throw new Error('Invalid slug');
    const [existing] = await db.select({ id: blogPostTranslations.id }).from(blogPostTranslations)
      .where(and(eq(blogPostTranslations.postId, postId), eq(blogPostTranslations.locale, tr.locale)));
    if (existing) {
      await db.update(blogPostTranslations).set({
        slug: tr.slug,
        title: tr.title,
        summary: tr.summary,
        contentMdx: tr.contentMdx,
        updatedAt: new Date(),
      }).where(eq(blogPostTranslations.id, existing.id));
    } else {
      await db.insert(blogPostTranslations).values({
        postId,
        locale: tr.locale,
        slug: tr.slug,
        title: tr.title,
        summary: tr.summary,
        contentMdx: tr.contentMdx,
      });
    }
  },

  async update(id: string, input: AdminUpdatePostInput) {
    const db = getMythoriaDb();
    // Build partial update for top-level post fields
    const postUpdate: Partial<typeof blogPosts.$inferInsert> = {
      heroImageUrl: input.heroImageUrl ?? null,
      updatedAt: new Date(),
    };
    if (typeof input.status === 'string') {
      postUpdate.status = input.status as unknown as typeof blogPosts.$inferInsert.status;
    }
    if (input.publishedAt !== undefined) {
      // Allow explicitly setting null to clear publish date
  const v = input.publishedAt as unknown as (string | Date | null);
  postUpdate.publishedAt = (v ? new Date(v as string | Date) : null) as unknown as typeof blogPosts.$inferInsert.publishedAt;
    }
    await db.update(blogPosts).set(postUpdate).where(eq(blogPosts.id, id));
    for (const tr of input.translations) {
      await this.upsertTranslation(id, tr);
    }
    return this.getById(id);
  },

  async publish(id: string) {
    const db = getMythoriaDb();
    const [updated] = await db.update(blogPosts).set({ status: 'published', publishedAt: new Date(), updatedAt: new Date() }).where(eq(blogPosts.id, id)).returning();
    return updated;
  },

  async archive(id: string) {
    const db = getMythoriaDb();
    const [updated] = await db.update(blogPosts).set({ status: 'archived', updatedAt: new Date() }).where(eq(blogPosts.id, id)).returning();
    return updated;
  },

  async delete(id: string) {
    const db = getMythoriaDb();
    await db.delete(blogPosts).where(eq(blogPosts.id, id));
  },
};
