'use client';

import { useEffect, useMemo, useState } from 'react';
import type { getOpenTextAnswers } from '@/db/services/survey-analytics';
import { fmtDateTime, fmtInt } from './format';
import { ErrorAlert, ForbiddenNotice, LoadingBlock } from './SurveyUi';
import { buildQuery, useSurveyApi } from './useSurveyApi';

type TextResponse = NonNullable<Awaited<ReturnType<typeof getOpenTextAnswers>>>;

export default function OpenFeedbackPanel({
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
  const [questionId, setQuestionId] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    const handle = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(handle);
  }, [searchInput]);

  const url = useMemo(
    () =>
      canAnalyze
        ? `/api/admin/surveys/${surveyVersionId}/text${buildQuery({ questionId, search, page, studyId, cohort })}`
        : null,
    [canAnalyze, surveyVersionId, questionId, search, page, studyId, cohort],
  );
  const { data, error, status, loading } = useSurveyApi<TextResponse>(url);

  if (!canAnalyze) {
    return (
      <ForbiddenNotice
        title="Analyst access required"
        message="Free-text answers are person-level data. Ask an administrator for the survey analyst role."
      />
    );
  }
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div className="space-y-4">
      <div role="note" className="alert alert-warning text-sm">
        Respondent wording is retained for permitted internal analysis only. Viewing this tab is
        logged. Do not paste answers into third-party tools.
      </div>
      <div className="flex flex-col gap-3 md:flex-row">
        <label className="form-control md:w-64">
          <span className="label-text text-xs">Question</span>
          <select
            className="select select-bordered select-sm"
            value={questionId}
            onChange={(e) => {
              setQuestionId(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All text questions</option>
            {(data?.questions ?? []).map((q) => (
              <option key={q.questionId} value={q.questionId}>
                {q.questionId} — {q.label.slice(0, 50)}
              </option>
            ))}
          </select>
        </label>
        <label className="form-control flex-1">
          <span className="label-text text-xs">Search text</span>
          <input
            className="input input-bordered input-sm"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search answers…"
            type="search"
          />
        </label>
      </div>

      {loading ? <LoadingBlock /> : null}
      {status === 403 ? (
        <ForbiddenNotice
          title="Analyst access required"
          message="You cannot read free-text answers."
        />
      ) : error ? (
        <ErrorAlert message={error} />
      ) : null}

      {data && !loading ? (
        <>
          <p className="text-sm text-base-content/70">
            {fmtInt(data.total)} answer{data.total === 1 ? '' : 's'}
          </p>
          <ul className="space-y-3">
            {data.items.length === 0 ? (
              <li className="text-base-content/60">No free-text answers match.</li>
            ) : (
              data.items.map((item) => (
                <li key={item.textAnswerId} className="card bg-base-100 shadow">
                  <div className="card-body p-4 gap-2">
                    <p className="whitespace-pre-wrap break-words">{item.text}</p>
                    <p className="text-xs text-base-content/60">
                      {item.questionId}
                      {item.questionLabel ? ` · ${item.questionLabel}` : ''}
                      {item.kind === 'other_text' ? ` · “other” (${item.optionId})` : ''} · cohort{' '}
                      {item.cohortKey} · {item.locale} · {fmtDateTime(item.createdAt)}
                    </p>
                  </div>
                </li>
              ))
            )}
          </ul>
          <div className="flex items-center justify-between">
            <button
              className="btn btn-sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </button>
            <span className="text-sm">
              Page {page} of {totalPages}
            </span>
            <button
              className="btn btn-sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}
