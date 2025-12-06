'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { formatAdminDate } from '@/lib/date-utils';
import { useAdminAuth } from '@/lib/hooks/useAdminAuth';

interface Story {
  storyId: string;
  title: string;
  author: {
    authorId: string;
    displayName: string;
    email: string;
  };
  status: 'draft' | 'writing' | 'published';
  chapterCount: number;
  createdAt: string;
  updatedAt: string;
  isPublic: boolean;
  isFeatured: boolean;
  interiorPdfUri?: string | null;
  coverPdfUri?: string | null;
}

interface PaginationData {
  page: number;
  totalPages: number;
  totalCount: number;
  hasNext: boolean;
  hasPrev: boolean;
  limit: number;
}

interface StoriesResponse {
  data: Story[];
  pagination: PaginationData;
}

export default function StoriesPage() {
  const { session, loading } = useAdminAuth();
  const [stories, setStories] = useState<Story[]>([]);
  const [pagination, setPagination] = useState<PaginationData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<50 | 100 | 200>(50);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterFeatured, setFilterFeatured] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [inputValue, setInputValue] = useState('');
  const [sortBy, setSortBy] = useState<'title' | 'createdAt' | 'updatedAt' | 'status'>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Debounce the search term update
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchTerm(inputValue);
    }, 500);

    return () => clearTimeout(timer);
  }, [inputValue]);

  const fetchStories = useCallback(
    async (page: number) => {
      try {
        setIsLoading(true);
        const params = new URLSearchParams({
          page: page.toString(),
          limit: pageSize.toString(),
          ...(searchTerm && { search: searchTerm }),
          ...(filterStatus !== 'all' && { status: filterStatus }),
          ...(filterFeatured !== 'all' && { featured: filterFeatured }),
          sortBy: sortBy,
          sortOrder: sortOrder,
        });

        const response = await fetch(`/api/admin/stories?${params.toString()}`);
        if (response.ok) {
          const data: StoriesResponse = await response.json();
          setStories(data.data);
          setPagination(data.pagination);
        } else {
          console.error('Failed to fetch stories');
        }
      } catch (error) {
        console.error('Error fetching stories:', error);
      } finally {
        setIsLoading(false);
      }
    },
    [searchTerm, filterStatus, filterFeatured, sortBy, sortOrder, pageSize],
  );

  useEffect(() => {
    if (!loading && session?.user) {
      fetchStories(currentPage);
    }
  }, [loading, session, currentPage, fetchStories]);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handlePageSizeChange = (size: 50 | 100 | 200) => {
    setPageSize(size);
    setCurrentPage(1);
  };

  const handleSearch = (term: string) => {
    setInputValue(term);
    // searchTerm will be updated by the debounce effect
  };

  // Reset page when search term actually changes (after debounce)
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const handleStatusFilter = (status: string) => {
    setFilterStatus(status);
    setCurrentPage(1);
  };

  const handleFeaturedFilter = (featured: string) => {
    setFilterFeatured(featured);
    setCurrentPage(1);
  };

  const handleSort = (column: 'title' | 'createdAt' | 'updatedAt' | 'status') => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('desc');
    }
    setCurrentPage(1);
  };

  const getSortIcon = (column: 'title' | 'createdAt' | 'updatedAt' | 'status') => {
    if (sortBy !== column) return '↕';
    return sortOrder === 'asc' ? '↑' : '↓';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft':
        return 'badge-neutral';
      case 'writing':
        return 'badge-warning';
      case 'published':
        return 'badge-success';
      default:
        return 'badge-neutral';
    }
  };

  if (loading || isLoading) {
    return (
      <div className="min-h-screen bg-base-200">
        <main className="container mx-auto p-6">
          <div className="flex justify-center items-center h-64">
            <span className="loading loading-spinner loading-lg"></span>
          </div>
        </main>
      </div>
    );
  }

  if (!session?.user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-base-200">
      <main className="container mx-auto p-4 md:p-6">
        <div className="mb-4 md:mb-6">
          <h1 className="text-2xl md:text-3xl font-bold text-base-content mb-1 md:mb-2">
            Stories Management
          </h1>
          <p className="text-base-content/70 text-sm md:text-base">
            View, moderate, and manage user-generated stories
          </p>
        </div>

        {/* Filters and Search */}
        <div className="card bg-base-100 shadow-xl mb-6">
          <div className="card-body">
            <div className="flex flex-col sm:flex-row flex-wrap gap-3 md:gap-4 items-start md:items-center">
              <div className="form-control">
                <label className="label">
                  <span className="label-text">Search</span>
                </label>
                <input
                  type="text"
                  placeholder="Search stories, authors..."
                  className="input input-bordered w-full max-w-xs"
                  value={inputValue}
                  onChange={(e) => handleSearch(e.target.value)}
                />
              </div>

              <div className="form-control">
                <label className="label">
                  <span className="label-text">Status</span>
                </label>
                <select
                  className="select select-bordered w-full max-w-xs"
                  value={filterStatus}
                  onChange={(e) => handleStatusFilter(e.target.value)}
                >
                  <option value="all">All Statuses</option>
                  <option value="draft">Draft</option>
                  <option value="writing">Writing</option>
                  <option value="published">Published</option>
                </select>
              </div>

              <div className="form-control">
                <label className="label">
                  <span className="label-text">Featured</span>
                </label>
                <select
                  className="select select-bordered w-full max-w-xs"
                  value={filterFeatured}
                  onChange={(e) => handleFeaturedFilter(e.target.value)}
                >
                  <option value="all">All Stories</option>
                  <option value="featured">Featured</option>
                  <option value="clean">Not Featured</option>
                </select>
              </div>

              <div className="form-control">
                <label className="label">
                  <span className="label-text">Rows per page</span>
                </label>
                <select
                  className="select select-bordered w-full max-w-xs"
                  value={pageSize}
                  onChange={(e) => handlePageSizeChange(Number(e.target.value) as 50 | 100 | 200)}
                >
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                  <option value={200}>200</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Stories Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 md:gap-4 mb-4 md:mb-6">
          <div className="card bg-base-100 shadow">
            <div className="card-body">
              <h3 className="card-title text-sm">Total Stories</h3>
              <p className="text-2xl font-bold">{pagination?.totalCount || stories.length}</p>
            </div>
          </div>
          <div className="card bg-base-100 shadow">
            <div className="card-body">
              <h3 className="card-title text-sm">Published</h3>
              <p className="text-2xl font-bold">
                {stories.filter((s) => s.status === 'published').length}
              </p>
            </div>
          </div>
          <div className="card bg-base-100 shadow">
            <div className="card-body">
              <h3 className="card-title text-sm">Featured</h3>
              <p className="text-2xl font-bold text-info">
                {stories.filter((s) => s.isFeatured).length}
              </p>
            </div>
          </div>
          <div className="card bg-base-100 shadow">
            <div className="card-body">
              <h3 className="card-title text-sm">Public</h3>
              <p className="text-2xl font-bold">{stories.filter((s) => s.isPublic).length}</p>
            </div>
          </div>
        </div>

        {/* Stories Table */}
        <div className="card bg-base-100 shadow-xl">
          <div className="card-body">
            <div className="overflow-x-auto">
              <table className="table table-zebra w-full">
                <thead>
                  <tr>
                    <th>
                      <button onClick={() => handleSort('title')} className="btn btn-ghost btn-xs">
                        Story {getSortIcon('title')}
                      </button>
                    </th>
                    <th>Author</th>
                    <th>
                      <button onClick={() => handleSort('status')} className="btn btn-ghost btn-xs">
                        Status {getSortIcon('status')}
                      </button>
                    </th>
                    <th>Chapters</th>
                    <th>
                      <button
                        onClick={() => handleSort('createdAt')}
                        className="btn btn-ghost btn-xs"
                      >
                        Created {getSortIcon('createdAt')}
                      </button>
                    </th>
                    <th>
                      <button
                        onClick={() => handleSort('updatedAt')}
                        className="btn btn-ghost btn-xs"
                      >
                        Last Updated {getSortIcon('updatedAt')}
                      </button>
                    </th>
                    <th>Flags</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {stories.map((story) => (
                    <tr key={story.storyId} className={story.isFeatured ? 'bg-info/10' : ''}>
                      <td>
                        <div>
                          <div className="font-bold">
                            <Link href={`/stories/${story.storyId}`} className="link link-primary">
                              {story.title}
                            </Link>
                          </div>
                          <div className="text-sm opacity-50">
                            ID: {story.storyId.substring(0, 8)}...
                          </div>
                        </div>
                      </td>
                      <td>
                        <div>
                          <div className="font-medium">{story.author.displayName}</div>
                          <div className="text-sm opacity-50">{story.author.email}</div>
                        </div>
                      </td>
                      <td>
                        <span className={`badge ${getStatusColor(story.status)} capitalize`}>
                          {story.status}
                        </span>
                      </td>
                      <td>
                        <div className="text-sm">
                          <div>{story.chapterCount} chapters</div>
                        </div>
                      </td>
                      <td>
                        <div className="text-sm">{formatAdminDate(story.createdAt)}</div>
                      </td>
                      <td>
                        <div className="text-sm">{formatAdminDate(story.updatedAt)}</div>
                      </td>
                      <td>
                        <div className="flex gap-1">
                          {story.isFeatured && (
                            <span className="badge badge-info badge-xs">Featured</span>
                          )}
                          {story.isPublic && (
                            <span className="badge badge-success badge-xs">Public</span>
                          )}
                        </div>
                      </td>
                      <td>
                        <div className="flex gap-2">
                          <Link href={`/stories/${story.storyId}`} className="btn btn-ghost btn-xs">
                            View
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {stories.length === 0 && (
                <div className="text-center py-8">
                  <p className="text-base-content/70">No stories found matching your filters.</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Pagination */}
        {pagination && (
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 mt-8">
            <div className="flex flex-wrap items-center gap-3 text-sm text-base-content/80">
              <span>
                Showing{' '}
                {Math.min((pagination.page - 1) * pagination.limit + 1, pagination.totalCount)}-
                {Math.min(pagination.page * pagination.limit, pagination.totalCount)} of{' '}
                {pagination.totalCount}
              </span>
              <div className="flex items-center gap-2">
                <span className="text-xs uppercase tracking-wide">Rows</span>
                <select
                  className="select select-bordered select-sm"
                  value={pageSize}
                  onChange={(e) => handlePageSizeChange(Number(e.target.value) as 50 | 100 | 200)}
                >
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                  <option value={200}>200</option>
                </select>
              </div>
            </div>

            {pagination.totalPages > 1 && (
              <div className="btn-group">
                <button
                  className={`btn ${!pagination.hasPrev ? 'btn-disabled' : ''}`}
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={!pagination.hasPrev}
                >
                  Previous
                </button>

                {/* Page numbers */}
                {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                  const pageNum = Math.max(1, currentPage - 2) + i;
                  if (pageNum > pagination.totalPages) return null;

                  return (
                    <button
                      key={pageNum}
                      className={`btn ${currentPage === pageNum ? 'btn-active' : ''}`}
                      onClick={() => handlePageChange(pageNum)}
                    >
                      {pageNum}
                    </button>
                  );
                })}

                <button
                  className={`btn ${!pagination.hasNext ? 'btn-disabled' : ''}`}
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={!pagination.hasNext}
                >
                  Next
                </button>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
