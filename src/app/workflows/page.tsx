'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { redirect } from 'next/navigation';
import AdminHeader from '@/components/AdminHeader';
import AdminFooter from '@/components/AdminFooter';
import WorkflowsList from './components/WorkflowsList';

export default function WorkflowsPage() {
  const { data: session, status } = useSession();
  const [activeTab, setActiveTab] = useState<'running' | 'failed' | 'completed'>('running');
  const [workflowCounts, setWorkflowCounts] = useState({
    running: 0,
    failed: 0,
    completed: 0,
  });
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [syncStatus, setSyncStatus] = useState<{
    needsSync: number;
    stale: number;
    statusMismatch: number;
  } | null>(null);

  // Load workflow counts for tabs
  useEffect(() => {
    const loadWorkflowCounts = async () => {
      try {
        const [runningRes, failedRes, completedRes] = await Promise.all([
          fetch('/api/workflows?status=running&limit=1'),
          fetch('/api/workflows?status=failed&limit=1'),
          fetch('/api/workflows?status=completed&limit=1'),
        ]);

        const [runningData, failedData, completedData] = await Promise.all([
          runningRes.json(),
          failedRes.json(),
          completedRes.json(),
        ]);

        setWorkflowCounts({
          running: runningData.pagination?.totalItems || 0,
          failed: failedData.pagination?.totalItems || 0,
          completed: completedData.pagination?.totalItems || 0,
        });
      } catch (error) {
        console.error('Error loading workflow counts:', error);
      }
    };

    if (session) {
      loadWorkflowCounts();
    }
  }, [session]);

  // Check sync status
  const checkSyncStatus = async () => {
    try {
      const response = await fetch('/api/admin/workflows?action=status');
      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          setSyncStatus(result.summary);
        }
      }
    } catch (error) {
      console.error('Error checking sync status:', error);
    }
  };

  // Check sync status when component mounts
  useEffect(() => {
    if (session) {
      checkSyncStatus();
    }
  }, [session]);

  // Sync workflow statuses
  const handleSyncWorkflows = async () => {
    setIsSyncing(true);
    setSyncMessage(null);
    
    try {
      const response = await fetch('/api/admin/workflows?action=sync-all', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to sync workflows');
      }

      const result = await response.json();
      
      if (result.success) {
        const { summary } = result;
        const syncedCount = summary.completed + summary.failed + summary.cancelled;
        
        if (syncedCount > 0) {
          setSyncMessage(`Successfully synced ${syncedCount} workflows: ${summary.completed} completed, ${summary.failed} failed, ${summary.cancelled} cancelled`);
        } else {
          setSyncMessage('All workflows are already in sync');
        }
        
        // Reload workflow counts to reflect changes
        const [runningRes, failedRes, completedRes] = await Promise.all([
          fetch('/api/workflows?status=running&limit=1'),
          fetch('/api/workflows?status=failed&limit=1'),
          fetch('/api/workflows?status=completed&limit=1'),
        ]);

        const [runningData, failedData, completedData] = await Promise.all([
          runningRes.json(),
          failedRes.json(),
          completedRes.json(),
        ]);

        setWorkflowCounts({
          running: runningData.pagination?.totalItems || 0,
          failed: failedData.pagination?.totalItems || 0,
          completed: completedData.pagination?.totalItems || 0,
        });
        
        // Trigger refresh of workflows list
        setRefreshTrigger(prev => prev + 1);
        
        // Re-check sync status
        checkSyncStatus();
      } else {
        setSyncMessage('Failed to sync workflows: ' + result.error);
      }
    } catch (error) {
      console.error('Error syncing workflows:', error);
      setSyncMessage('Error syncing workflows: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setIsSyncing(false);
    }
  };

  // Redirect to login if not authenticated
  if (status === 'loading') {
    return <div className="flex justify-center items-center min-h-screen">Loading...</div>;
  }

  if (!session) {
    redirect('/');
  }

  return (
    <div className="min-h-screen bg-base-200">
      <AdminHeader />
      
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h1 className="text-3xl font-bold mb-2">Workflow Management</h1>
              <p className="text-base-content/70">Monitor and manage story generation workflows</p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <button
                onClick={handleSyncWorkflows}
                disabled={isSyncing}
                className={`btn ${syncStatus?.needsSync && syncStatus.needsSync > 0 ? 'btn-warning' : 'btn-primary'}`}
              >
                {isSyncing ? (
                  <>
                    <span className="loading loading-spinner loading-sm"></span>
                    Syncing...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Sync Workflows
                    {syncStatus?.needsSync && syncStatus.needsSync > 0 && (
                      <span className="badge badge-error ml-1">{syncStatus.needsSync}</span>
                    )}
                  </>
                )}
              </button>
              {syncStatus?.needsSync && syncStatus.needsSync > 0 && (
                <div className="text-xs text-warning">
                  {syncStatus.needsSync} workflows need sync
                </div>
              )}
              {syncMessage && (
                <div className={`text-sm p-2 rounded max-w-md ${
                  syncMessage.includes('Error') || syncMessage.includes('Failed') 
                    ? 'bg-error/20 text-error' 
                    : 'bg-success/20 text-success'
                }`}>
                  {syncMessage}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="tabs tabs-lifted mb-6">
          <a
            className={`tab tab-lifted ${activeTab === 'running' ? 'tab-active' : ''}`}
            onClick={() => setActiveTab('running')}
          >
            Running
            {workflowCounts.running > 0 && (
              <span className="badge badge-primary ml-2">{workflowCounts.running}</span>
            )}
          </a>
          <a
            className={`tab tab-lifted ${activeTab === 'failed' ? 'tab-active' : ''}`}
            onClick={() => setActiveTab('failed')}
          >
            Failed
            {workflowCounts.failed > 0 && (
              <span className="badge badge-error ml-2">{workflowCounts.failed}</span>
            )}
          </a>
          <a
            className={`tab tab-lifted ${activeTab === 'completed' ? 'tab-active' : ''}`}
            onClick={() => setActiveTab('completed')}
          >
            Completed
            {workflowCounts.completed > 0 && (
              <span className="badge badge-success ml-2">{workflowCounts.completed}</span>
            )}
          </a>
        </div>

        {/* Workflows List */}
        <div className="bg-base-100 rounded-lg shadow-sm">
          <WorkflowsList status={activeTab} refreshTrigger={refreshTrigger} />
        </div>
      </div>

      <AdminFooter />
    </div>
  );
}
