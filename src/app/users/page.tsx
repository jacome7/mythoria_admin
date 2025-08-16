'use client';

import { useSession } from 'next-auth/react';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import AdminHeader from '../../components/AdminHeader';
import AdminFooter from '../../components/AdminFooter';
import { formatAdminDate } from '@/lib/date-utils';

interface User {
  authorId: string;
  displayName: string;
  email: string;
  mobilePhone: string | null;
  createdAt: string;
  lastLoginAt: string | null;
}

interface PaginationData {
  page: number;
  totalPages: number;
  totalCount: number;
  hasNext: boolean;
  hasPrev: boolean;
  limit: number;
}

interface UsersResponse {
  data: User[];
  pagination: PaginationData;
}

type SortField = 'displayName' | 'email' | 'createdAt';
type SortOrder = 'asc' | 'desc';

export default function UsersPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [pagination, setPagination] = useState<PaginationData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<SortField>('createdAt');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  const fetchUsers = useCallback(async (page: number) => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '100',
        ...(searchTerm && { search: searchTerm }),
        sortBy: sortField,
        sortOrder: sortOrder,
      });
      
      const response = await fetch(`/api/admin/users?${params.toString()}`);
      if (response.ok) {
        const data: UsersResponse = await response.json();
        setUsers(data.data);
        setPagination(data.pagination);
      } else {
        console.error('Failed to fetch users');
      }
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setIsLoading(false);
    }
  }, [searchTerm, sortField, sortOrder]);

  useEffect(() => {
    if (status === 'loading') return;

    if (status === 'unauthenticated') {
      router.push('/auth/signin');
      return;
    }

    if (session?.user) {
      // Check if user has the required email domain
      const allowedDomains = ["@mythoria.pt", "@caravanconcierge.com"];
      const isAllowedDomain = allowedDomains.some(domain => 
        session.user?.email?.endsWith(domain)
      );

      if (!isAllowedDomain) {
        router.push('/auth/error');
        return;
      }

      // Fetch users data if authorized
      fetchUsers(currentPage);
    }
  }, [status, session, router, currentPage, fetchUsers]);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleSearch = (term: string) => {
    setSearchTerm(term);
    setCurrentPage(1);
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
    setCurrentPage(1);
  };

  // Show loading state while checking authentication
  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="loading loading-spinner loading-lg"></div>
      </div>
    );
  }

  // Don't render content if not authorized
  if (status === 'unauthenticated' || !session?.user) {
    return null;
  }

  return (
    <div className="min-h-screen flex flex-col">
      <AdminHeader />
      <main className="flex-1 container mx-auto px-4 py-6 md:py-8">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 mb-6 md:mb-8">
          <div>
            <h1 className="text-2xl md:text-4xl font-bold">Users Management</h1>
            <p className="text-gray-600 mt-1 md:mt-2 text-sm md:text-base">Manage registered authors and their data</p>
          </div>
          <div className="text-xs md:text-sm text-gray-500">
            {pagination && `${pagination.totalCount} total users`}
          </div>
        </div>

        {/* Search and Filter Controls */}
        <div className="bg-base-100 p-4 md:p-6 rounded-lg shadow-sm mb-6">
          <div className="flex flex-col sm:flex-row gap-3 md:gap-4">
            <div className="flex-1">
              <input
                type="text"
                placeholder="Search by name, email, or phone..."
                className="input input-bordered w-full"
                value={searchTerm}
                onChange={(e) => handleSearch(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <select
                className="select select-bordered"
                value={sortField}
                onChange={(e) => setSortField(e.target.value as SortField)}
              >
                <option value="createdAt">Created Date</option>
                <option value="displayName">Name</option>
                <option value="email">Email</option>
              </select>
              <button
                className="btn btn-outline"
                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              >
                {sortOrder === 'asc' ? '↑' : '↓'}
              </button>
            </div>
          </div>
        </div>

        {/* Users Table */}
  <div className="bg-base-100 rounded-lg shadow-sm">
          {isLoading ? (
            <div className="flex justify-center items-center py-12">
              <div className="loading loading-spinner loading-lg"></div>
            </div>
          ) : (
      <div className="overflow-x-auto">
              <table className="table table-zebra w-full">
                <thead>
                  <tr>
                    <th
                      className="cursor-pointer hover:bg-base-200"
                      onClick={() => handleSort('displayName')}
                    >
                      Name {sortField === 'displayName' && (sortOrder === 'asc' ? '↑' : '↓')}
                    </th>
                    <th
                      className="cursor-pointer hover:bg-base-200"
                      onClick={() => handleSort('email')}
                    >
                      Email {sortField === 'email' && (sortOrder === 'asc' ? '↑' : '↓')}
                    </th>
                    <th>Phone</th>
                    <th
                      className="cursor-pointer hover:bg-base-200"
                      onClick={() => handleSort('createdAt')}
                    >
                      Created {sortField === 'createdAt' && (sortOrder === 'asc' ? '↑' : '↓')}
                    </th>
                    <th>Last Login</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
        <tr key={user.authorId} className="hover:bg-base-50">
                      <td>
                        <div className="font-medium">{user.displayName}</div>
                      </td>
                      <td>
                        <div className="text-sm opacity-70">{user.email}</div>
                      </td>
                      <td>
                        <div className="text-sm">
                          {user.mobilePhone || <span className="text-gray-400">—</span>}
                        </div>
                      </td>
                      <td>
                        <div className="text-sm">
                          {formatAdminDate(user.createdAt)}
                        </div>
                      </td>
                      <td>
                        <div className="text-sm">
                          {user.lastLoginAt 
                            ? formatAdminDate(user.lastLoginAt)
                            : <span className="text-gray-400">Never</span>
                          }
                        </div>
                      </td>
                      <td>
                        <Link 
                          href={`/users/${user.authorId}`}
        className="btn btn-sm btn-outline"
                        >
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              
              {users.length === 0 && !isLoading && (
                <div className="text-center py-12">
                  <p className="text-gray-500">No users found</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Pagination */}
        {pagination && pagination.totalPages > 1 && (
          <div className="flex justify-center mt-8">
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
          </div>
        )}
      </main>
      <AdminFooter />
    </div>
  );
}
