'use client';

import { useSession } from 'next-auth/react';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import AdminHeader from '../../components/AdminHeader';
import AdminFooter from '../../components/AdminFooter';

interface Lead {
  leadId: string;
  email: string;
  createdAt: string;
  notifiedAt: string | null;
}

interface PaginationData {
  page: number;
  totalPages: number;
  totalCount: number;
  hasNext: boolean;
  hasPrev: boolean;
  limit: number;
}

interface LeadsResponse {
  data: Lead[];
  pagination: PaginationData;
}

type SortField = 'email' | 'createdAt' | 'notifiedAt';
type SortOrder = 'asc' | 'desc';

export default function LeadsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [pagination, setPagination] = useState<PaginationData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<SortField>('createdAt');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  const fetchLeads = useCallback(async (page: number) => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '100',
        ...(searchTerm && { search: searchTerm }),
        sortBy: sortField,
        sortOrder: sortOrder,
      });
      
      const response = await fetch(`/api/admin/leads?${params.toString()}`);
      if (response.ok) {
        const data: LeadsResponse = await response.json();
        setLeads(data.data);
        setPagination(data.pagination);
      } else {
        console.error('Failed to fetch leads');
      }
    } catch (error) {
      console.error('Error fetching leads:', error);
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

      // Fetch leads data if authorized
      fetchLeads(currentPage);
    }
  }, [status, session, router, currentPage, fetchLeads]);

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
      <main className="flex-1 container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold">Leads Management</h1>
            <p className="text-gray-600 mt-2">Manage email leads and newsletter subscribers</p>
          </div>
          <div className="text-sm text-gray-500">
            {pagination && `${pagination.totalCount} total leads`}
          </div>
        </div>

        {/* Search and Filter Controls */}
        <div className="bg-base-100 p-6 rounded-lg shadow-sm mb-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <input
                type="text"
                placeholder="Search by email..."
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
                <option value="email">Email</option>
                <option value="notifiedAt">Notified Date</option>
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

        {/* Leads Table */}
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
                      onClick={() => handleSort('email')}
                    >
                      Email {sortField === 'email' && (sortOrder === 'asc' ? '↑' : '↓')}
                    </th>
                    <th
                      className="cursor-pointer hover:bg-base-200"
                      onClick={() => handleSort('createdAt')}
                    >
                      Created {sortField === 'createdAt' && (sortOrder === 'asc' ? '↑' : '↓')}
                    </th>
                    <th
                      className="cursor-pointer hover:bg-base-200"
                      onClick={() => handleSort('notifiedAt')}
                    >
                      Notified {sortField === 'notifiedAt' && (sortOrder === 'asc' ? '↑' : '↓')}
                    </th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {leads.map((lead) => (
                    <tr key={lead.leadId} className="hover:bg-base-50">
                      <td>
                        <div className="font-medium">{lead.email}</div>
                      </td>
                      <td>
                        <div className="text-sm">
                          {new Date(lead.createdAt).toLocaleDateString()}
                        </div>
                      </td>
                      <td>
                        <div className="text-sm">
                          {lead.notifiedAt 
                            ? new Date(lead.notifiedAt).toLocaleDateString()
                            : <span className="text-gray-400">Not notified</span>
                          }
                        </div>
                      </td>
                      <td>
                        <div className={`badge ${lead.notifiedAt ? 'badge-success' : 'badge-warning'}`}>
                          {lead.notifiedAt ? 'Notified' : 'Pending'}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              
              {leads.length === 0 && !isLoading && (
                <div className="text-center py-12">
                  <p className="text-gray-500">No leads found</p>
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
