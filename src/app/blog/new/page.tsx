"use client";
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAdminAuth } from '@/lib/hooks/useAdminAuth';

export default function NewBlogPostPage() {
  const { session, loading } = useAdminAuth();
  const router = useRouter();
  const [slugBase, setSlugBase] = useState('');
  const [heroImageUrl, setHeroImageUrl] = useState('');
  // Local submit/loading state (renamed to avoid shadowing auth loading)
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    
    if (!slugBase.trim()) {
      setError('Slug base is required');
      return;
    }

  setSubmitting(true);
    setError('');

    try {
      const res = await fetch('/api/admin/blog', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          slugBase: slugBase.trim(), 
          heroImageUrl: heroImageUrl.trim() || null 
        })
      });

      if (res.ok) {
        const json = await res.json();
        router.push(`/blog/${json.data.post.id}`);
      } else {
        const errorData = await res.json();
        setError(errorData.error || 'Failed to create blog post');
      }
  } catch {
      setError('Network error. Please try again.');
    } finally {
  setSubmitting(false);
    }
  }

  // Show loading state while checking authentication
  if (loading) {
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

  return (
    <div className="min-h-screen flex flex-col">
      <main className="flex-1 container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto space-y-6">
          <div className="flex items-center gap-4">
            <Link href="/blog" className="btn btn-ghost btn-sm">
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to Blog List
            </Link>
            <h1 className="text-3xl font-bold">Create New Blog Post</h1>
          </div>

          <div className="card bg-base-100 shadow-md">
            <div className="card-body">
              <form onSubmit={handleCreate} className="space-y-6">
                {error && (
                  <div className="alert alert-error">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>{error}</span>
                  </div>
                )}

                <div>
                  <label className="label">
                    <span className="label-text font-medium">
                      Slug Base <span className="text-error">*</span>
                    </span>
                  </label>
                  <input 
                    className={`input input-bordered w-full ${error && !slugBase.trim() ? 'input-error' : ''}`}
                    value={slugBase} 
                    onChange={e => setSlugBase(e.target.value)}
                    placeholder="e.g., my-awesome-blog-post"
                    required 
                  />
                  <label className="label">
                    <span className="label-text-alt text-base-content/60">
                      This will be used as the URL slug for all language versions
                    </span>
                  </label>
                </div>

                <div>
                  <label className="label">
                    <span className="label-text font-medium">Hero Image URL</span>
                  </label>
                  <input 
                    className="input input-bordered w-full"
                    value={heroImageUrl} 
                    onChange={e => setHeroImageUrl(e.target.value)}
                    placeholder="https://example.com/image.jpg"
                    type="url"
                  />
                  <label className="label">
                    <span className="label-text-alt text-base-content/60">
                      Optional. This image will be displayed at the top of the blog post
                    </span>
                  </label>
                </div>

                <div className="card-actions justify-end">
                  <Link href="/blog" className="btn btn-ghost">
                    Cancel
                  </Link>
                  <button 
                    className="btn btn-primary" 
                    disabled={submitting || !slugBase.trim()}
                    type="submit"
                  >
                    {submitting ? (
                      <>
                        <span className="loading loading-spinner loading-sm"></span>
                        Creating...
                      </>
                    ) : (
                      <>
                        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                        </svg>
                        Create Blog Post
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>

          <div className="card bg-base-200">
            <div className="card-body">
              <h3 className="card-title text-lg">Next Steps</h3>
              <p className="text-base-content/70">
                After creating your blog post, you&apos;ll be redirected to the edit page where you can:
              </p>
              <ul className="list-disc list-inside mt-2 space-y-1 text-base-content/70">
                <li>Add content in multiple languages</li>
                <li>Set specific slugs for each language</li>
                <li>Write and preview your MDX content</li>
                <li>Publish when ready</li>
              </ul>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
