'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import type { SurveyOverviewRow } from '@/db/services/survey-analytics';
import { fmtDate, fmtInt } from './format';
import { ErrorAlert, ForbiddenNotice, LoadingBlock, SampleCaveat, StatTile } from './SurveyUi';
import { buildQuery, useSurveyApi } from './useSurveyApi';

interface OverviewResponse {
  rows: SurveyOverviewRow[];
  totals: {
    surveys: number;
    versions: number;
    invited: number;
    started: number;
    completed: number;
    deliveryFailures: number;
    rewardFailures: number;
  };
}

const STATUS_OPTIONS = ['draft', 'active', 'closed', 'archived'];

export default function SurveyList() {
  const [surveyId, setSurveyId] = useState('');
  const [campaignId, setCampaignId] = useState('');
  const [status, setStatus] = useState('');
  const [cohort, setCohort] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const url = useMemo(
    () => `/api/admin/surveys${buildQuery({ surveyId, campaignId, status, cohort, from, to })}`,
    [surveyId, campaignId, status, cohort, from, to],
  );
  const { data, error, status: httpStatus, loading } = useSurveyApi<OverviewResponse>(url);
  const rows = data?.rows ?? [];
  const totals = data?.totals;

  const reset = () => {
    setSurveyId('');
    setCampaignId('');
    setStatus('');
    setCohort('');
    setFrom('');
    setTo('');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Customer research surveys</h1>
          <p className="text-base-content/70">
            Analysis and monitoring of survey studies. Surveys are authored in code and published
            from the WebApp.
          </p>
        </div>
        <Link href="/surveys/studies" className="btn btn-outline btn-sm">
          Survey studies
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="Invited (excl. holdout)" value={fmtInt(totals?.invited)} />
        <StatTile label="Started" value={fmtInt(totals?.started)} />
        <StatTile
          label="Completed"
          value={fmtInt(totals?.completed)}
          hint={
            totals && totals.invited > 0
              ? `${((totals.completed / totals.invited) * 100).toFixed(1)}% of invited`
              : undefined
          }
        />
        <StatTile label="Survey versions in view" value={fmtInt(totals?.versions)} />
      </div>

      <section aria-labelledby="ops-heading" className="space-y-2">
        <h2 id="ops-heading" className="text-sm font-semibold uppercase text-base-content/60">
          Operational issues (separate from response metrics)
        </h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <StatTile
            label="Invitation delivery failures"
            value={fmtInt(totals?.deliveryFailures)}
            tone={totals && totals.deliveryFailures > 0 ? 'error' : 'default'}
            hint="Campaign recipients with status failed (invite + reminder campaigns)"
          />
          <StatTile
            label="Reward fulfilment failures"
            value={fmtInt(totals?.rewardFailures)}
            tone={totals && totals.rewardFailures > 0 ? 'error' : 'default'}
            hint="Reward entitlements in status failed"
          />
        </div>
      </section>

      <div className="card bg-base-100 shadow">
        <div className="card-body p-4">
          <form
            className="grid grid-cols-1 gap-3 md:grid-cols-3 lg:grid-cols-6"
            onSubmit={(event) => event.preventDefault()}
            aria-label="Survey filters"
          >
            <label className="form-control">
              <span className="label-text text-xs">Survey id</span>
              <input
                className="input input-bordered input-sm"
                value={surveyId}
                onChange={(e) => setSurveyId(e.target.value.trim())}
                placeholder="e.g. paying_creator"
              />
            </label>
            <label className="form-control">
              <span className="label-text text-xs">Campaign id</span>
              <input
                className="input input-bordered input-sm"
                value={campaignId}
                onChange={(e) => setCampaignId(e.target.value.trim())}
                placeholder="campaign uuid"
              />
            </label>
            <label className="form-control">
              <span className="label-text text-xs">Status</span>
              <select
                className="select select-bordered select-sm"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option value="">Any</option>
                {STATUS_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
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
                <option value="">Any</option>
                {['C1', 'C2', 'C3'].map((key) => (
                  <option key={key} value={key}>
                    {key}
                  </option>
                ))}
              </select>
            </label>
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
          </form>
          <div>
            <button type="button" className="btn btn-ghost btn-xs" onClick={reset}>
              Clear filters
            </button>
          </div>
        </div>
      </div>

      {loading ? <LoadingBlock /> : null}
      {httpStatus === 403 ? (
        <ForbiddenNotice
          title="Survey access required"
          message="Your account does not have permission to view survey analytics."
        />
      ) : error ? (
        <ErrorAlert message={error} />
      ) : null}

      {!loading && !error ? (
        <div className="card bg-base-100 shadow overflow-x-auto">
          <table className="table table-sm">
            <thead>
              <tr>
                <th>Survey</th>
                <th>Version</th>
                <th>Study / cohort</th>
                <th>Status</th>
                <th>Campaigns</th>
                <th className="text-right">Invited</th>
                <th className="text-right">Started</th>
                <th className="text-right">Completed</th>
                <th>Last response</th>
                <th>Issues</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={10} className="text-center text-base-content/60">
                    No surveys match these filters.
                  </td>
                </tr>
              ) : (
                rows.map((row) => <SurveyRow key={row.key} row={row} />)
              )}
            </tbody>
          </table>
        </div>
      ) : null}

      <SampleCaveat />
    </div>
  );
}

function SurveyRow({ row }: { row: SurveyOverviewRow }) {
  const detailHref = `/surveys/${row.surveyVersionId}${buildQuery({
    studyId: row.studyId,
    cohort: row.cohortKey,
  })}`;
  return (
    <tr className="hover">
      <td>
        <Link href={detailHref} className="link link-primary font-medium">
          {row.surveyTitle}
        </Link>
        <div className="text-xs text-base-content/60">{row.surveyId}</div>
      </td>
      <td>v{row.version}</td>
      <td>
        {row.studyId ? (
          <>
            <Link href={`/surveys/insights/${row.studyId}`} className="link">
              {row.studyTitle}
            </Link>
            <div className="text-xs text-base-content/60">Cohort {row.cohortKey}</div>
          </>
        ) : (
          <span className="text-base-content/50">Not in a study</span>
        )}
      </td>
      <td>
        <span className="badge badge-outline badge-sm">{row.studyStatus ?? row.surveyStatus}</span>
      </td>
      <td>
        {row.campaigns.length === 0 ? (
          <span className="text-base-content/50">none linked</span>
        ) : (
          <ul className="space-y-0.5">
            {row.campaigns.map((campaign) => (
              <li key={campaign.id} className="text-xs">
                <Link href={`/email-campaigns/${campaign.id}`} className="link">
                  {campaign.title ?? campaign.id.slice(0, 8)}
                </Link>{' '}
                <span className="text-base-content/60">
                  ({campaign.role}
                  {campaign.status ? `, ${campaign.status}` : ''})
                </span>
              </li>
            ))}
          </ul>
        )}
      </td>
      <td className="text-right">{fmtInt(row.invited)}</td>
      <td className="text-right">{fmtInt(row.started)}</td>
      <td className="text-right">{fmtInt(row.completed)}</td>
      <td>{fmtDate(row.lastResponseAt)}</td>
      <td className="text-xs">
        {row.deliveryIssues.failed > 0 ? (
          <span className="badge badge-error badge-sm mr-1">
            {row.deliveryIssues.failed} delivery
          </span>
        ) : null}
        {row.rewardFailures > 0 ? (
          <span className="badge badge-error badge-sm">{row.rewardFailures} reward</span>
        ) : null}
        {row.deliveryIssues.failed === 0 && row.rewardFailures === 0 ? '—' : null}
      </td>
    </tr>
  );
}
