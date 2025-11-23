'use client';
import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAdminAuth } from '@/lib/hooks/useAdminAuth';

const LOCALES = ['en-US', 'pt-PT', 'es-ES', 'fr-FR', 'de-DE'];
const TARGET_TRANSLATION_LOCALES = LOCALES.filter((locale) => locale !== 'en-US');

interface TranslationState {
  locale: string;
  slug: string;
  title: string;
  summary: string;
  contentMdx: string;
}

interface BlogFieldLimits {
  slug: number;
  title: number;
  summary: number;
}

const DEFAULT_FIELD_LIMITS: BlogFieldLimits = {
  slug: 160,
  title: 255,
  summary: 1000,
};

export default function EditBlogPostPage() {
  const { session, loading } = useAdminAuth();
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;

  const [heroImageUrl, setHeroImageUrl] = useState('');
  const [status_, setStatus] = useState('draft');
  const [publishedAt, setPublishedAt] = useState<string | null>(null);
  const [translations, setTranslations] = useState<Record<string, TranslationState>>({});
  const [activeLocale, setActiveLocale] = useState('en-US');
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [isTranslating, setIsTranslating] = useState(false);
  const [translateModalOpen, setTranslateModalOpen] = useState(false);
  const [selectedLocales, setSelectedLocales] = useState<string[]>(() => [
    ...TARGET_TRANSLATION_LOCALES,
  ]);
  const [statusMessage, setStatusMessage] = useState('');
  const [translateNotices, setTranslateNotices] = useState<Record<string, string[]>>({});
  const [translateFormError, setTranslateFormError] = useState('');
  const [fieldLimits, setFieldLimits] = useState<BlogFieldLimits>(DEFAULT_FIELD_LIMITS);

  const loadBlogPost = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await fetch(`/api/admin/blog/${id}`);

      if (res.ok) {
        const json = await res.json();
        const { post, translations: trs } = json.data;

        setHeroImageUrl(post.heroImageUrl || '');
        setStatus(post.status);
        setPublishedAt(post.publishedAt);
        if (json.fieldLimits) {
          setFieldLimits({
            slug: json.fieldLimits.slug || DEFAULT_FIELD_LIMITS.slug,
            title: json.fieldLimits.title || DEFAULT_FIELD_LIMITS.title,
            summary: json.fieldLimits.summary || DEFAULT_FIELD_LIMITS.summary,
          });
        } else {
          setFieldLimits(DEFAULT_FIELD_LIMITS);
        }

        const map: Record<string, TranslationState> = {};
        trs.forEach((t: Record<string, string>) => {
          map[t.locale] = {
            locale: t.locale,
            slug: t.slug,
            title: t.title,
            summary: t.summary,
            contentMdx: t.contentMdx,
          };
        });

        // Initialize empty translations for missing locales
        LOCALES.forEach((l) => {
          if (!map[l]) {
            map[l] = {
              locale: l,
              slug: '',
              title: '',
              summary: '',
              contentMdx: '',
            };
          }
        });

        setTranslations(map);
        setStatusMessage('');
        setTranslateNotices({});
        setTranslateModalOpen(false);
        setTranslateFormError('');
        setSelectedLocales([...TARGET_TRANSLATION_LOCALES]);
      } else if (res.status === 404) {
        setError('Blog post not found');
      } else {
        setError('Failed to load blog post');
      }
    } catch {
      setError('Network error loading blog post');
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  // Helper: find locales that have content/summary but missing slug or title
  const getLocalesMissingSlugOrTitle = () => {
    const missing: string[] = [];
    Object.values(translations).forEach((t) => {
      const hasContent =
        (t.summary && t.summary.trim().length > 0) ||
        (t.contentMdx && t.contentMdx.trim().length > 0);
      const missingRequired = !t.slug?.trim() || !t.title?.trim();
      if (hasContent && missingRequired) {
        missing.push(t.locale);
      }
    });
    return missing;
  };

  // Authentication check
  useEffect(() => {
    if (!loading && session?.user) {
      loadBlogPost();
    }
  }, [loading, session, loadBlogPost]);

  function updateField(locale: string, field: keyof TranslationState, value: string) {
    setTranslations((prev) => ({
      ...prev,
      [locale]: { ...prev[locale], [field]: value },
    }));
  }

  function generateSummary(content: string): string {
    // Strip basic markdown syntax for a crude plaintext summary
    const plain = content
      .replace(/`{3}[\s\S]*?`{3}/g, ' ') // code blocks
      .replace(/`[^`]*`/g, ' ') // inline code
      .replace(/<!--.*?-->/g, ' ') // comments
      .replace(/\!\[[^\]]*\]\([^)]*\)/g, ' ') // images
      .replace(/\[[^\]]*\]\([^)]*\)/g, ' ') // links text
      .replace(/[#>*_~`-]+/g, ' ') // md tokens
      .replace(/\s+/g, ' ') // collapse
      .trim();
    return plain.slice(0, 300);
  }

  function toggleLocale(locale: string) {
    setSelectedLocales((prev) =>
      prev.includes(locale) ? prev.filter((entry) => entry !== locale) : [...prev, locale],
    );
  }

  function openTranslateModal() {
    setTranslateFormError('');
    setTranslateModalOpen(true);
  }

  function closeTranslateModal() {
    if (isTranslating) return;
    setTranslateModalOpen(false);
    setTranslateFormError('');
  }

  const enTranslation = translations['en-US'];
  const canTriggerTranslation = Boolean(
    enTranslation?.slug?.trim() &&
      enTranslation?.title?.trim() &&
      enTranslation?.contentMdx?.trim(),
  );

  async function handleTranslateConfirm() {
    setTranslateFormError('');
    setError('');
    setStatusMessage('');

    if (selectedLocales.length === 0) {
      setTranslateFormError('Select at least one locale to translate.');
      return;
    }

    const source = translations['en-US'];
    if (!source || !source.slug?.trim() || !source.title?.trim() || !source.contentMdx?.trim()) {
      setTranslateFormError('Slug, title, and content are required before translating.');
      return;
    }

    setIsTranslating(true);
    try {
      const response = await fetch('/api/admin/blog/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          blogId: id,
          targetLocales: selectedLocales,
          segments: {
            slug: source.slug.trim(),
            title: source.title.trim(),
            summary: source.summary?.trim() || undefined,
            contentMdx: source.contentMdx,
          },
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        const message = result?.error || 'Translation failed';
        setTranslateFormError(message);
        setError(message);
        return;
      }

      const translatedLocales: Record<string, Partial<TranslationState>> = result?.data
        ?.translations || {};
      setTranslations((prev) => {
        const next = { ...prev };
        Object.entries(translatedLocales).forEach(([locale, translated]) => {
          const current = next[locale] || {
            locale,
            slug: '',
            title: '',
            summary: '',
            contentMdx: '',
          };
          next[locale] = {
            ...current,
            slug: translated.slug ?? current.slug,
            title: translated.title ?? current.title,
            summary: translated.summary ?? current.summary,
            contentMdx: translated.contentMdx ?? current.contentMdx,
          };
        });
        return next;
      });

      setTranslateNotices(result?.data?.notices || {});
      const localesList = Object.keys(translatedLocales);
      setStatusMessage(
        localesList.length > 0
          ? `Translated locales: ${localesList.join(', ')}`
          : 'Translation completed but no locales reported changes.',
      );
      setTranslateModalOpen(false);
      setTranslateFormError('');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Translation request failed';
      setTranslateFormError(message);
      setError(message);
    } finally {
      setIsTranslating(false);
    }
  }

  // Core save method; accepts optional overrides so publish can reuse it
  async function save(overrides?: {
    forceStatus?: 'draft' | 'published' | 'archived';
    forcePublishedAt?: string | null;
  }) {
    setError('');
    // Validate mandatory fields before saving
    const missingLocales = getLocalesMissingSlugOrTitle();
    if (missingLocales.length > 0) {
      setError(`Slug and Title are required for: ${missingLocales.join(', ')}`);
      return;
    }
    setSaving(true);

    try {
      const prepared = Object.values(translations)
        .filter((t) => t.slug && t.title && t.contentMdx) // allow empty summary, will generate
        .map((t) => ({
          ...t,
          summary:
            t.summary && t.summary.trim().length > 0
              ? t.summary.trim()
              : generateSummary(t.contentMdx || '') || t.title.slice(0, 160), // fallback to title
        }))
        .filter((t) => t.summary && t.summary.length > 0); // DB requires non-empty

      const body = {
        heroImageUrl: heroImageUrl || null,
        status: overrides?.forceStatus ?? status_,
        publishedAt: overrides?.forcePublishedAt ?? publishedAt,
        translations: prepared,
      };

      const res = await fetch(`/api/admin/blog/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errorData = await res.json();
        setError(errorData.error || 'Save failed');
      } else {
        // Update local state with the response to ensure consistency
        const responseData = await res.json();
        if (responseData.data) {
          setStatus(responseData.data.post?.status ?? responseData.data.status);
          setPublishedAt(responseData.data.post?.publishedAt ?? responseData.data.publishedAt);
        }
        if (responseData.fieldLimits) {
          setFieldLimits({
            slug: responseData.fieldLimits.slug || DEFAULT_FIELD_LIMITS.slug,
            title: responseData.fieldLimits.title || DEFAULT_FIELD_LIMITS.title,
            summary: responseData.fieldLimits.summary || DEFAULT_FIELD_LIMITS.summary,
          });
        }
        if (responseData.warnings?.length) {
          setStatusMessage(responseData.warnings.join(' '));
        } else {
          setStatusMessage('');
          // Redirect to listings after successful save with no warnings
          router.push('/blog');
        }
      }
    } catch {
      setError('Network error during save');
    } finally {
      setSaving(false);
    }
  }

  // Helper that forces publish while saving all editable fields (including hero image & translations)
  async function saveAndPublish() {
    // Force local state to published so UI badges reflect immediately
    if (status_ !== 'published') setStatus('published');
    if (!publishedAt) setPublishedAt(new Date().toISOString());
    await save({
      forceStatus: 'published',
      forcePublishedAt: publishedAt ?? new Date().toISOString(),
    });
  }

  async function preview() {
    const tr = translations[activeLocale];
    if (!tr.contentMdx) {
      setPreviewHtml('<p>No content to preview</p>');
      return;
    }

    try {
      const res = await fetch('/api/admin/blog/mdx/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contentMdx: tr.contentMdx }),
      });

      if (res.ok) {
        const html = await res.text();
        setPreviewHtml(html);
      } else {
        setPreviewHtml('<p>Preview failed</p>');
      }
    } catch {
      setPreviewHtml('<p>Preview error</p>');
    }
  }

  // Show loading state while checking authentication
  if (loading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="loading loading-spinner loading-lg"></div>
      </div>
    );
  }

  // Don't render content if not authorized
  if (!session?.user) {
    return null;
  }

  if (error && isLoading) {
    return (
      <div className="min-h-screen flex flex-col">
        <main className="flex-1 container mx-auto px-4 py-8">
          <div className="max-w-2xl mx-auto">
            <div className="alert alert-error">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <span>{error}</span>
            </div>
            <div className="mt-4">
              <Link href="/blog" className="btn btn-outline">
                Back to Blog List
              </Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <main className="flex-1 container mx-auto px-4 py-8">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/blog" className="btn btn-ghost btn-sm">
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
                Back to Blog List
              </Link>
              <h1 className="text-3xl font-bold">Edit Blog Post</h1>
            </div>
            <div className="flex gap-2">
              <button
                className="btn btn-outline"
                onClick={() => {
                  if (!saving) save();
                }}
                disabled={saving}
              >
                {saving ? (
                  <>
                    <span className="loading loading-spinner loading-sm"></span>
                    Saving...
                  </>
                ) : (
                  <>
                    <svg
                      className="w-4 h-4 mr-2"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 0V4a2 2 0 00-2-2H9a2 2 0 00-2 2v3m1 0h4"
                      />
                    </svg>
                    Save Changes
                  </>
                )}
              </button>
              <button
                className="btn btn-primary"
                onClick={() => {
                  if (!saving) saveAndPublish();
                }}
                disabled={saving}
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                  />
                </svg>
                {status_ === 'published' ? 'Update & Keep Published' : 'Publish Now'}
              </button>
            </div>
          </div>

          {error && (
            <div className="alert alert-error">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <span>{error}</span>
            </div>
          )}

          {statusMessage && (
            <div className="alert alert-info">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 16h-1v-4h-1m1-4h.01M12 20a8 8 0 100-16 8 8 0 000 16z"
                />
              </svg>
              <span>{statusMessage}</span>
            </div>
          )}

          {Object.keys(translateNotices).length > 0 && (
            <div className="alert alert-warning">
              <div>
                <p className="font-semibold">Translation notices</p>
                <ul className="list-disc ml-4 text-sm">
                  {Object.entries(translateNotices).map(([locale, notices]) =>
                    notices.map((notice, idx) => (
                      <li key={`${locale}-${idx}`}>
                        <span className="font-medium">{locale}:</span> {notice}
                      </li>
                    )),
                  )}
                </ul>
              </div>
            </div>
          )}

          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2 space-y-6">
              <div className="card bg-base-100 shadow-md">
                <div className="card-body">
                  <div className="tabs tabs-bordered">
                    {LOCALES.map((locale) => (
                      <a
                        key={locale}
                        className={`tab ${activeLocale === locale ? 'tab-active' : ''}`}
                        onClick={() => setActiveLocale(locale)}
                      >
                        {locale}
                      </a>
                    ))}
                  </div>

                  <LocaleEditor
                    tr={translations[activeLocale]}
                    update={(field, value) => updateField(activeLocale, field, value)}
                    onPreview={preview}
                    previewHtml={previewHtml}
                    onTranslate={openTranslateModal}
                    canTranslate={canTriggerTranslation}
                    isTranslating={isTranslating}
                    fieldLimits={fieldLimits}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="card bg-base-100 shadow-md">
                <div className="card-body">
                  <h3 className="card-title">Post Settings</h3>

                  <div>
                    <label className="label">
                      <span className="label-text font-medium">Hero Image URL</span>
                    </label>
                    <input
                      className="input input-bordered w-full"
                      value={heroImageUrl}
                      onChange={(e) => setHeroImageUrl(e.target.value)}
                      placeholder="https://example.com/image.jpg"
                    />
                  </div>

                  <div>
                    <label className="label">
                      <span className="label-text font-medium">Status</span>
                    </label>
                    <select
                      className="select select-bordered w-full"
                      value={status_}
                      onChange={(e) => setStatus(e.target.value)}
                    >
                      <option value="draft">Draft</option>
                      <option value="published">Published</option>
                      <option value="archived">Archived</option>
                    </select>
                  </div>

                  <div>
                    <label className="label">
                      <span className="label-text font-medium">Publish Date</span>
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="datetime-local"
                        className="input input-bordered flex-1"
                        value={publishedAt ? new Date(publishedAt).toISOString().slice(0, 16) : ''}
                        onChange={(e) =>
                          setPublishedAt(
                            e.target.value ? new Date(e.target.value).toISOString() : null,
                          )
                        }
                      />
                      <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        onClick={() => setPublishedAt(new Date().toISOString())}
                        title="Set to current date and time"
                      >
                        Now
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => setPublishedAt(null)}
                        title="Clear publish date"
                      >
                        Clear
                      </button>
                    </div>
                    <div className="label">
                      <span className="label-text-alt">Leave empty for unpublished posts</span>
                    </div>
                  </div>

                  <div className="divider"></div>

                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="font-medium">Current Status:</span>
                      <span
                        className={`badge ${
                          status_ === 'published'
                            ? 'badge-success'
                            : status_ === 'draft'
                              ? 'badge-warning'
                              : 'badge-neutral'
                        }`}
                      >
                        {status_}
                      </span>
                    </div>

                    <div className="flex justify-between">
                      <span className="font-medium">Will be published:</span>
                      <span className="text-sm">
                        {publishedAt ? new Date(publishedAt).toLocaleString() : 'Not set'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="card bg-base-200">
                <div className="card-body">
                  <h3 className="card-title text-lg">Translation Status</h3>
                  <div className="space-y-2">
                    {LOCALES.map((locale) => {
                      const tr = translations[locale];
                      const isComplete = tr && tr.slug && tr.title && tr.contentMdx; // summary now optional (auto-generated)
                      return (
                        <div key={locale} className="flex justify-between items-center">
                          <span className="text-sm">{locale}</span>
                          <span
                            className={`badge badge-sm ${isComplete ? 'badge-success' : 'badge-warning'}`}
                          >
                            {isComplete ? 'Complete' : 'Incomplete'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
      {translateModalOpen && (
        <div className="modal modal-open">
          <div className="modal-box space-y-4">
            <h3 className="text-lg font-bold">Translate blog content</h3>
            <p className="text-sm text-base-content/70">
              Selected locales will be overwritten with a fresh translation generated from the en-US
              version.
            </p>
            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {TARGET_TRANSLATION_LOCALES.map((locale) => (
                <label key={locale} className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    className="checkbox checkbox-primary checkbox-sm mt-1"
                    checked={selectedLocales.includes(locale)}
                    onChange={() => toggleLocale(locale)}
                    disabled={isTranslating}
                  />
                  <span>
                    <span className="font-medium">{locale}</span>
                    <span className="block text-xs text-base-content/60">
                      {translations[locale]?.contentMdx
                        ? 'Existing content will be replaced.'
                        : 'Currently empty; translation will populate this locale.'}
                    </span>
                  </span>
                </label>
              ))}
            </div>
            {translateFormError && <p className="text-error text-sm">{translateFormError}</p>}
            <div className="modal-action">
              <button
                className="btn btn-ghost"
                onClick={closeTranslateModal}
                disabled={isTranslating}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleTranslateConfirm}
                disabled={isTranslating || selectedLocales.length === 0}
              >
                {isTranslating && <span className="loading loading-spinner loading-sm mr-2"></span>}
                Replace locales
              </button>
            </div>
          </div>
          <div className="modal-backdrop" onClick={closeTranslateModal}></div>
        </div>
      )}
    </div>
  );
}

function LocaleEditor({
  tr,
  update,
  onPreview,
  previewHtml,
  onTranslate,
  canTranslate = false,
  isTranslating = false,
  fieldLimits,
}: {
  tr: TranslationState;
  update: (field: keyof TranslationState, value: string) => void;
  onPreview: () => void;
  previewHtml: string | null;
  onTranslate?: () => void;
  canTranslate?: boolean;
  isTranslating?: boolean;
  fieldLimits: BlogFieldLimits;
}) {
  const slugLimit = fieldLimits?.slug ?? DEFAULT_FIELD_LIMITS.slug;
  const titleLimit = fieldLimits?.title ?? DEFAULT_FIELD_LIMITS.title;
  const summaryLimit = fieldLimits?.summary ?? DEFAULT_FIELD_LIMITS.summary;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="label">
            <span className="label-text font-medium">
              Slug <span className="text-error">(required with content)</span>
            </span>
          </label>
          {(() => {
            const hasContent =
              (tr.summary?.trim()?.length ?? 0) > 0 || (tr.contentMdx?.trim()?.length ?? 0) > 0;
            const missingSlug = !tr.slug?.trim();
            return (
              <>
                <input
                  className={`input input-bordered w-full ${hasContent && missingSlug ? 'input-error' : ''}`}
                  value={tr.slug}
                  onChange={(e) => update('slug', e.target.value)}
                  maxLength={slugLimit}
                  pattern="[a-z0-9-]+"
                  placeholder="blog-post-slug"
                />
                {hasContent && missingSlug && (
                  <label className="label">
                    <span className="label-text-alt text-error">
                      Slug is required when Summary or Content is filled
                    </span>
                  </label>
                )}
              </>
            );
          })()}
        </div>
        <div>
          <label className="label">
            <span className="label-text font-medium">
              Title <span className="text-error">(required with content)</span>
            </span>
          </label>
          {(() => {
            const hasContent =
              (tr.summary?.trim()?.length ?? 0) > 0 || (tr.contentMdx?.trim()?.length ?? 0) > 0;
            const missingTitle = !tr.title?.trim();
            return (
              <>
                <input
                  className={`input input-bordered w-full ${hasContent && missingTitle ? 'input-error' : ''}`}
                  value={tr.title}
                  onChange={(e) => update('title', e.target.value)}
                  maxLength={titleLimit}
                  placeholder="Blog Post Title"
                />
                {hasContent && missingTitle && (
                  <label className="label">
                    <span className="label-text-alt text-error">
                      Title is required when Summary or Content is filled
                    </span>
                  </label>
                )}
              </>
            );
          })()}
        </div>
      </div>

      <div>
        <label className="label">
          <span className="label-text font-medium">
            Summary{' '}
            <span className="text-xs text-base-content/60 font-normal">
              (optional – will auto-generate from content if left blank)
            </span>
          </span>
        </label>
        <textarea
          className="textarea textarea-bordered w-full"
          rows={3}
          value={tr.summary}
          onChange={(e) => update('summary', e.target.value)}
          maxLength={summaryLimit}
          placeholder="A brief summary of the blog post..."
        />
        <div className="label justify-between">
          <span className="label-text-alt">{`${tr.summary?.length ?? 0}/${summaryLimit}`}</span>
          {!tr.summary?.length && (tr.contentMdx?.length ?? 0) > 20 && (
            <span className="label-text-alt text-base-content/60">
              Will be auto-generated on save
            </span>
          )}
        </div>
      </div>

      <div>
        <label className="label">
          <span className="label-text font-medium">Content (MDX)</span>
        </label>
        <textarea
          className="textarea textarea-bordered w-full font-mono text-sm"
          rows={16}
          value={tr.contentMdx}
          onChange={(e) => update('contentMdx', e.target.value)}
          placeholder="# Your blog content here&#10;&#10;Write your content using Markdown with MDX support..."
        />
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          className="btn btn-outline btn-sm"
          onClick={onPreview}
          disabled={!tr.contentMdx}
        >
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
            />
          </svg>
          Preview
        </button>
        {tr.locale === 'en-US' && onTranslate && (
          <button
            type="button"
            className="btn btn-primary btn-sm ml-auto"
            onClick={onTranslate}
            disabled={!canTranslate || isTranslating}
          >
            {isTranslating ? (
              <span className="loading loading-spinner loading-sm"></span>
            ) : (
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 8h14M7 16h10M12 4l4 8-4 8"
                />
              </svg>
            )}
            Translate
          </button>
        )}
      </div>

      {previewHtml && (
        <div className="card bg-base-50">
          <div className="card-body">
            <h4 className="card-title text-lg">Preview</h4>
            <div className="prose max-w-none" dangerouslySetInnerHTML={{ __html: previewHtml }} />
          </div>
        </div>
      )}
    </div>
  );
}
