'use client';

import { useState } from 'react';
import { 
  FaPlay, 
  FaTimes, 
  FaCheck, 
  FaClock, 
  FaRedo, 
  FaExclamationTriangle,
  FaUser,
  FaCalendarAlt,
  FaStopwatch
} from 'react-icons/fa';

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
  createdAt?: string;
  updatedAt?: string;
  metadata?: unknown;
}

interface WorkflowCardProps {
  workflow: WorkflowRun;
  onRetry: (runId: string) => Promise<void>;
}

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'running':
      return <FaPlay className="text-blue-500" />;
    case 'failed':
      return <FaTimes className="text-red-500" />;
    case 'completed':
      return <FaCheck className="text-green-500" />;
    default:
      return <FaClock className="text-gray-500" />;
  }
};

const getStatusColor = (status: string) => {
  switch (status) {
    case 'running':
      return 'badge-info';
    case 'failed':
      return 'badge-error';
    case 'completed':
      return 'badge-success';
    default:
      return 'badge-neutral';
  }
};

const formatDuration = (startTime: Date, endTime?: Date) => {
  const end = endTime || new Date();
  const duration = end.getTime() - startTime.getTime();
  const seconds = Math.floor(duration / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
};

const formatTimeAgo = (date: Date) => {
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  
  if (diffInSeconds < 60) {
    return `${diffInSeconds}s ago`;
  } else if (diffInSeconds < 3600) {
    return `${Math.floor(diffInSeconds / 60)}m ago`;
  } else if (diffInSeconds < 86400) {
    return `${Math.floor(diffInSeconds / 3600)}h ago`;
  } else {
    return `${Math.floor(diffInSeconds / 86400)}d ago`;
  }
};

export default function WorkflowCard({ workflow, onRetry }: WorkflowCardProps) {
  const [isRetrying, setIsRetrying] = useState(false);

  const handleRetry = async () => {
    setIsRetrying(true);
    try {
      await onRetry(workflow.run_id);
    } finally {
      setIsRetrying(false);
    }
  };

  return (
    <div className="card bg-base-100 shadow-md hover:shadow-lg transition-shadow">
      <div className="card-body">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="card-title text-lg">
            {workflow.story_title || 'Untitled Story'}
          </h3>
          <div className="flex items-center gap-3">
            <div className={`badge ${getStatusColor(workflow.status)} gap-2`}>
              {getStatusIcon(workflow.status)}
              <span className="capitalize">{workflow.status}</span>
            </div>
            {workflow.status === 'failed' && (
              <button
                className={`btn btn-sm btn-outline ${isRetrying ? 'loading' : ''}`}
                onClick={handleRetry}
                disabled={isRetrying}
              >
                {isRetrying ? (
                  <>
                    <span className="loading loading-spinner loading-xs"></span>
                    Retrying...
                  </>
                ) : (
                  <>
                    <FaRedo className="w-3 h-3" />
                    Retry
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Basic Info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm mb-4">
          <div className="flex items-center gap-2">
            <FaUser className="text-gray-500" />
            <span className="text-gray-600">User:</span>
            <span className="font-medium">{workflow.user_id || 'N/A'}</span>
          </div>
          
          <div className="flex items-center gap-2">
            <FaCalendarAlt className="text-gray-500" />
            <span className="text-gray-600">Started:</span>
            <span className="font-medium">
              {workflow.started_at ? formatTimeAgo(new Date(workflow.started_at)) : 'N/A'}
            </span>
          </div>
          
          <div className="flex items-center gap-2">
            <FaStopwatch className="text-gray-500" />
            <span className="text-gray-600">Duration:</span>
            <span className="font-medium">
              {workflow.started_at ? formatDuration(new Date(workflow.started_at), workflow.ended_at ? new Date(workflow.ended_at) : undefined) : 'N/A'}
            </span>
          </div>
          
          <div className="flex items-center gap-2">
            <span className="text-gray-600">Run ID:</span>
            <code className="text-xs bg-gray-100 px-2 py-1 rounded font-mono">
              {workflow.run_id}
            </code>
          </div>
        </div>

        {/* Story Details */}
        {workflow.story_details && (
          <div className="mb-4">
            <div className="divider my-2"></div>
            <h4 className="font-medium text-sm text-gray-700 mb-2">Story Details</h4>
            <div className="text-sm space-y-1">
              {workflow.story_details.genre && (
                <div>
                  <span className="text-gray-600">Genre:</span>
                  <span className="ml-2 font-medium">{workflow.story_details.genre}</span>
                </div>
              )}
              {workflow.story_details.target_audience && (
                <div>
                  <span className="text-gray-600">Audience:</span>
                  <span className="ml-2 font-medium">{workflow.story_details.target_audience}</span>
                </div>
              )}
              {workflow.story_details.length && (
                <div>
                  <span className="text-gray-600">Length:</span>
                  <span className="ml-2 font-medium">{workflow.story_details.length}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Error Message */}
        {workflow.status === 'failed' && workflow.error_message && (
          <div className="mb-4">
            <div className="divider my-2"></div>
            <div className="flex items-center gap-2 mb-2">
              <FaExclamationTriangle className="text-red-500" />
              <h4 className="font-medium text-sm text-red-700">Error Details</h4>
            </div>
            <div className="alert alert-error">
              <code className="text-sm whitespace-pre-wrap">
                {workflow.error_message}
              </code>
            </div>
          </div>
        )}

        {/* Current Step */}
        {workflow.current_step && (
          <div>
            <div className="divider my-2"></div>
            <h4 className="font-medium text-sm text-gray-700 mb-2">Current Step</h4>
            <div className="flex items-center gap-2">
              <div className="badge badge-outline badge-sm">
                {workflow.current_step}
              </div>
              {workflow.step_details && (
                <span className="text-sm text-gray-600">
                  {workflow.step_details.description || 'Processing...'}
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
