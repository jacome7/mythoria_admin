/**
 * Workflow Monitoring Service
 * Monitors Google Workflows execution status and synchronizes with database
 */

import { ExecutionsClient } from '@google-cloud/workflows';
import { getWorkflowsDb } from '@/db';
import { storyGenerationRuns } from '@/db/schema/workflows/story-generation';
import { eq, and, lt } from 'drizzle-orm';

export interface WorkflowExecutionStatus {
  runId: string;
  storyId: string;
  workflowExecutionName: string | null;
  currentDbStatus: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
  workflowStatus: 'ACTIVE' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED' | 'UNKNOWN';
  statusMatch: boolean;
  lastHeartbeat: Date | null;
  isStale: boolean;
  errorMessage?: string;
}

export interface WorkflowSyncResult {
  runId: string;
  previousStatus: string;
  newStatus: string;
  workflowExecutionName: string | null;
  syncReason: 'workflow_completed' | 'workflow_failed' | 'workflow_cancelled' | 'stale_timeout' | 'manual_sync';
  errorMessage?: string;
}

export class WorkflowMonitorService {
  private readonly executionsClient: ExecutionsClient;
  private readonly PROJECT_ID = 'oceanic-beach-460916-n5';
  private readonly LOCATION = 'europe-west9';
  private readonly WORKFLOW_NAME = 'story-generation';
  private readonly STALE_TIMEOUT_HOURS = 6; // Mark as stale after 6 hours without updates

  constructor() {
    this.executionsClient = new ExecutionsClient();
  }

  /**
   * Get workflow execution status from Google Workflows
   */
  private async getWorkflowExecutionStatus(executionName: string): Promise<'ACTIVE' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED' | 'UNKNOWN'> {
    try {
      const [execution] = await this.executionsClient.getExecution({
        name: executionName
      });

      // Map Google Workflow states to our status enum
      switch (execution.state) {
        case 'ACTIVE':
          return 'ACTIVE';
        case 'SUCCEEDED':
          return 'SUCCEEDED';
        case 'FAILED':
          return 'FAILED';
        case 'CANCELLED':
          return 'CANCELLED';
        default:
          console.warn('Unknown workflow execution state', { 
            executionName, 
            state: execution.state 
          });
          return 'UNKNOWN';
      }
    } catch (error) {
      console.error('Failed to get workflow execution status', {
        executionName,
        error: error instanceof Error ? error.message : String(error)
      });
      return 'UNKNOWN';
    }
  }

  /**
   * Check status of all running workflow runs
   */
  async checkAllRunningWorkflows(): Promise<WorkflowExecutionStatus[]> {
    const db = getWorkflowsDb();
    const statusResults: WorkflowExecutionStatus[] = [];

    try {
      // Get all workflow runs that are marked as running in the database
      const runningRuns = await db
        .select()
        .from(storyGenerationRuns)
        .where(eq(storyGenerationRuns.status, 'running'));

      console.log('Checking status of running workflow runs', {
        count: runningRuns.length
      });

      for (const run of runningRuns) {
        const status = await this.checkWorkflowRunStatus(run.runId);
        statusResults.push(status);
      }

      return statusResults;
    } catch (error) {
      console.error('Failed to check running workflows', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Check status of a specific workflow run
   */
  async checkWorkflowRunStatus(runId: string): Promise<WorkflowExecutionStatus> {
    const db = getWorkflowsDb();

    try {
      // Get the workflow run from database
      const [run] = await db
        .select()
        .from(storyGenerationRuns)
        .where(eq(storyGenerationRuns.runId, runId));

      if (!run) {
        throw new Error(`Workflow run not found: ${runId}`);
      }

      const now = new Date();
      const updatedAt = new Date(run.updatedAt);
      const hoursStale = (now.getTime() - updatedAt.getTime()) / (1000 * 60 * 60);
      const isStale = hoursStale > this.STALE_TIMEOUT_HOURS;

      const status: WorkflowExecutionStatus = {
        runId: run.runId,
        storyId: run.storyId,
        workflowExecutionName: run.gcpWorkflowExecution,
        currentDbStatus: run.status,
        workflowStatus: 'UNKNOWN',
        statusMatch: false,
        lastHeartbeat: new Date(run.updatedAt),
        isStale,
        errorMessage: run.errorMessage || undefined
      };

      // If we have a GCP workflow execution name, check its status
      if (run.gcpWorkflowExecution) {
        status.workflowStatus = await this.getWorkflowExecutionStatus(run.gcpWorkflowExecution);
        
        // Check if statuses match
        status.statusMatch = this.doStatusesMatch(status.currentDbStatus, status.workflowStatus);
      } else {
        // No GCP execution name - this is problematic for running workflows
        console.warn('Running workflow has no GCP execution name', { runId });
        status.workflowStatus = 'UNKNOWN';
        status.statusMatch = false;
      }

      return status;
    } catch (error) {
      console.error('Failed to check workflow run status', {
        runId,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Check if database status matches workflow status
   */
  private doStatusesMatch(dbStatus: string, workflowStatus: string): boolean {
    const statusMapping: Record<string, string[]> = {
      'running': ['ACTIVE'],
      'completed': ['SUCCEEDED'],
      'failed': ['FAILED'],
      'cancelled': ['CANCELLED'],
      'queued': [] // Queued jobs shouldn't have a workflow execution yet
    };

    return statusMapping[dbStatus]?.includes(workflowStatus) || false;
  }

  /**
   * Synchronize workflow status with database
   */
  async syncWorkflowStatus(runId: string, reason: WorkflowSyncResult['syncReason'] = 'manual_sync'): Promise<WorkflowSyncResult> {
    const db = getWorkflowsDb();
    const status = await this.checkWorkflowRunStatus(runId);

    try {
      let newStatus: string;
      let errorMessage: string | undefined;

      // Handle workflows without GCP execution name
      if (!status.workflowExecutionName && status.currentDbStatus === 'running') {
        newStatus = 'failed';
        errorMessage = 'Workflow marked as failed - no Google Workflow execution found';
        reason = 'manual_sync';
      }
      // Determine the new status based on workflow state
      else if (status.isStale && status.currentDbStatus === 'running') {
        newStatus = 'failed';
        errorMessage = `Workflow marked as failed due to stale timeout (${this.STALE_TIMEOUT_HOURS} hours without updates)`;
        reason = 'stale_timeout';
      } else if (status.workflowStatus === 'SUCCEEDED') {
        newStatus = 'completed';
        reason = 'workflow_completed';
      } else if (status.workflowStatus === 'FAILED') {
        newStatus = 'failed';
        errorMessage = 'Workflow execution failed in Google Workflows';
        reason = 'workflow_failed';
      } else if (status.workflowStatus === 'CANCELLED') {
        newStatus = 'cancelled';
        reason = 'workflow_cancelled';
      } else {
        // No sync needed
        return {
          runId,
          previousStatus: status.currentDbStatus,
          newStatus: status.currentDbStatus,
          workflowExecutionName: status.workflowExecutionName,
          syncReason: reason
        };
      }

      // Update the database
      const updateData: {
        status: "queued" | "running" | "completed" | "failed" | "cancelled";
        updatedAt: string;
        errorMessage?: string;
        endedAt?: string;
      } = {
        status: newStatus as "queued" | "running" | "completed" | "failed" | "cancelled",
        updatedAt: new Date().toISOString(),
      };

      if (errorMessage) {
        updateData.errorMessage = errorMessage;
      }

      if (newStatus === 'completed' || newStatus === 'failed' || newStatus === 'cancelled') {
        updateData.endedAt = new Date().toISOString();
      }

      await db
        .update(storyGenerationRuns)
        .set(updateData)
        .where(eq(storyGenerationRuns.runId, runId));

      console.log('Workflow status synchronized', {
        runId,
        previousStatus: status.currentDbStatus,
        newStatus,
        workflowExecutionName: status.workflowExecutionName,
        syncReason: reason
      });

      return {
        runId,
        previousStatus: status.currentDbStatus,
        newStatus,
        workflowExecutionName: status.workflowExecutionName,
        syncReason: reason,
        errorMessage
      };

    } catch (error) {
      console.error('Failed to sync workflow status', {
        runId,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Sync all workflow runs that have status mismatches
   */
  async syncAllWorkflows(): Promise<WorkflowSyncResult[]> {
    const allStatuses = await this.checkAllRunningWorkflows();
    const syncResults: WorkflowSyncResult[] = [];

    for (const status of allStatuses) {
      if (!status.statusMatch || status.isStale) {
        try {
          const result = await this.syncWorkflowStatus(status.runId);
          syncResults.push(result);
        } catch (error) {
          console.error('Failed to sync workflow', {
            runId: status.runId,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }
    }

    return syncResults;
  }

  /**
   * Get workflow execution logs from Google Workflows
   */
  async getWorkflowLogs(runId: string): Promise<unknown[]> {
    const db = getWorkflowsDb();

    try {
      const [run] = await db
        .select()
        .from(storyGenerationRuns)
        .where(eq(storyGenerationRuns.runId, runId));

      if (!run || !run.gcpWorkflowExecution) {
        return [];
      }

      // Get execution details with steps
      const [execution] = await this.executionsClient.getExecution({
        name: run.gcpWorkflowExecution
      });

      // Return execution info - steps are available in the execution object
      return [{
        state: execution.state,
        result: execution.result,
        error: execution.error,
        startTime: execution.startTime,
        endTime: execution.endTime
      }];
    } catch (error) {
      console.error('Failed to get workflow logs', {
        runId,
        error: error instanceof Error ? error.message : String(error)
      });
      return [];
    }
  }

  /**
   * Get workflow execution logs for a specific run
   */
  async getWorkflowExecutionLogs(runId: string): Promise<{
    executionName: string;
    state: string;
    startTime: unknown;
    endTime: unknown;
    result: unknown;
    error: unknown;
    workflowRevisionId: string;
    callLogLevel: string;
  }> {
    const db = getWorkflowsDb();

    try {
      // Get the workflow run from database
      const [run] = await db
        .select()
        .from(storyGenerationRuns)
        .where(eq(storyGenerationRuns.runId, runId));

      if (!run) {
        throw new Error(`Workflow run not found: ${runId}`);
      }

      if (!run.gcpWorkflowExecution) {
        throw new Error('No workflow execution found for this run');
      }

      const [execution] = await this.executionsClient.getExecution({
        name: run.gcpWorkflowExecution
      });

      return {
        executionName: run.gcpWorkflowExecution,
        state: String(execution.state || 'UNKNOWN'),
        startTime: execution.startTime,
        endTime: execution.endTime,
        result: execution.result,
        error: execution.error,
        workflowRevisionId: String(execution.workflowRevisionId || ''),
        callLogLevel: String(execution.callLogLevel || 'None')
      };
    } catch (error) {
      console.error('Failed to get workflow execution logs', {
        runId,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Clean up stale workflow runs
   */
  async cleanupStaleWorkflows(): Promise<WorkflowSyncResult[]> {
    const db = getWorkflowsDb();
    const cutoffTime = new Date(Date.now() - this.STALE_TIMEOUT_HOURS * 60 * 60 * 1000);

    try {
      // Find stale running workflows
      const staleRuns = await db
        .select()
        .from(storyGenerationRuns)
        .where(
          and(
            eq(storyGenerationRuns.status, 'running'),
            lt(storyGenerationRuns.updatedAt, cutoffTime.toISOString())
          )
        );

      console.log('Cleaning up stale workflow runs', {
        count: staleRuns.length,
        cutoffTime
      });

      const cleanupResults: WorkflowSyncResult[] = [];

      for (const run of staleRuns) {
        try {
          const result = await this.syncWorkflowStatus(run.runId, 'stale_timeout');
          cleanupResults.push(result);
        } catch (error) {
          console.error('Failed to clean up stale workflow', {
            runId: run.runId,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }

      return cleanupResults;
    } catch (error) {
      console.error('Failed to cleanup stale workflows', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Force mark a workflow run as failed
   * Useful for stuck workflows that need manual intervention
   */
  async forceMarkAsFailed(runId: string, reason: string): Promise<WorkflowSyncResult> {
    const db = getWorkflowsDb();

    try {
      // Get the current workflow run
      const [run] = await db
        .select()
        .from(storyGenerationRuns)
        .where(eq(storyGenerationRuns.runId, runId));

      if (!run) {
        throw new Error(`Workflow run not found: ${runId}`);
      }

      const previousStatus = run.status;

      // Update the database
      await db
        .update(storyGenerationRuns)
        .set({
          status: 'failed',
          errorMessage: reason,
          endedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        })
        .where(eq(storyGenerationRuns.runId, runId));

      console.log('Workflow run force marked as failed', {
        runId,
        previousStatus,
        reason
      });

      return {
        runId,
        previousStatus,
        newStatus: 'failed',
        workflowExecutionName: run.gcpWorkflowExecution,
        syncReason: 'manual_sync',
        errorMessage: reason
      };
    } catch (error) {
      console.error('Failed to force mark workflow as failed', {
        runId,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }
}

export const workflowMonitor = new WorkflowMonitorService();
