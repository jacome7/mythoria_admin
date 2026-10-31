'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import type { getSurveyResults } from '@/db/services/survey-analytics';
import DefinitionViewer from './DefinitionViewer';
import ExportPanel from './ExportPanel';
import FunnelPanel from './FunnelPanel';
import OpenFeedbackPanel from './OpenFeedbackPanel';
import QuestionResultCard from './QuestionResultCard';
import { fmtInt } from './format';
import { ErrorAlert, ForbiddenNotice, LoadingBlock, SampleCaveat, StatTile } from './SurveyUi';
import { buildQuery, useSurveyApi } from './useSurveyApi';

type Results = NonNullable<Awaited<ReturnType<typeof getSurveyResults>>>;
type Tab = 'overview' | 'questions' | 'feedback' | 'export' | 'definition';

const TABS: { key: Tab; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'questions', label: 'Questions' },
  { key: 'feedback', label: 'Open feedback' },
  { key: 'export', label: 'Export' },
  { key: 'definition', label: 'Definition' },
];

export default function SurveyResultsView({
  surveyVersionId,
  initialStudyId,
  initialCohort,
  canAnalyze,
}: {
  surveyVersionId: string;
  initialStudyId?: string;
  initialCohort?: string;
  canAnalyze: boolean;
}) {
  const [tab, setTab] = useState<Tab>('overview');
  const [studyId, setStudyId] = useState(initialStudyId ?? '');
  const [cohort, setCohort] = useState(initialCohort ?? '');
  const [respondentLocale, setRespondentLocale] = useState('');
  const [hideEmpty, setHideEmpty] = useState(false);

  const url = useMemo(
    () =>
      `/api/admin/surveys/${surveyVersionId}/results${buildQuery({ studyId, cohort, respondentLocale })}`,
    [surveyVersionId, studyId, cohort, respondentLocale],
  );
  const { data, error, status, loading } = useSurveyApi<Results>(url);

  if (status === 403) {
    return (
      <ForbiddenNotice
        title="Survey access required"
        message="Your account does not have permission to view survey analytics."
      />
    );
  }

  const studies = data
    ? [...new Map(data.scopes.map((s) => [s.studyId, s.studyTitle])).entries()]
    : [];
  const cohorts = data
    ? [
        ...new Set(
          data.scopes.filter((s) => !studyId || s.studyId === studyId).map((s) => s.cohortKey),
        ),
      ]
    : [];

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div>
          <Link href="/surveys" className="link text-sm">
            ← All surveys
          </Link>
          <h1 className="text-3xl font-bold">{data?.version.surveyTitle ?? 'Survey results'}</h1>
          {data ? (
            <p className="text-base-content/70 text-sm">
              {data.version.surveyId} · v{data.version.version} · {data.version.surveyStatus}
            </p>
          ) : null}
        </div>
        {studyId ? (
          <Link href={`/surveys/insights/${studyId}`} className="btn btn-outline btn-sm">
            Study insights
          </Link>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-3 items-end">
        <label className="form-control">
          <span className="label-text text-xs">Study</span>
          <select
            className="select select-bordered select-sm"
            value={studyId}
            onChange={(e) => {
              setStudyId(e.target.value);
              setCohort('');
            }}
          >
            <option value="">All studies</option>
            {studies.map(([id, title]) => (
              <option key={id} value={id}>
                {title}
              </option>
            ))}
          </select>
        </label>
        <label className="form-control">
          <span className="label-text text-xs">Cohort</span>
          <select
            className="select select-bordered select-sm"
            value={cohort}
            onChange={(e) => setCohort(e.target.value)}
          >
            <option value="">All cohorts</option>
            {cohorts.map((key) => (
              <option key={key} value={key}>
                {key}
              </option>
            ))}
          </select>
        </label>
        <label className="form-control">
          <span className="label-text text-xs">Respondent locale</span>
          <select
            className="select select-bordered select-sm"
            value={respondentLocale}
            onChange={(e) => setRespondentLocale(e.target.value)}
          >
            <option value="">All locales</option>
            {['en-US', 'pt-PT', 'es-ES', 'fr-FR', 'de-DE'].map((locale) => (
              <option key={locale} value={locale}>
                {locale}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div role="tablist" className="tabs tabs-bordered">
        {TABS.map((item) => (
          <button
            key={item.key}
            role="tab"
            aria-selected={tab === item.key}
            className={`tab ${tab === item.key ? 'tab-active font-semibold' : ''}`}
            onClick={() => setTab(item.key)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {loading ? <LoadingBlock /> : null}
      {error && status !== 403 ? <ErrorAlert message={error} /> : null}

      {data && !loading ? (
        <>
          {tab === 'overview' ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                <StatTile
                  label="Submitted responses"
                  value={fmtInt(data.sampleSize.submittedN)}
                  hint="Sample size for every question below"
                />
                <StatTile
                  label="Questions"
                  value={fmtInt(data.questions.length)}
                  hint="Answerable (static content excluded)"
                />
              </div>
              <FunnelPanel funnel={data.funnel} duration={data.duration} />
              <SampleCaveat>{data.sampleSize.note}</SampleCaveat>
            </div>
          ) : null}

          {tab === 'questions' ? (
            <div className="space-y-4">
              <label className="label cursor-pointer justify-start gap-3">
                <input
                  type="checkbox"
                  className="checkbox checkbox-sm"
                  checked={hideEmpty}
                  onChange={(e) => setHideEmpty(e.target.checked)}
                />
                <span className="label-text">Hide questions nobody was shown</span>
              </label>
              {data.questions
                .filter((q) => !hideEmpty || q.shownN > 0)
                .map((question) => (
                  <QuestionResultCard key={question.questionId} question={question} />
                ))}
              {data.questions.length === 0 ? (
                <p className="text-base-content/60">No answerable questions in this definition.</p>
              ) : null}
            </div>
          ) : null}

          {tab === 'definition' ? (
            <DefinitionViewer definition={data.definition} version={data.version} />
          ) : null}
        </>
      ) : null}

      {tab === 'feedback' ? (
        <OpenFeedbackPanel
          surveyVersionId={surveyVersionId}
          studyId={studyId || undefined}
          cohort={cohort || undefined}
          canAnalyze={canAnalyze}
        />
      ) : null}
      {tab === 'export' ? (
        <ExportPanel
          surveyVersionId={surveyVersionId}
          studyId={studyId || undefined}
          cohort={cohort || undefined}
          canAnalyze={canAnalyze}
        />
      ) : null}
    </div>
  );
}
