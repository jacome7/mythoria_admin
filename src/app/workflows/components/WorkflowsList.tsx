'use client';

import { useState, useEffect, useCallback } from 'react';
import WorkflowCard from './WorkflowCard';

interface StoryDetails {
  genre?: string;
  target_audience?: string;
  length?: string;
}

interface StepDetails {
  description?: string;
}

interface WorkflowRun {
  run_id: string;
  story_id: string;
  status: string;
  started_at: string | null;
  ended_at?: string | null;
  user_id?: string;
  error_message?: string;
  current_step?: string;
  step_details?: StepDetails;
  story_title?: string;
  story_details?: StoryDetails;
  gcpWorkflowExecution?: string;
  authorName?: string;
  authorEmail?: string;
  createdAt: string;
  updatedAt: string;
  metadata?: unknown;
}

interface WorkflowsListProps {
  status: 'running' | 'failed' | 'completed';
  refreshTrigger?: number; // Add refresh trigger prop
}

export default function WorkflowsList({ status, refreshTrigger }: WorkflowsListProps) {
  const [workflows, setWorkflows] = useState<WorkflowRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');

  const loadWorkflows = useCallback(async (page: number = 1, search: string = '') => {
    try {
      setLoading(true);
      setError(null);
      
      const params = new URLSearchParams({
        status,
        page: page.toString(),
        limit: '20',
        ...(search && { search }),
      });

      const response = await fetch(`/api/workflows?${params}`);
      
      if (!response.ok) {
        throw new Error('Failed to load workflows');
      }

      const data = await response.json();
      
      setWorkflows(data.workflows || []);
      setTotalPages(data.pagination?.totalPages || 1);
      setCurrentPage(page);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, [status]);

  // Load workflows when status changes
  useEffect(() => {
    loadWorkflows(1, searchTerm);
  }, [status, loadWorkflows, searchTerm]);

  // Refresh workflows when refreshTrigger changes
  useEffect(() => {
    if (refreshTrigger) {
      loadWorkflows(currentPage, searchTerm);
    }
  }, [refreshTrigger, loadWorkflows, currentPage, searchTerm]);

  // Handle search
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    loadWorkflows(1, searchTerm);
  };

  // Handle page change
  const handlePageChange = (page: number) => {
    loadWorkflows(page, searchTerm);
  };

  // Handle workflow retry
  const handleRetry = async (runId: string) => {
    try {
      const response = await fetch(`/api/workflows/${runId}/retry`, {
        method: 'POST',
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to retry workflow');
      }
      
      const result = await response.json();
      
      // Show success message
      console.log('Workflow retry successful:', result.message);
      
      // Refresh the list after successful retry
      loadWorkflows(currentPage, searchTerm);
    } catch (err) {
      console.error('Error retrying workflow:', err);
      // You might want to show a toast notification here
      alert(`Failed to retry workflow: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center p-8">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="alert alert-error">
        <svg className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span>Error loading workflows: {error}</span>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Search */}
      <form onSubmit={handleSearch} className="mb-6">
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Search by story title..."
            className="input input-bordered flex-1"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <button type="submit" className="btn btn-primary">
            Search
          </button>
        </div>
      </form>

      {/* Workflows List */}
      {workflows.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">🚀</div>
          <h3 className="text-xl font-semibold mb-2">No {status} workflows found</h3>
          <p className="text-base-content/70">
            {searchTerm 
              ? `No workflows found matching "${searchTerm}"`
              : `No workflows are currently ${status}`
            }
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {workflows.map((workflow) => (
            <WorkflowCard
              key={workflow.run_id}
              workflow={workflow}
              onRetry={handleRetry}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center mt-8">
          <div className="join">
            <button
              className="join-item btn"
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
            >
              «
            </button>
            
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
              <button
                key={`page-${page}`}
                className={`join-item btn ${page === currentPage ? 'btn-active' : ''}`}
                onClick={() => handlePageChange(page)}
              >
                {page}
              </button>
            ))}
            
            <button
              className="join-item btn"
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
            >
              »
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
