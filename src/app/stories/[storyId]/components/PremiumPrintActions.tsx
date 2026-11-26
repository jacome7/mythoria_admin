'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  premiumPrintStatus,
  type PremiumPrintPart,
  type PremiumPrintStatus,
} from '@/lib/premium-print';

const partLabels: Record<PremiumPrintPart, string> = {
  interior: 'Download RGB interior',
  cover: 'Download RGB cover',
  interiorCmyk: 'Download CMYK interior',
  coverCmyk: 'Download CMYK cover',
};

export function PremiumPrintActions({ storyId, revision }: { storyId: string; revision: string }) {
  const path = `/api/admin/stories/${storyId}/premium-print`;
  const query = `?revision=${revision}`;
  const [status, setStatus] = useState<PremiumPrintStatus>();
  const [error, setError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);
  const active = status?.status === 'queued' || status?.status === 'running';
  const rgbOnly = status?.status === 'ready' && status.parts.length < 4;

  const load = useCallback(
    async (signal?: AbortSignal, method = 'GET') => {
      try {
        const response = await fetch(`${path}${query}`, { method, cache: 'no-store', signal });
        const result = await response.json().catch(() => null);
        if (signal?.aborted) return;
        if (!response.ok) {
          if (response.status === 404 || response.status === 409) setStatus(undefined);
          throw new Error(result?.error ?? 'The PDF export is temporarily unavailable.');
        }
        const next = premiumPrintStatus.parse(result?.data);
        setStatus(next);
        setError(undefined);
      } catch (error) {
        if (signal?.aborted) return;
        setError(
          error instanceof Error ? error.message : 'The PDF export is temporarily unavailable.',
        );
      }
    },
    [path, query],
  );

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  useEffect(() => {
    if (!active) return;
    let controller: AbortController | undefined;
    const timer = setInterval(() => {
      if (controller) return;
      controller = new AbortController();
      void load(controller.signal).finally(() => {
        controller = undefined;
      });
    }, 5000);
    return () => {
      clearInterval(timer);
      controller?.abort();
    };
  }, [active, load]);

  async function generate() {
    if (submitting) return;
    setSubmitting(true);
    setError(undefined);
    try {
      await load(undefined, 'POST');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-2 rounded-lg border border-base-300 p-3">
      <h3 className="font-semibold">Download print PDFs</h3>
      {error && (
        <p className="text-sm text-error" role="alert">
          {error}
        </p>
      )}
      {!status && !error && (
        <p role="status" className="text-sm">
          Checking for PDFs…
        </p>
      )}
      {!status && error && (
        <button type="button" className="btn btn-outline btn-sm" onClick={() => void load()}>
          Check again
        </button>
      )}
      {active && (
        <p role="status" className="text-sm">
          {status.status === 'queued' ? 'PDF export queued…' : 'Generating PDFs…'}
        </p>
      )}
      {status?.status === 'failed' && (
        <p role="status" className="text-sm">
          The PDF export stopped. You can retry it.
        </p>
      )}
      {(status?.status === 'missing' || status?.status === 'failed' || rgbOnly) && (
        <button
          type="button"
          className="btn btn-outline btn-sm"
          disabled={submitting}
          onClick={() => void generate()}
        >
          {submitting
            ? 'Starting…'
            : status.status === 'failed'
              ? 'Retry PDF export'
              : rgbOnly
                ? 'Generate full PDF set'
                : 'Generate PDFs'}
        </button>
      )}
      {status?.status === 'ready' && (
        <div className="flex flex-wrap gap-2">
          {status.parts.map((part) => (
            <a
              key={part}
              className="btn btn-outline btn-sm"
              href={`${path}/${status.runId}/${part}${query}`}
            >
              {partLabels[part]}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
