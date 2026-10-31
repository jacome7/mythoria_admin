'use client';

import { useState } from 'react';
import { FiDownload } from 'react-icons/fi';
import { ForbiddenNotice } from './SurveyUi';
import { buildQuery } from './useSurveyApi';

export default function ExportPanel({
  surveyVersionId,
  studyId,
  cohort,
  canAnalyze,
}: {
  surveyVersionId: string;
  studyId?: string;
  cohort?: string;
  canAnalyze: boolean;
}) {
  const [includeText, setIncludeText] = useState(false);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  if (!canAnalyze) {
    return (
      <ForbiddenNotice
        title="Analyst access required"
        message="Response exports are person-level data. Ask an administrator for the survey analyst role."
      />
    );
  }

  const href = `/api/admin/surveys/${surveyVersionId}/export${buildQuery({
    studyId,
    cohort,
    from,
    to,
    includeText: includeText ? 'true' : undefined,
  })}`;

  return (
    <div className="card bg-base-100 shadow">
      <div className="card-body gap-4">
        <h3 className="font-semibold">Export coded responses (CSV)</h3>
        <p className="text-sm text-base-content/70">
          One row per answer: response_id, survey_id, version, cohort_key, locale, submitted_at,
          question_id, dimension, option_id, value_numeric, is_not_applicable, is_skipped. Values
          that look like spreadsheet formulas are neutralized. Identifiers are pseudonymous response
          ids; no email addresses are exported. Every export is recorded in the audit log.
        </p>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <label className="form-control">
            <span className="label-text text-xs">Invited from</span>
            <input
              type="date"
              className="input input-bordered input-sm"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </label>
          <label className="form-control">
            <span className="label-text text-xs">Invited to</span>
            <input
              type="date"
              className="input input-bordered input-sm"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </label>
        </div>
        <label className="label cursor-pointer justify-start gap-3">
          <input
            type="checkbox"
            className="checkbox checkbox-sm"
            checked={includeText}
            onChange={(e) => setIncludeText(e.target.checked)}
          />
          <span className="label-text">
            Include free-text answers (adds text_kind and text_value columns)
          </span>
        </label>
        <p className="text-xs text-base-content/60">
          Scope: {studyId ? `study ${studyId.slice(0, 8)}…` : 'all studies'}
          {cohort ? `, cohort ${cohort}` : ', all cohorts'}.
        </p>
        <div>
          <a className="btn btn-primary btn-sm" href={href} download>
            <FiDownload aria-hidden="true" /> Download CSV
          </a>
        </div>
      </div>
    </div>
  );
}
