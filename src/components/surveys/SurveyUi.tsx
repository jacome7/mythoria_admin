'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { FiAlertTriangle, FiInfo, FiLock } from 'react-icons/fi';
import type { Rate } from '@/lib/surveys/analytics-compute';
import { fmtInt, fmtPct } from './format';

export function NotTrackedBadge({
  label = 'not tracked',
  hint,
}: {
  label?: string;
  hint?: string;
}) {
  return (
    <span className="badge badge-ghost badge-sm whitespace-nowrap" title={hint}>
      {label}
    </span>
  );
}

export function StatTile({
  label,
  value,
  hint,
  tone = 'default',
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: 'default' | 'warning' | 'error';
}) {
  const toneClass =
    tone === 'error' ? 'text-error' : tone === 'warning' ? 'text-warning' : 'text-primary';
  return (
    <div className="card bg-base-100 shadow">
      <div className="card-body p-4">
        <p className="text-xs uppercase tracking-wide text-base-content/60">{label}</p>
        <p className={`text-2xl font-bold ${toneClass}`}>{value}</p>
        {hint ? <p className="text-xs text-base-content/60">{hint}</p> : null}
      </div>
    </div>
  );
}

export function RateStat({ label, rate }: { label: string; rate: Rate }) {
  return (
    <StatTile
      label={label}
      value={fmtPct(rate.value)}
      hint={`n = ${fmtInt(rate.numerator)} of ${fmtInt(rate.denominator)} ${rate.denominatorLabel}`}
    />
  );
}

export function SampleCaveat({ children }: { children?: ReactNode }) {
  return (
    <div role="note" className="alert alert-info text-sm">
      <FiInfo className="shrink-0" aria-hidden="true" />
      <div>
        {children ?? (
          <>
            <strong>Self-selected sample.</strong> Survey respondents chose to answer, so results do
            not automatically describe the whole user base. Differences between groups are not proof
            that the survey or its reward caused a change. Always read counts (<em>n</em>) next to
            percentages.
          </>
        )}
      </div>
    </div>
  );
}

export function ErrorAlert({ message }: { message: string }) {
  return (
    <div role="alert" className="alert alert-error text-sm">
      <FiAlertTriangle aria-hidden="true" />
      <span>{message}</span>
    </div>
  );
}

export function ForbiddenNotice({ title, message }: { title: string; message: string }) {
  return (
    <div role="alert" className="alert alert-warning">
      <FiLock aria-hidden="true" />
      <div>
        <h2 className="font-semibold">{title}</h2>
        <p>{message}</p>
      </div>
    </div>
  );
}

/** Full-page 403 state, mirroring the referral pages. */
export function SurveyAccessDenied({ heading = 'Surveys' }: { heading?: string }) {
  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">{heading}</h1>
      <ForbiddenNotice
        title="Survey access required"
        message="Your account does not have permission to view survey analytics. Ask your administrator to assign a survey role to the email address you use to sign in."
      />
      <Link href="/" className="btn btn-ghost mt-4">
        Back to dashboard
      </Link>
    </div>
  );
}

export function LoadingBlock() {
  return (
    <div className="flex h-40 items-center justify-center">
      <span className="loading loading-spinner loading-lg" />
    </div>
  );
}
