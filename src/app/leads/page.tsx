'use client';

import { useEffect, useState, useCallback } from 'react';
import { formatLeadsDate } from '@/lib/date-utils';
import { useAdminAuth } from '@/lib/hooks/useAdminAuth';
import LeadModal from '@/components/LeadModal';

interface Lead {
  id: string;
  name: string | null;
  email: string;
  mobilePhone: string | null;
  language: string;
  emailStatus: 'ready' | 'sent' | 'open' | 'click' | 'soft_bounce' | 'hard_bounce' | 'unsub';
  lastEmailSentAt: string | null;
  lastUpdatedAt: string;
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

type SortField =
  | 'name'
  | 'email'
  | 'language'
  | 'emailStatus'
  | 'lastEmailSentAt'
  | 'lastUpdatedAt';
type SortOrder = 'asc' | 'desc';

const EMAIL_STATUS_LABELS: Record<Lead['emailStatus'], string> = {
  ready: 'Ready',
  sent: 'Sent',
  open: 'Opened',
  click: 'Clicked',
  soft_bounce: 'Soft Bounce',
  hard_bounce: 'Hard Bounce',
  unsub: 'Unsubscribed',
};

const EMAIL_STATUS_COLORS: Record<Lead['emailStatus'], string> = {
  ready: 'badge-info',
  sent: 'badge-primary',
  open: 'badge-success',
  click: 'badge-accent',
  soft_bounce: 'badge-warning',
  hard_bounce: 'badge-error',
  unsub: 'badge-ghost',
};

export default function LeadsPage() {
  const { session, loading } = useAdminAuth();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [pagination, setPagination] = useState<PaginationData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [languageFilter, setLanguageFilter] = useState('all');
  const [sortField, setSortField] = useState<SortField>('lastEmailSentAt');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [selectedLeads, setSelectedLeads] = useState<Set<string>>(new Set());
  const [bulkActionLoading, setBulkActionLoading] = useState(false);

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);

  // CSV upload state
  const [isUploading, setIsUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<{
    success: number;
    errors: string[];
    duplicates: number;
  } | null>(null);

  const fetchLeads = useCallback(
    async (page: number) => {
      try {
        setIsLoading(true);
        const params = new URLSearchParams({
          page: page.toString(),
          limit: '100',
          ...(searchTerm && { search: searchTerm }),
          ...(statusFilter !== 'all' && { status: statusFilter }),
          ...(languageFilter !== 'all' && { language: languageFilter }),
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
    },
    [searchTerm, statusFilter, languageFilter, sortField, sortOrder],
  );

  useEffect(() => {
    if (!loading && session?.user) {
      fetchLeads(currentPage);
    }
  }, [loading, session, currentPage, fetchLeads]);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    setSelectedLeads(new Set()); // Clear selection on page change
  };

  const handleSearch = (term: string) => {
    setSearchTerm(term);
    setCurrentPage(1);
    setSelectedLeads(new Set());
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

  const handleSelectAll = () => {
    if (selectedLeads.size === leads.length) {
      setSelectedLeads(new Set());
    } else {
      setSelectedLeads(new Set(leads.map((lead) => lead.id)));
    }
  };

  const handleSelectLead = (id: string) => {
    const newSelection = new Set(selectedLeads);
    if (newSelection.has(id)) {
      newSelection.delete(id);
    } else {
      newSelection.add(id);
    }
    setSelectedLeads(newSelection);
  };

  const handleBulkDelete = async () => {
    if (selectedLeads.size === 0) return;

    const confirmed = window.confirm(
      `Are you sure you want to delete ${selectedLeads.size} lead(s)? This action cannot be undone.`,
    );

    if (!confirmed) return;

    try {
      setBulkActionLoading(true);
      const response = await fetch('/api/admin/leads/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'delete',
          ids: Array.from(selectedLeads),
        }),
      });

      if (response.ok) {
        setSelectedLeads(new Set());
        fetchLeads(currentPage);
      } else {
        const error = await response.json();
        alert(`Error: ${error.error || 'Failed to delete leads'}`);
      }
    } catch (error) {
      console.error('Error deleting leads:', error);
      alert('An error occurred while deleting leads');
    } finally {
      setBulkActionLoading(false);
    }
  };

  const handleBulkChangeStatus = async (newStatus: string) => {
    if (selectedLeads.size === 0) return;

    try {
      setBulkActionLoading(true);
      const response = await fetch('/api/admin/leads/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'changeStatus',
          ids: Array.from(selectedLeads),
          emailStatus: newStatus,
        }),
      });

      if (response.ok) {
        setSelectedLeads(new Set());
        fetchLeads(currentPage);
      } else {
        const error = await response.json();
        alert(`Error: ${error.error || 'Failed to update leads'}`);
      }
    } catch (error) {
      console.error('Error updating leads:', error);
      alert('An error occurred while updating leads');
    } finally {
      setBulkActionLoading(false);
    }
  };

  const handleOpenAddModal = () => {
    setEditingLead(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (lead: Lead) => {
    setEditingLead(lead);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingLead(null);
  };

  const handleModalSuccess = () => {
    fetchLeads(currentPage);
  };

  const handleCsvUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Reset previous results
    setUploadResult(null);
    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/admin/leads/import', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (response.ok) {
        setUploadResult(result);
        fetchLeads(currentPage); // Refresh the list
      } else {
        alert(`Upload failed: ${result.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error uploading CSV:', error);
      alert('An error occurred while uploading the file');
    } finally {
      setIsUploading(false);
      // Reset the input so the same file can be uploaded again
      event.target.value = '';
    }
  };

  const handleCsvButtonClick = () => {
    document.getElementById('csv-upload-input')?.click();
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
    <div className="min-h-screen flex flex-col">
      <main className="flex-1 container mx-auto px-4 py-6 md:py-8">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 mb-6 md:mb-8">
          <div>
            <h1 className="text-2xl md:text-4xl font-bold">Leads Management</h1>
            <p className="text-gray-600 mt-1 md:mt-2 text-sm md:text-base">
              Manage email marketing campaign leads
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
            <button className="btn btn-primary btn-sm" onClick={handleOpenAddModal}>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5 mr-1"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"
                  clipRule="evenodd"
                />
              </svg>
              Add Lead
            </button>
            <button
              className="btn btn-secondary btn-sm"
              onClick={handleCsvButtonClick}
              disabled={isUploading}
            >
              {isUploading ? (
                <>
                  <span className="loading loading-spinner loading-xs"></span>
                  Uploading...
                </>
              ) : (
                <>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5 mr-1"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                  Upload CSV
                </>
              )}
            </button>
            <input
              id="csv-upload-input"
              type="file"
              accept=".csv"
              onChange={handleCsvUpload}
              className="hidden"
            />
            <div className="text-xs md:text-sm text-gray-500">
              {pagination && `${pagination.totalCount} total leads`}
            </div>
          </div>
        </div>

        {/* Upload Result Banner */}
        {uploadResult && (
          <div className="alert alert-success mb-6">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="stroke-current shrink-0 h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <div>
              <h3 className="font-bold">CSV Upload Complete</h3>
              <div className="text-sm">
                {uploadResult.success} leads imported successfully
                {uploadResult.duplicates > 0 && ` • ${uploadResult.duplicates} duplicates skipped`}
                {uploadResult.errors.length > 0 && (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-warning">
                      {uploadResult.errors.length} errors occurred
                    </summary>
                    <ul className="list-disc list-inside mt-1">
                      {uploadResult.errors.slice(0, 5).map((error, idx) => (
                        <li key={idx}>{error}</li>
                      ))}
                      {uploadResult.errors.length > 5 && (
                        <li>...and {uploadResult.errors.length - 5} more</li>
                      )}
                    </ul>
                  </details>
                )}
              </div>
            </div>
            <button
              className="btn btn-sm btn-ghost"
              onClick={() => setUploadResult(null)}
              aria-label="Close"
            >
              ✕
            </button>
          </div>
        )}

        {/* Search and Filter Controls */}
        <div className="bg-base-100 p-4 md:p-6 rounded-lg shadow-sm mb-6">
          <div className="flex flex-col gap-3 md:gap-4">
            {/* Search bar */}
            <div className="flex-1">
              <input
                type="text"
                placeholder="Search by name, email, or phone..."
                className="input input-bordered w-full"
                value={searchTerm}
                onChange={(e) => handleSearch(e.target.value)}
              />
            </div>

            {/* Filters and Sort */}
            <div className="flex flex-wrap gap-2">
              <select
                className="select select-bordered"
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setCurrentPage(1);
                }}
              >
                <option value="all">All Statuses</option>
                <option value="ready">Ready</option>
                <option value="sent">Sent</option>
                <option value="open">Opened</option>
                <option value="click">Clicked</option>
                <option value="soft_bounce">Soft Bounce</option>
                <option value="hard_bounce">Hard Bounce</option>
                <option value="unsub">Unsubscribed</option>
              </select>

              <select
                className="select select-bordered"
                value={languageFilter}
                onChange={(e) => {
                  setLanguageFilter(e.target.value);
                  setCurrentPage(1);
                }}
              >
                <option value="all">All Languages</option>
                <option value="pt-PT">Portuguese (PT)</option>
                <option value="es-ES">Spanish (ES)</option>
                <option value="en-US">English (US)</option>
                <option value="fr-FR">French (FR)</option>
              </select>

              <select
                className="select select-bordered"
                value={sortField}
                onChange={(e) => setSortField(e.target.value as SortField)}
              >
                <option value="lastUpdatedAt">Last Updated</option>
                <option value="lastEmailSentAt">Last Email Sent</option>
                <option value="name">Name</option>
                <option value="email">Email</option>
                <option value="language">Language</option>
                <option value="emailStatus">Status</option>
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

        {/* Bulk Actions */}
        {selectedLeads.size > 0 && (
          <div className="bg-primary/10 p-4 rounded-lg mb-6 flex flex-wrap items-center gap-3">
            <span className="font-medium">{selectedLeads.size} selected</span>
            <div className="flex gap-2 flex-wrap">
              <button
                className="btn btn-sm btn-error"
                onClick={handleBulkDelete}
                disabled={bulkActionLoading}
              >
                {bulkActionLoading ? 'Deleting...' : 'Delete Selected'}
              </button>
              <div className="dropdown">
                <label
                  tabIndex={0}
                  className={`btn btn-sm btn-outline ${bulkActionLoading ? 'btn-disabled' : ''}`}
                >
                  Change Status
                </label>
                <ul
                  tabIndex={0}
                  className="dropdown-content z-[1] menu p-2 shadow bg-base-100 rounded-box w-52"
                >
                  <li>
                    <button onClick={() => handleBulkChangeStatus('ready')}>Mark as Ready</button>
                  </li>
                  <li>
                    <button onClick={() => handleBulkChangeStatus('unsub')}>
                      Mark as Unsubscribed
                    </button>
                  </li>
                </ul>
              </div>
              <button
                className="btn btn-sm btn-ghost"
                onClick={() => setSelectedLeads(new Set())}
                disabled={bulkActionLoading}
              >
                Clear Selection
              </button>
            </div>
          </div>
        )}

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
                    <th>
                      <input
                        type="checkbox"
                        className="checkbox"
                        checked={selectedLeads.size === leads.length && leads.length > 0}
                        onChange={handleSelectAll}
                      />
                    </th>
                    <th
                      className="cursor-pointer hover:bg-base-200"
                      onClick={() => handleSort('name')}
                    >
                      Name {sortField === 'name' && (sortOrder === 'asc' ? '↑' : '↓')}
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
                      onClick={() => handleSort('language')}
                    >
                      Language {sortField === 'language' && (sortOrder === 'asc' ? '↑' : '↓')}
                    </th>
                    <th
                      className="cursor-pointer hover:bg-base-200"
                      onClick={() => handleSort('emailStatus')}
                    >
                      Status {sortField === 'emailStatus' && (sortOrder === 'asc' ? '↑' : '↓')}
                    </th>
                    <th
                      className="cursor-pointer hover:bg-base-200"
                      onClick={() => handleSort('lastEmailSentAt')}
                    >
                      Last Email Sent{' '}
                      {sortField === 'lastEmailSentAt' && (sortOrder === 'asc' ? '↑' : '↓')}
                    </th>
                    <th
                      className="cursor-pointer hover:bg-base-200"
                      onClick={() => handleSort('lastUpdatedAt')}
                    >
                      Last Updated{' '}
                      {sortField === 'lastUpdatedAt' && (sortOrder === 'asc' ? '↑' : '↓')}
                    </th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {leads.map((lead) => (
                    <tr key={lead.id} className="hover:bg-base-50">
                      <td>
                        <input
                          type="checkbox"
                          className="checkbox"
                          checked={selectedLeads.has(lead.id)}
                          onChange={() => handleSelectLead(lead.id)}
                        />
                      </td>
                      <td>
                        <div className="font-medium">
                          {lead.name || <span className="text-gray-400">—</span>}
                        </div>
                      </td>
                      <td>
                        <div className="text-sm opacity-70">{lead.email}</div>
                      </td>
                      <td>
                        <div className="text-sm">
                          {lead.mobilePhone || <span className="text-gray-400">—</span>}
                        </div>
                      </td>
                      <td>
                        <div className="text-sm">{lead.language}</div>
                      </td>
                      <td>
                        <span className={`badge badge-sm ${EMAIL_STATUS_COLORS[lead.emailStatus]}`}>
                          {EMAIL_STATUS_LABELS[lead.emailStatus]}
                        </span>
                      </td>
                      <td>
                        <div className="text-sm">
                          {lead.lastEmailSentAt ? (
                            formatLeadsDate(lead.lastEmailSentAt)
                          ) : (
                            <span className="text-gray-400">Never</span>
                          )}
                        </div>
                      </td>
                      <td>
                        <div className="text-sm">
                          {lead.lastUpdatedAt ? (
                            formatLeadsDate(lead.lastUpdatedAt)
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </div>
                      </td>
                      <td>
                        <button
                          className="btn btn-sm btn-outline"
                          onClick={() => handleOpenEditModal(lead)}
                        >
                          Edit
                        </button>
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

      {/* Lead Add/Edit Modal */}
      <LeadModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onSuccess={handleModalSuccess}
        lead={editingLead}
      />
    </div>
  );
}
