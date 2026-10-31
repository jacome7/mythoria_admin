'use client';

import Link from 'next/link';
import { useState } from 'react';
import type {
  getBusinessOutcomes,
  getCrossCohortComparison,
  getRewardOps,
  getStudyOverview,
} from '@/db/services/survey-analytics';
import type { OutcomeMetric } from '@/lib/surveys/analytics-compute';
import { fmtDate, fmtDateTime, fmtInt, fmtPct } from './format';
import {
  ErrorAlert,
  ForbiddenNotice,
  LoadingBlock,
  NotTrackedBadge,
  SampleCaveat,
  StatTile,
} from './SurveyUi';
import { useSurveyApi } from './useSurveyApi';

type Overview = NonNullable<Awaited<ReturnType<typeof getStudyOverview>>>;
type Comparison = Awaited<ReturnType<typeof getCrossCohortComparison>>;
type Rewards = Awaited<ReturnType<typeof getRewardOps>>;
type Outcomes = Awaited<ReturnType<typeof getBusinessOutcomes>>;

const GROUP_LABEL: Record<string, string> = {
  respondent: 'Respondents',
  invited_non_respondent: 'Invited, no response',
  holdout: 'Holdout (not invited)',
};

export default function StudyInsightsView({ studyId }: { studyId: string }) {
  const base = `/api/admin/surveys/studies-analytics/${studyId}`;
  const overview = useSurveyApi<Overview>(`${base}/overview`);

  if (overview.status === 403) {
    return (
      <ForbiddenNotice
        title="Survey access required"
        message="Your account does not have permission to view survey analytics."
      />
    );
  }

  return (
    <div className="space-y-8">
      <header>
        <Link href="/surveys" className="link text-sm">
          ← All surveys
        </Link>
        <h1 className="text-3xl font-bold">{overview.data?.study.title ?? 'Study insights'}</h1>
        {overview.data ? (
          <p className="text-sm text-base-content/70">
            {overview.data.study.studyKey} · {overview.data.study.status} · holdout{' '}
            {overview.data.study.holdoutPercent}% · window {fmtDate(overview.data.study.opensAt)} –{' '}
            {fmtDate(overview.data.study.closesAt)}
            {' · '}
            <Link className="link" href={`/surveys/studies/${studyId}`}>
              manage study
            </Link>
          </p>
        ) : null}
      </header>

      <SampleCaveat>
        <strong>Read with care.</strong> Only people who chose to answer are in the response data
        (self-selected sample), cohorts differ in size and wording, and behaviour changes after a
        survey are not proof that the survey or reward caused them. Small <em>n</em> means wide
        uncertainty. Metrics that are not tracked are labelled instead of estimated.
      </SampleCaveat>

      {overview.loading ? <LoadingBlock /> : null}
      {overview.error ? <ErrorAlert message={overview.error} /> : null}
      {overview.data ? <StudyOverviewSection overview={overview.data} /> : null}

      <ComparisonSection url={`${base}/comparison`} />
      <RewardsSection url={`${base}/rewards`} />
      <OutcomesSection base={`${base}/outcomes`} />
    </div>
  );
}

function StudyOverviewSection({ overview }: { overview: Overview }) {
  return (
    <section className="space-y-3" aria-labelledby="overview-heading">
      <h2 id="overview-heading" className="text-xl font-semibold">
        Study overview by cohort
      </h2>
      <p className="text-sm text-base-content/70">
        Eligible = people snapshotted into the study. Classified/unclassified population counts are
        on the{' '}
        <Link className="link" href={`/surveys/studies/${overview.study.studyId}`}>
          study page
        </Link>
        .
      </p>
      <div className="card bg-base-100 shadow overflow-x-auto">
        <table className="table table-sm">
          <thead>
            <tr>
              <th>Cohort</th>
              <th>Survey</th>
              <th className="text-right">Eligible</th>
              <th className="text-right">Holdout</th>
              <th className="text-right">Invited</th>
              <th className="text-right">Sent</th>
              <th className="text-right">Opened</th>
              <th className="text-right">Started</th>
              <th className="text-right">Completed</th>
              <th className="text-right">Response rate</th>
              <th className="text-right">Delivery failures</th>
            </tr>
          </thead>
          <tbody>
            {overview.cohorts.map((cohort) => {
              const { counts, rates, delivery } = cohort.funnel;
              return (
                <tr key={cohort.cohortKey}>
                  <td className="font-semibold">{cohort.cohortKey}</td>
                  <td>
                    <Link
                      className="link"
                      href={`/surveys/${cohort.surveyVersionId}?studyId=${overview.study.studyId}&cohort=${cohort.cohortKey}`}
                    >
                      {cohort.surveyTitle} v{cohort.version}
                    </Link>
                  </td>
                  <td className="text-right">{fmtInt(counts.eligible)}</td>
                  <td className="text-right">{fmtInt(counts.holdout)}</td>
                  <td className="text-right">{fmtInt(counts.invited)}</td>
                  <td className="text-right">
                    {counts.sent === null ? (
                      <NotTrackedBadge label="no campaign" />
                    ) : (
                      fmtInt(counts.sent)
                    )}
                  </td>
                  <td className="text-right">{fmtInt(counts.opened)}</td>
                  <td className="text-right">{fmtInt(counts.started)}</td>
                  <td className="text-right">{fmtInt(counts.completed)}</td>
                  <td className="text-right">
                    {fmtPct(rates.responseRate.value)}
                    <div className="text-xs text-base-content/50">
                      of {fmtInt(rates.responseRate.denominator)}{' '}
                      {counts.sent !== null && counts.sent > 0 ? 'sent' : 'invited'}
                    </div>
                  </td>
                  <td className="text-right">{fmtInt(delivery.failed)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-base-content/60">
        Delivered (inbox placement) <NotTrackedBadge />. Cohort sizes differ, so compare rates and
        their n, not raw response counts.
      </p>
    </section>
  );
}

function ComparisonSection({ url }: { url: string }) {
  const { data, error, loading } = useSurveyApi<Comparison>(url);
  return (
    <section className="space-y-3" aria-labelledby="comparison-heading">
      <h2 id="comparison-heading" className="text-xl font-semibold">
        Cross-cohort comparison
      </h2>
      {loading ? <LoadingBlock /> : null}
      {error ? <ErrorAlert message={error} /> : null}
      {data ? (
        <>
          <p className="text-sm text-base-content/70">{data.caveat}</p>
          <p className="text-xs text-base-content/60">
            Cohort sample sizes:{' '}
            {data.cohorts.map((c) => `${c.cohortKey} n = ${fmtInt(c.submittedN)}`).join(' · ')}.
            Excluded: {data.excludedDimensions.join(', ')} (free text).
          </p>
          {data.dimensions.length === 0 ? (
            <p className="text-base-content/60">No shared dimensions found in this study.</p>
          ) : null}
          {data.dimensions.map((dimension) => (
            <div key={dimension.dimension} className="card bg-base-100 shadow">
              <div className="card-body p-4 gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold">{dimension.dimension}</h3>
                  <span
                    className={`badge badge-sm ${dimension.optionSetsIdentical ? 'badge-success' : 'badge-warning'}`}
                  >
                    {dimension.optionSetsIdentical ? 'same option set' : 'options differ'}
                  </span>
                </div>
                <p className="text-xs text-base-content/60">{dimension.note}</p>
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                  {dimension.cohorts.map((entry) => (
                    <div
                      key={`${entry.cohortKey}-${entry.questionId}`}
                      className="rounded border border-base-300 p-3"
                    >
                      <p className="font-medium">
                        {entry.cohortKey} · {entry.questionId}
                      </p>
                      <p className="text-xs text-base-content/70 mb-2">“{entry.wording}”</p>
                      <p className="text-xs mb-2">
                        Shown {fmtInt(entry.shownN)} · valid n = {fmtInt(entry.answeredN)} · N/A{' '}
                        {fmtInt(entry.notApplicableN)} · skipped {fmtInt(entry.skippedN)}
                      </p>
                      <table className="table table-xs">
                        <tbody>
                          {entry.options.map((option) => (
                            <tr
                              key={option.optionId}
                              className={option.notApplicable ? 'text-base-content/50' : ''}
                            >
                              <td>{option.label}</td>
                              <td className="text-right">{fmtInt(option.count)}</td>
                              <td className="text-right">
                                {option.rate === null ? '—' : fmtPct(option.rate)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </>
      ) : null}
    </section>
  );
}

function RewardsSection({ url }: { url: string }) {
  const { data, error, loading } = useSurveyApi<Rewards>(url);
  const summary = data?.summary;
  return (
    <section className="space-y-3" aria-labelledby="rewards-heading">
      <h2 id="rewards-heading" className="text-xl font-semibold">
        Reward operations
      </h2>
      {loading ? <LoadingBlock /> : null}
      {error ? <ErrorAlert message={error} /> : null}
      {summary ? (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatTile label="Earned" value={fmtInt(summary.earned)} hint="Entitlements granted" />
            <StatTile label="Selected PDF" value={fmtInt(summary.selectedPdf)} />
            <StatTile label="Selected audiobook" value={fmtInt(summary.selectedAudiobook)} />
            <StatTile label="Pending first story" value={fmtInt(summary.pendingStory)} />
            <StatTile label="Processing" value={fmtInt(summary.processing)} />
            <StatTile label="Delivered" value={fmtInt(summary.delivered)} />
            <StatTile
              label="Failed"
              value={fmtInt(summary.failed)}
              tone={summary.failed > 0 ? 'error' : 'default'}
            />
            <StatTile label="Expired" value={fmtInt(summary.expired)} />
            <StatTile
              label="Unredeemed"
              value={fmtInt(summary.unredeemed)}
              hint="Earned, not yet chosen (eligible + pending story)"
            />
            <StatTile
              label="Redemption rate"
              value={fmtPct(summary.redemptionRate.value)}
              hint={`${fmtInt(summary.redemptionRate.numerator)} delivered of ${fmtInt(summary.redemptionRate.denominator)} granted`}
            />
          </div>
          <p className="text-xs text-base-content/60">
            Production cost per reward: <NotTrackedBadge />
          </p>
          {data && data.failures.length > 0 ? (
            <div className="card bg-base-100 shadow overflow-x-auto">
              <table className="table table-xs">
                <caption className="text-left p-3 font-semibold">
                  Failed reward fulfilments (latest {data.failures.length}) — operational issue, not
                  a response metric
                </caption>
                <thead>
                  <tr>
                    <th>Entitlement</th>
                    <th>Cohort</th>
                    <th>Type</th>
                    <th>Attempts</th>
                    <th>Failed at</th>
                    <th>Error</th>
                  </tr>
                </thead>
                <tbody>
                  {data.failures.map((failure) => (
                    <tr key={failure.entitlementId}>
                      <td className="font-mono text-xs">{failure.entitlementId.slice(0, 8)}</td>
                      <td>{failure.cohortKey}</td>
                      <td>{failure.rewardType ?? '—'}</td>
                      <td>{failure.attempts}</td>
                      <td>{fmtDateTime(failure.failedAt)}</td>
                      <td>{failure.lastError ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </>
      ) : null}
    </section>
  );
}

function MetricCell({ metric }: { metric: OutcomeMetric }) {
  return (
    <td className="text-right">
      {fmtPct(metric.rate)}
      <div className="text-xs text-base-content/50">
        {fmtInt(metric.value)} / {fmtInt(metric.denominator)}
      </div>
    </td>
  );
}

function OutcomesSection({ base }: { base: string }) {
  const [windowDays, setWindowDays] = useState<7 | 30>(30);
  const { data, error, loading } = useSurveyApi<Outcomes>(`${base}?windowDays=${windowDays}`);
  return (
    <section className="space-y-3" aria-labelledby="outcomes-heading">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="outcomes-heading" className="text-xl font-semibold">
          Business outcomes
        </h2>
        <div className="join" role="group" aria-label="Observation window">
          {([7, 30] as const).map((days) => (
            <button
              key={days}
              className={`btn btn-sm join-item ${windowDays === days ? 'btn-primary' : ''}`}
              aria-pressed={windowDays === days}
              onClick={() => setWindowDays(days)}
            >
              {days} days
            </button>
          ))}
        </div>
      </div>
      {loading ? <LoadingBlock /> : null}
      {error ? <ErrorAlert message={error} /> : null}
      {data && !loading ? (
        <>
          <div role="note" className="alert alert-warning text-sm">
            <ul className="list-disc ml-4">
              {data.caveats.map((caveat) => (
                <li key={caveat}>{caveat}</li>
              ))}
            </ul>
          </div>
          <div className="card bg-base-100 shadow overflow-x-auto">
            <table className="table table-sm">
              <thead>
                <tr>
                  <th>Cohort</th>
                  <th>Group</th>
                  <th className="text-right">Users</th>
                  <th className="text-right">Full {data.windowDays}d window</th>
                  <th className="text-right">First paid purchase</th>
                  <th className="text-right">Any paid purchase</th>
                  <th className="text-right">Repeat creation</th>
                  <th className="text-right">Premium attach (paid)</th>
                  <th className="text-right">Reward redemptions (not paid)</th>
                </tr>
              </thead>
              <tbody>
                {data.groups.map((group) => (
                  <tr key={`${group.cohortKey}-${group.group}`}>
                    <td className="font-semibold">{group.cohortKey}</td>
                    <td>{GROUP_LABEL[group.group] ?? group.group}</td>
                    <td className="text-right">{fmtInt(group.n)}</td>
                    <td className="text-right">{fmtInt(group.matureN)}</td>
                    <MetricCell metric={group.firstPaidConversion} />
                    <MetricCell metric={group.paidPurchase} />
                    <MetricCell metric={group.repeatCreation} />
                    <MetricCell metric={group.premiumAttachPaid} />
                    <td className="text-right text-base-content/60">
                      {fmtInt(group.rewardRedemptions.value)}
                    </td>
                  </tr>
                ))}
                {data.groups.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="text-center text-base-content/60">
                      No invitations snapshotted yet.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-base-content/60">
            Windows start at: respondents = {data.anchors.respondent}; others ={' '}
            {data.anchors.invited_non_respondent}. First paid purchase uses only users with no paid
            purchase at snapshot. Unavailable:{' '}
            {data.unavailable.map((item) => (
              <span key={item.metric} className="mr-2">
                {item.metric.replace(/_/g, ' ')}{' '}
                <NotTrackedBadge label="unavailable" hint={item.reason} />
              </span>
            ))}
          </p>
        </>
      ) : null}
    </section>
  );
}
