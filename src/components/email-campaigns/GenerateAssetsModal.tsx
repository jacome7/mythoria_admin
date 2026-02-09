'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { campaignClient } from '@/lib/campaignClient';
import { FiZap } from 'react-icons/fi';

const SUPPORTED_LOCALES = ['en-US', 'pt-PT', 'es-ES', 'fr-FR', 'de-DE'] as const;

const TEMPLATE_OPTIONS = [
  { value: 'default', label: 'Default Mythoria Template' },
  { value: 'story-launch', label: 'Story Launch (Hero Banner)' },
  { value: 'enchanted-scroll', label: 'Enchanted Scroll (Literary)' },
  { value: 'minimal-ink', label: 'Minimal Ink (Clean & Modern)' },
  { value: 'aurora-split', label: 'Aurora Split (Two-Column)' },
] as const;

interface GeneratedAssets {
  [locale: string]: { subject: string; htmlBody: string; textBody: string };
}

interface GenerateAssetsModalProps {
  campaignId: string;
  open: boolean;
  onClose: () => void;
  onComplete: (assets: GeneratedAssets) => void;
}

type ModalPhase = 'form' | 'generating' | 'completed' | 'error';

const POLL_INTERVAL_MS = 3000;

export default function GenerateAssetsModal({
  campaignId,
  open,
  onClose,
  onComplete,
}: GenerateAssetsModalProps) {
  // Form state
  const [sourceLocale, setSourceLocale] = useState<string>('en-US');
  const [subject, setSubject] = useState('');
  const [bodyDescription, setBodyDescription] = useState('');
  const [templateName, setTemplateName] = useState<string>(TEMPLATE_OPTIONS[0].value);
  const [formError, setFormError] = useState<string | null>(null);

  // Job state
  const [phase, setPhase] = useState<ModalPhase>('form');
  const [jobId, setJobId] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [jobError, setJobError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Clean up polling on unmount or close
  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => stopPolling();
  }, [stopPolling]);

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setPhase('form');
      setFormError(null);
      setJobError(null);
      setProgress(0);
      setJobId(null);
    } else {
      stopPolling();
    }
  }, [open, stopPolling]);

  async function handleSubmit() {
    setFormError(null);

    if (!sourceLocale) {
      setFormError('Please select a source locale.');
      return;
    }
    if (!subject.trim()) {
      setFormError('Please enter the email subject.');
      return;
    }
    if (!bodyDescription.trim()) {
      setFormError('Please describe the email body content.');
      return;
    }

    try {
      setPhase('generating');
      setProgress(0);

      const response = await campaignClient.generateAssets(campaignId, {
        sourceLocale,
        subject: subject.trim(),
        bodyDescription: bodyDescription.trim(),
        templateName,
      });

      if (!response.success || !response.jobId) {
        throw new Error('Failed to start generation job');
      }

      setJobId(response.jobId);
      startPolling(response.jobId);
    } catch (err) {
      setJobError(err instanceof Error ? err.message : 'Failed to start generation');
      setPhase('error');
    }
  }

  function startPolling(activeJobId: string) {
    stopPolling();

    pollRef.current = setInterval(async () => {
      try {
        const status = await campaignClient.getGenerateAssetsJobStatus(campaignId, activeJobId);

        if (!status.success || !status.job) {
          throw new Error('Failed to fetch job status');
        }

        const job = status.job;
        setProgress(Math.round(job.progress));

        if (job.status === 'completed' && job.result?.assets) {
          stopPolling();
          setPhase('completed');
          onComplete(job.result.assets);
        } else if (job.status === 'failed') {
          stopPolling();
          setJobError(job.error || 'Generation failed');
          setPhase('error');
        }
      } catch (err) {
        stopPolling();
        setJobError(err instanceof Error ? err.message : 'Lost connection to generation job');
        setPhase('error');
      }
    }, POLL_INTERVAL_MS);
  }

  function handleClose() {
    stopPolling();
    onClose();
  }

  if (!open) return null;

  return (
    <dialog className="modal modal-open">
      <div className="modal-box max-w-lg">
        <h3 className="font-bold text-lg flex items-center gap-2 mb-4">
          <FiZap className="text-warning" />
          Generate Email Assets with AI
        </h3>

        {/* ----------------------------------------------------------------- */}
        {/* Form phase */}
        {/* ----------------------------------------------------------------- */}
        {phase === 'form' && (
          <div className="space-y-4">
            {formError && (
              <div className="alert alert-error alert-sm py-2">
                <span className="text-sm">{formError}</span>
              </div>
            )}

            {/* Source Locale */}
            <div className="form-control">
              <label className="label py-1">
                <span className="label-text text-sm font-medium">Source Locale</span>
              </label>
              <select
                className="select select-bordered select-sm w-full"
                value={sourceLocale}
                onChange={(e) => setSourceLocale(e.target.value)}
              >
                {SUPPORTED_LOCALES.map((loc) => (
                  <option key={loc} value={loc}>
                    {loc}
                  </option>
                ))}
              </select>
              <label className="label py-0.5">
                <span className="label-text-alt text-base-content/60">
                  The locale of the subject and description you provide. Other locales will be
                  generated via translation.
                </span>
              </label>
            </div>

            {/* Subject */}
            <div className="form-control">
              <label className="label py-1">
                <span className="label-text text-sm font-medium">Email Subject</span>
              </label>
              <input
                type="text"
                className="input input-bordered input-sm w-full"
                placeholder="e.g., Your story awaits - a new chapter begins"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                maxLength={500}
              />
            </div>

            {/* Body Description */}
            <div className="form-control">
              <label className="label py-1">
                <span className="label-text text-sm font-medium">Email Body Description</span>
              </label>
              <textarea
                className="textarea textarea-bordered w-full text-sm"
                placeholder="Describe the email content, tone, and purpose. For example: A warm welcome email introducing Mythoria to new leads, highlighting the ability to create personalized stories, with a CTA button linking to the story creation page..."
                value={bodyDescription}
                onChange={(e) => setBodyDescription(e.target.value)}
                rows={5}
                maxLength={5000}
              />
              <label className="label py-0.5">
                <span className="label-text-alt text-base-content/60">
                  {bodyDescription.length}/5000
                </span>
              </label>
            </div>

            {/* Template */}
            <div className="form-control">
              <label className="label py-1">
                <span className="label-text text-sm font-medium">Email Template</span>
              </label>
              <select
                className="select select-bordered select-sm w-full"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
              >
                {TEMPLATE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <label className="label py-0.5">
                <span className="label-text-alt text-base-content/60">
                  The HTML structure and styling reference for the generated email.
                </span>
              </label>
            </div>

            <div className="modal-action">
              <button className="btn btn-ghost btn-sm" onClick={handleClose}>
                Cancel
              </button>
              <button className="btn btn-primary btn-sm" onClick={handleSubmit}>
                <FiZap /> Generate for All Locales
              </button>
            </div>
          </div>
        )}

        {/* ----------------------------------------------------------------- */}
        {/* Generating phase */}
        {/* ----------------------------------------------------------------- */}
        {phase === 'generating' && (
          <div className="space-y-4">
            <p className="text-sm text-base-content/70">
              AI is generating email assets for all {SUPPORTED_LOCALES.length} locales. This may
              take a few minutes...
            </p>

            <div className="flex items-center gap-3">
              <progress className="progress progress-primary w-full" value={progress} max={100} />
              <span className="text-sm font-mono whitespace-nowrap">{progress}%</span>
            </div>

            <div className="text-xs text-base-content/50 space-y-1">
              <p>
                Source locale: <span className="font-medium">{sourceLocale}</span>
              </p>
              <p>
                Target locales:{' '}
                <span className="font-medium">
                  {SUPPORTED_LOCALES.filter((l) => l !== sourceLocale).join(', ')}
                </span>
              </p>
              {jobId && (
                <p>
                  Job ID: <span className="font-mono">{jobId}</span>
                </p>
              )}
            </div>

            <div className="modal-action">
              <button className="btn btn-ghost btn-sm" onClick={handleClose}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* ----------------------------------------------------------------- */}
        {/* Completed phase */}
        {/* ----------------------------------------------------------------- */}
        {phase === 'completed' && (
          <div className="space-y-4">
            <div className="alert alert-success">
              <span className="text-sm">
                Email assets generated for all {SUPPORTED_LOCALES.length} locales. Review the
                content in each locale tab, then save.
              </span>
            </div>
            <div className="modal-action">
              <button className="btn btn-primary btn-sm" onClick={handleClose}>
                Close
              </button>
            </div>
          </div>
        )}

        {/* ----------------------------------------------------------------- */}
        {/* Error phase */}
        {/* ----------------------------------------------------------------- */}
        {phase === 'error' && (
          <div className="space-y-4">
            <div className="alert alert-error">
              <span className="text-sm">{jobError || 'An unexpected error occurred.'}</span>
            </div>
            <div className="modal-action">
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  setPhase('form');
                  setJobError(null);
                  setProgress(0);
                }}
              >
                Try Again
              </button>
              <button className="btn btn-sm" onClick={handleClose}>
                Close
              </button>
            </div>
          </div>
        )}
      </div>
      <form method="dialog" className="modal-backdrop">
        <button onClick={handleClose}>close</button>
      </form>
    </dialog>
  );
}
