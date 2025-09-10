"use client";
import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import AdminHeader from '../../../components/AdminHeader';
import AdminFooter from '../../../components/AdminFooter';
import Link from 'next/link';
import { useAdminAuth } from '@/lib/hooks/useAdminAuth';

const LOCALES = ['en-US','pt-PT','es-ES'];

interface TranslationState { 
  locale: string; 
  slug: string; 
  title: string; 
  summary: string; 
  contentMdx: string; 
}

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
        
        const map: Record<string, TranslationState> = {};
        trs.forEach((t: Record<string, string>) => { 
          map[t.locale] = { 
            locale: t.locale, 
            slug: t.slug, 
            title: t.title, 
            summary: t.summary, 
            contentMdx: t.contentMdx 
          }; 
        });
        
        // Initialize empty translations for missing locales
        LOCALES.forEach(l => { 
          if (!map[l]) {
            map[l] = { 
              locale: l, 
              slug: '', 
              title: '', 
              summary: '', 
              contentMdx: '' 
            }; 
          }
        });
        
        setTranslations(map);
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
    Object.values(translations).forEach(t => {
      const hasContent = (t.summary && t.summary.trim().length > 0) || (t.contentMdx && t.contentMdx.trim().length > 0);
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
    setTranslations(prev => ({ 
      ...prev, 
      [locale]: { ...prev[locale], [field]: value } 
    }));
  }

  async function save() {
    setError('');
    // Validate mandatory fields before saving
    const missingLocales = getLocalesMissingSlugOrTitle();
    if (missingLocales.length > 0) {
      setError(`Slug and Title are required for: ${missingLocales.join(', ')}`);
      return;
    }
    setSaving(true);
    
    try {
      const body = {
        heroImageUrl: heroImageUrl || null,
        status: status_,
        publishedAt: publishedAt,
        translations: Object.values(translations).filter(t => t.slug && t.title && t.summary && t.contentMdx)
      };
      
      const res = await fetch(`/api/admin/blog/${id}`, { 
        method: 'PUT', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify(body) 
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
        // Redirect to listings after successful save
        router.push('/blog');
      }
  } catch {
      setError('Network error during save');
    } finally {
      setSaving(false);
    }
  }

  async function publish() {
    setError('');
    // Validate mandatory fields before publishing as well
    const missingLocales = getLocalesMissingSlugOrTitle();
    if (missingLocales.length > 0) {
      setError(`Slug and Title are required for: ${missingLocales.join(', ')}`);
      return;
    }
    
    try {
      const res = await fetch(`/api/admin/blog/${id}/publish`, { method: 'POST' });
      
      if (res.ok) {
        const json = await res.json();
        setStatus(json.data.status);
        setPublishedAt(json.data.publishedAt);
        // Redirect to listings after publish
        router.push('/blog');
      } else {
        const errorData = await res.json();
        setError(errorData.error || 'Publish failed');
      }
  } catch {
      setError('Network error during publish');
    }
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
        body: JSON.stringify({ contentMdx: tr.contentMdx }) 
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
        <AdminHeader />
        <main className="flex-1 container mx-auto px-4 py-8">
          <div className="max-w-2xl mx-auto">
            <div className="alert alert-error">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
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
        <AdminFooter />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <AdminHeader />
      <main className="flex-1 container mx-auto px-4 py-8">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/blog" className="btn btn-ghost btn-sm">
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back to Blog List
              </Link>
              <h1 className="text-3xl font-bold">Edit Blog Post</h1>
            </div>
            <div className="flex gap-2">
              <button 
                className="btn btn-outline" 
                onClick={save} 
                disabled={saving}
              >
                {saving ? (
                  <>
                    <span className="loading loading-spinner loading-sm"></span>
                    Saving...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 0V4a2 2 0 00-2-2H9a2 2 0 00-2 2v3m1 0h4" />
                    </svg>
                    Save Changes
                  </>
                )}
              </button>
              <button 
                className="btn btn-primary" 
                onClick={() => {
                  if (status_ !== 'published') {
                    setStatus('published');
                    if (!publishedAt) {
                      setPublishedAt(new Date().toISOString());
                    }
                  }
                  // Use publish endpoint to ensure server sets status and date, then redirect
                  publish();
                }}
                disabled={saving}
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
                {status_ === 'published' ? 'Update & Keep Published' : 'Publish Now'}
              </button>
            </div>
          </div>

          {error && (
            <div className="alert alert-error">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2 space-y-6">
              <div className="card bg-base-100 shadow-md">
                <div className="card-body">
                  <div className="tabs tabs-bordered">
                    {LOCALES.map(locale => (
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
                      onChange={e => setHeroImageUrl(e.target.value)}
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
                      onChange={e => setStatus(e.target.value)}
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
                        onChange={e => setPublishedAt(e.target.value ? new Date(e.target.value).toISOString() : null)}
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
                      <span className={`badge ${
                        status_ === 'published' ? 'badge-success' : 
                        status_ === 'draft' ? 'badge-warning' : 'badge-neutral'
                      }`}>
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
                    {LOCALES.map(locale => {
                      const tr = translations[locale];
                      const isComplete = tr && tr.slug && tr.title && tr.summary && tr.contentMdx;
                      return (
                        <div key={locale} className="flex justify-between items-center">
                          <span className="text-sm">{locale}</span>
                          <span className={`badge badge-sm ${isComplete ? 'badge-success' : 'badge-warning'}`}>
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
      <AdminFooter />
    </div>
  );
}

function LocaleEditor({ 
  tr, 
  update, 
  onPreview, 
  previewHtml 
}: { 
  tr: TranslationState; 
  update: (field: keyof TranslationState, value: string) => void; 
  onPreview: () => void; 
  previewHtml: string | null;
}) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="label">
            <span className="label-text font-medium">Slug <span className="text-error">(required with content)</span></span>
          </label>
          {(() => {
            const hasContent = (tr.summary?.trim()?.length ?? 0) > 0 || (tr.contentMdx?.trim()?.length ?? 0) > 0;
            const missingSlug = !tr.slug?.trim();
            return (
              <>
                <input 
                  className={`input input-bordered w-full ${hasContent && missingSlug ? 'input-error' : ''}`} 
                  value={tr.slug} 
                  onChange={e => update('slug', e.target.value)}
                  maxLength={160}
                  pattern="[a-z0-9-]+"
                  placeholder="blog-post-slug"
                />
                {hasContent && missingSlug && (
                  <label className="label">
                    <span className="label-text-alt text-error">Slug is required when Summary or Content is filled</span>
                  </label>
                )}
              </>
            );
          })()}
        </div>
        <div>
          <label className="label">
            <span className="label-text font-medium">Title <span className="text-error">(required with content)</span></span>
          </label>
          {(() => {
            const hasContent = (tr.summary?.trim()?.length ?? 0) > 0 || (tr.contentMdx?.trim()?.length ?? 0) > 0;
            const missingTitle = !tr.title?.trim();
            return (
              <>
                <input 
                  className={`input input-bordered w-full ${hasContent && missingTitle ? 'input-error' : ''}`} 
                  value={tr.title} 
                  onChange={e => update('title', e.target.value)}
                  maxLength={255}
                  placeholder="Blog Post Title"
                />
                {hasContent && missingTitle && (
                  <label className="label">
                    <span className="label-text-alt text-error">Title is required when Summary or Content is filled</span>
                  </label>
                )}
              </>
            );
          })()}
        </div>
      </div>
      
      <div>
        <label className="label">
          <span className="label-text font-medium">Summary</span>
        </label>
        <textarea 
          className="textarea textarea-bordered w-full" 
          rows={3} 
          value={tr.summary} 
          onChange={e => update('summary', e.target.value)}
          maxLength={600}
          placeholder="A brief summary of the blog post..."
        />
        <div className="label">
          <span className="label-text-alt">{`${tr.summary?.length ?? 0}/600`}</span>
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
          onChange={e => update('contentMdx', e.target.value)}
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
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
          Preview
        </button>
      </div>
      
      {previewHtml && (
        <div className="card bg-base-50">
          <div className="card-body">
            <h4 className="card-title text-lg">Preview</h4>
            <div 
              className="prose max-w-none" 
              dangerouslySetInnerHTML={{ __html: previewHtml }} 
            />
          </div>
        </div>
      )}
    </div>
  );
}
