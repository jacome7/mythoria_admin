'use client';

import React, { useEffect, useState, useCallback, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAdminAuth } from '@/lib/hooks/useAdminAuth';

interface BlogListTranslation { 
  locale: string; 
  slug: string; 
  title: string; 
  summary: string; 
}

interface BlogListItem { 
  id: string; 
  slugBase: string; 
  status: string; 
  publishedAt: string | null; 
  heroImageUrl: string | null; 
  translations: BlogListTranslation[] 
}

function BlogListContent() {
  const { session, loading } = useAdminAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [posts, setPosts] = useState<BlogListItem[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchBlogList = useCallback(async () => {
    try {
      setLoadingPosts(true);
      const qp = new URLSearchParams();
      if (searchParams.get('status')) qp.set('status', searchParams.get('status')!);
      if (searchParams.get('locale')) qp.set('locale', searchParams.get('locale')!);
      if (searchParams.get('search')) qp.set('search', searchParams.get('search')!);
      
      const queryString = qp.toString() ? `&${qp.toString()}` : '';
      const res = await fetch(`/api/admin/blog?limit=200${queryString}`, { 
        cache: 'no-store' 
      });
      
      if (res.ok) {
        const json = await res.json();
        setPosts(json.data as BlogListItem[]);
      } else {
        console.error('Failed to fetch blog posts');
        setPosts([]);
      }
    } catch {
      console.error('Error fetching blog posts');
      setPosts([]);
    } finally {
      setLoadingPosts(false);
    }
  }, [searchParams]);

  useEffect(() => {
    if (!loading && session?.user) {
      fetchBlogList();
    }
  }, [loading, session, fetchBlogList]);

  const handleDeletePost = async (postId: string, slugBase: string) => {
    const confirmed = confirm(`Are you sure you want to delete the blog post "${slugBase}"? This action cannot be undone.`);
    
    if (!confirmed) return;

    try {
      setDeletingId(postId);
      const res = await fetch(`/api/admin/blog/${postId}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        // Remove the deleted post from the local state
        setPosts(prevPosts => prevPosts.filter(post => post.id !== postId));
        alert('Blog post deleted successfully');
      } else {
        const errorData = await res.json();
        alert(`Failed to delete blog post: ${errorData.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error deleting blog post:', error);
      alert('An error occurred while deleting the blog post');
    } finally {
      setDeletingId(null);
    }
  };

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
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="loading loading-spinner loading-lg"></div></div>}>
      <div className="min-h-screen flex flex-col">
        <main className="flex-1 container mx-auto px-4 py-8">
          <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold">Blog Management</h1>
            <Link href="/blog/new" className="btn btn-primary">
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              New Post
            </Link>
          </div>

          <form className="card bg-base-100 shadow-md" method="GET">
            <div className="card-body">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="label">
                    <span className="label-text font-medium">Status</span>
                  </label>
                  <select 
                    name="status" 
                    defaultValue={searchParams.get('status') || ''} 
                    className="select select-bordered w-full"
                  >
                    <option value="">All Statuses</option>
                    <option value="draft">Draft</option>
                    <option value="published">Published</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>
                <div>
                  <label className="label">
                    <span className="label-text font-medium">Locale</span>
                  </label>
                  <select 
                    name="locale" 
                    defaultValue={searchParams.get('locale') || ''} 
                    className="select select-bordered w-full"
                  >
                    <option value="">All Locales</option>
                    <option value="en-US">English (US)</option>
                    <option value="pt-PT">Portuguese (PT)</option>
                    <option value="es-ES">Spanish (ES)</option>
                  </select>
                </div>
                <div>
                  <label className="label">
                    <span className="label-text font-medium">Search</span>
                  </label>
                  <input 
                    name="search" 
                    defaultValue={searchParams.get('search') || ''} 
                    placeholder="Search by title or slug..."
                    className="input input-bordered w-full" 
                  />
                </div>
                <div className="flex items-end">
                  <button className="btn btn-outline w-full" type="submit">
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    Filter
                  </button>
                </div>
              </div>
            </div>
          </form>

          {loadingPosts ? (
            <div className="flex justify-center py-12">
              <div className="loading loading-spinner loading-lg"></div>
            </div>
          ) : (
            <div className="card bg-base-100 shadow-md">
              <div className="card-body p-0">
                <div className="overflow-x-auto">
                  <table className="table table-zebra">
                    <thead>
                      <tr>
                        <th>Slug Base</th>
                        <th>Status</th>
                        <th>Published Date</th>
                        <th>Available Locales</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {posts.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="text-center py-8 text-base-content/60">
                            No blog posts found. 
                            <Link href="/blog/new" className="link link-primary ml-1">
                              Create your first post
                            </Link>
                          </td>
                        </tr>
                      ) : (
                        posts.map((post) => {
                          const locales = post.translations?.map((t) => t.locale) || [];
                          const statusColor = {
                            draft: 'badge-warning',
                            published: 'badge-success',
                            archived: 'badge-neutral'
                          }[post.status] || 'badge-outline';

                          return (
                            <tr key={post.id}>
                              <td>
                                <div className="font-medium">{post.slugBase}</div>
                                {post.heroImageUrl && (
                                  <div className="text-xs text-base-content/60 truncate max-w-xs">
                                    Has hero image
                                  </div>
                                )}
                              </td>
                              <td>
                                <span className={`badge ${statusColor}`}>
                                  {post.status}
                                </span>
                              </td>
                              <td>
                                {post.publishedAt ? (
                                  <div>
                                    <div>{new Date(post.publishedAt).toLocaleDateString()}</div>
                                    <div className="text-xs text-base-content/60">
                                      {new Date(post.publishedAt).toLocaleTimeString()}
                                    </div>
                                  </div>
                                ) : (
                                  <span className="text-base-content/60">Not published</span>
                                )}
                              </td>
                              <td>
                                <div className="flex flex-wrap gap-1">
                                  {locales.length ? (
                                    locales.map((locale) => (
                                      <span key={locale} className="badge badge-sm badge-primary">
                                        {locale}
                                      </span>
                                    ))
                                  ) : (
                                    <span className="text-xs text-base-content/60">No translations</span>
                                  )}
                                </div>
                              </td>
                              <td>
                                <div className="flex gap-2">
                                  <Link 
                                    href={`/blog/${post.id}`} 
                                    className="btn btn-sm btn-primary"
                                  >
                                    Edit
                                  </Link>
                                  {post.status === 'published' && (
                                    <button className="btn btn-sm btn-outline" title="View Live">
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                      </svg>
                                    </button>
                                  )}
                                  <button 
                                    onClick={() => handleDeletePost(post.id, post.slugBase)}
                                    disabled={deletingId === post.id}
                                    className="btn btn-sm btn-error"
                                    title="Delete Post"
                                  >
                                    {deletingId === post.id ? (
                                      <span className="loading loading-spinner loading-xs"></span>
                                    ) : (
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                      </svg>
                                    )}
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
          </div>
        </main>
      </div>
    </Suspense>
  );
}

export default function BlogListPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="loading loading-spinner loading-lg"></div></div>}>
      <BlogListContent />
    </Suspense>
  );
}
