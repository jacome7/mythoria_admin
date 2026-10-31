'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { FiArrowLeft, FiCamera, FiMail, FiPlay, FiRefreshCw, FiXCircle } from 'react-icons/fi';
import { useAdminAuth } from '@/lib/hooks/useAdminAuth';
import {
  surveyStudyClient,
  type CreateCampaignsResult,
  REWARD_POLICY_REQUIRED_HINT,
  type StudyDetailWithCampaigns,
} from '@/lib/surveys/study-client';
import {
  emailableCount,
  SURVEY_REMINDER_DELAY_DAYS,
  type SurveyAudiencePreview,
  type SurveyAudienceSnapshotResult,
} from '@/lib/surveys/study-types';
import AudiencePreviewTable from '@/components/surveys/studies/AudiencePreviewTable';
import ConfirmDialog from '@/components/surveys/studies/ConfirmDialog';
import StudyStatusBadge from '@/components/surveys/studies/StudyStatusBadge';

type PendingAction = 'activate' | 'close' | 'snapshot' | 'campaigns' | null;

function formatDate(value?: string | null): string {
  return value ? new Date(value).toLocaleString() : '-';
}

function SnapshotResultTable({
  result,
  cohortKeys,
}: {
  result: SurveyAudienceSnapshotResult;
  cohortKeys: string[];
}) {
  const keys = cohortKeys.length ? cohortKeys : Object.keys(result.inserted);
  return (
    <div className="overflow-x-auto">
      <table className="table table-sm w-full">
        <thead>
          <tr>
            <th>Cohort</th>
            <th className="text-right">Inserted</th>
            <th className="text-right">Holdout</th>
            <th className="text-right">Emailable</th>
          </tr>
        </thead>
        <tbody>
          {keys.map((key) => (
            <tr key={key}>
              <td className="font-medium">{key}</td>
              <td className="text-right">{result.inserted[key] ?? 0}</td>
              <td className="text-right">{result.holdout?.[key] ?? 0}</td>
              <td className="text-right">{emailableCount(result, key)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-xs text-base-content/60 mt-1">
        Inserted includes the holdout; emailable = inserted - holdout. Skipped (already invited):{' '}
        {result.skippedExisting ?? 0}.
      </p>
    </div>
  );
}

export default function SurveyStudyDetailPage() {
  const { session, loading: authLoading } = useAdminAuth();
  const studyId = useParams().studyId as string;

  const [detail, setDetail] = useState<StudyDetailWithCampaigns | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [preview, setPreview] = useState<SurveyAudiencePreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const [snapshotCohorts, setSnapshotCohorts] = useState<string[]>([]);
  const [dryRunResult, setDryRunResult] = useState<{
    key: string;
    result: SurveyAudienceSnapshotResult;
  } | null>(null);
  const [snapshotResult, setSnapshotResult] = useState<SurveyAudienceSnapshotResult | null>(null);

  const [pending, setPending] = useState<PendingAction>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setError(null);
      const data = await surveyStudyClient.get(studyId);
      setDetail(data);
      setSnapshotCohorts((current) =>
        current.length ? current : data.cohorts.map((cohort) => cohort.cohortKey),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load study');
    } finally {
      setIsLoading(false);
    }
  }, [studyId]);

  useEffect(() => {
    if (!authLoading && session) load();
  }, [authLoading, session, load]);

  const selectionKey = [...snapshotCohorts].sort().join(',');
  const dryRunCurrent = dryRunResult?.key === selectionKey;

  async function loadPreview() {
    setPreviewLoading(true);
    setError(null);
    try {
      setPreview(await surveyStudyClient.preview(studyId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to preview audience');
    } finally {
      setPreviewLoading(false);
    }
  }

  async function runDryRun() {
    setBusy(true);
    setError(null);
    try {
      const result = await surveyStudyClient.snapshot(studyId, {
        cohortKeys: snapshotCohorts,
        dryRun: true,
      });
      setDryRunResult({ key: selectionKey, result });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Dry run failed');
    } finally {
      setBusy(false);
    }
  }

  async function confirmPending() {
    if (!pending) return;
    setBusy(true);
    setError(null);
    try {
      if (pending === 'activate' || pending === 'close') {
        await surveyStudyClient.setStatus(studyId, pending === 'activate' ? 'active' : 'closed');
        setNotice(pending === 'activate' ? 'Study activated.' : 'Study closed.');
      } else if (pending === 'snapshot') {
        const result = await surveyStudyClient.snapshot(studyId, { cohortKeys: snapshotCohorts });
        setSnapshotResult(result);
        setDryRunResult(null);
        setNotice('Audience snapshot written.');
        await loadPreview();
      } else if (pending === 'campaigns') {
        const result: CreateCampaignsResult = await surveyStudyClient.createCampaigns(studyId);
        const created = result.cohorts.reduce(
          (sum, cohort) => sum + Number(cohort.invite.created) + Number(cohort.reminder.created),
          0,
        );
        setNotice(
          created > 0
            ? `${created} draft campaign(s) created.`
            : 'Campaigns already exist for every cohort - nothing to create.',
        );
      }
      setPending(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed');
      setPending(null);
    } finally {
      setBusy(false);
    }
  }

  if (authLoading || isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <span className="loading loading-spinner loading-lg" />
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="alert alert-error">
          <span>{error ?? 'Study not found'}</span>
        </div>
      </div>
    );
  }

  const { study, cohorts, campaigns } = detail;
  const missingRedemptionDeadline = !study.rewardPolicy?.redemptionDeadline;
  const canWriteSnapshot = study.status === 'draft' || study.status === 'active';
  const invitationStatuses = Array.from(
    new Set(
      cohorts.flatMap((cohort) => {
        const counts = detail.invitationCounts?.[cohort.cohortKey];
        return counts && typeof counts === 'object' ? Object.keys(counts) : [];
      }),
    ),
  ).sort();
  const campaignsByCohort = (cohortKey: string, mode: 'invite' | 'reminder') =>
    campaigns.find((campaign) => campaign.cohortKey === cohortKey && campaign.mode === mode);

  const dialogs: Record<
    Exclude<PendingAction, null>,
    { title: string; message: string; label: string; danger?: boolean }
  > = {
    activate: {
      title: 'Activate study?',
      message:
        'Respondents can open survey links once the study is active and inside its opening window.',
      label: 'Activate',
    },
    close: {
      title: 'Close study?',
      message:
        'Survey links stop accepting answers and campaigns no longer send. This cannot be undone.',
      label: 'Close study',
      danger: true,
    },
    snapshot: {
      title: 'Write audience snapshot?',
      message: `This inserts invitations for ${snapshotCohorts.join(', ')} (idempotent: existing invitations are kept).`,
      label: 'Write snapshot',
    },
    campaigns: {
      title: 'Create survey campaigns?',
      message:
        'Creates draft invite and reminder campaigns for each cohort and links them to the study. Existing campaigns are never duplicated.',
      label: 'Create campaigns',
    },
  };
  const dialog = pending ? dialogs[pending] : null;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <Link href="/surveys/studies" className="btn btn-ghost btn-sm gap-1">
        <FiArrowLeft /> All studies
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{study.title}</h1>
            <StudyStatusBadge status={study.status} />
          </div>
          <p className="text-sm text-base-content/60">
            {study.studyKey} · {formatDate(study.opensAt)} to {formatDate(study.closesAt)} · holdout{' '}
            {study.holdoutPercent ?? 0}%
          </p>
        </div>
        <div className="flex gap-2">
          {study.status === 'draft' && (
            <button
              className="btn btn-sm btn-success gap-1"
              onClick={() => setPending('activate')}
              disabled={missingRedemptionDeadline}
              title={missingRedemptionDeadline ? REWARD_POLICY_REQUIRED_HINT : undefined}
            >
              <FiPlay /> Activate
            </button>
          )}
          {study.status === 'active' && (
            <button className="btn btn-sm btn-warning gap-1" onClick={() => setPending('close')}>
              <FiXCircle /> Close study
            </button>
          )}
        </div>
      </div>

      {study.status === 'draft' && missingRedemptionDeadline && (
        <div className="alert alert-warning" role="alert">
          <span>
            {REWARD_POLICY_REQUIRED_HINT}: reward-eligible surveys need a redemption deadline in the
            study&apos;s reward policy.
          </span>
        </div>
      )}

      {error && (
        <div className="alert alert-error">
          <span>{error}</span>
          <button className="btn btn-ghost btn-xs" onClick={() => setError(null)}>
            Dismiss
          </button>
        </div>
      )}
      {notice && (
        <div className="alert alert-success">
          <span>{notice}</span>
          <button className="btn btn-ghost btn-xs" onClick={() => setNotice(null)}>
            Dismiss
          </button>
        </div>
      )}

      {/* Reward policy */}
      <div className="card bg-base-100 shadow-sm border border-base-200">
        <div className="card-body py-4">
          <h3 className="card-title text-sm">Reward policy</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-base-content/50 text-xs">Reward types</span>
              <p className="font-medium uppercase">
                {study.rewardPolicy?.rewardTypes?.join(', ') || '-'}
              </p>
            </div>
            <div>
              <span className="text-base-content/50 text-xs">Redemption deadline</span>
              <p className="font-medium">{formatDate(study.rewardPolicy?.redemptionDeadline)}</p>
            </div>
            <div>
              <span className="text-base-content/50 text-xs">Existing audiobook allowed</span>
              <p className="font-medium">
                {study.rewardPolicy?.allowExistingAudiobook ? 'Yes' : 'No'}
              </p>
            </div>
            <div>
              <span className="text-base-content/50 text-xs">Last snapshot</span>
              <p className="font-medium">{formatDate(study.snapshotAt)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Audience preview */}
      <div className="card bg-base-100 shadow-sm border border-base-200">
        <div className="card-body">
          <div className="flex items-center justify-between">
            <h3 className="card-title text-sm">Audience preview</h3>
            <button
              className="btn btn-sm btn-outline gap-1"
              onClick={loadPreview}
              disabled={previewLoading}
            >
              {previewLoading ? (
                <span className="loading loading-spinner loading-xs" />
              ) : (
                <FiRefreshCw />
              )}
              {preview ? 'Refresh preview' : 'Load preview'}
            </button>
          </div>
          {preview ? (
            <AudiencePreviewTable preview={preview} />
          ) : (
            <p className="text-sm text-base-content/60">
              Load the preview to see classified, eligible, suppressed and already-invited counts.
            </p>
          )}
        </div>
      </div>

      {/* Snapshot */}
      <div className="card bg-base-100 shadow-sm border border-base-200">
        <div className="card-body space-y-3">
          <h3 className="card-title text-sm">Snapshot audience</h3>
          <p className="text-sm text-base-content/70">
            Freezes the eligible authors into survey invitations (including the holdout). Run a dry
            run first; the snapshot can only be written for the selection that was just dry-run.
          </p>
          <div className="flex flex-wrap gap-4">
            {cohorts.map((cohort) => (
              <label key={cohort.cohortKey} className="label cursor-pointer gap-2">
                <input
                  type="checkbox"
                  className="checkbox checkbox-sm"
                  checked={snapshotCohorts.includes(cohort.cohortKey)}
                  onChange={(e) =>
                    setSnapshotCohorts(
                      e.target.checked
                        ? [...snapshotCohorts, cohort.cohortKey]
                        : snapshotCohorts.filter((key) => key !== cohort.cohortKey),
                    )
                  }
                />
                <span className="label-text">{cohort.cohortKey}</span>
              </label>
            ))}
          </div>
          <div className="flex gap-2">
            <button
              className="btn btn-sm btn-outline gap-1"
              onClick={runDryRun}
              disabled={busy || snapshotCohorts.length === 0}
            >
              <FiCamera /> Dry run
            </button>
            <button
              className="btn btn-sm btn-primary gap-1"
              onClick={() => setPending('snapshot')}
              disabled={busy || !dryRunCurrent || !canWriteSnapshot}
              title={
                canWriteSnapshot
                  ? undefined
                  : 'Snapshots can only be written while the study is draft or active'
              }
            >
              Write snapshot
            </button>
          </div>
          {dryRunResult && (
            <div className="bg-base-200 rounded p-3 space-y-1">
              <h4 className="text-xs font-medium">Dry run ({dryRunResult.key})</h4>
              <SnapshotResultTable
                result={dryRunResult.result}
                cohortKeys={cohorts.map((cohort) => cohort.cohortKey)}
              />
            </div>
          )}
          {snapshotResult && (
            <div className="bg-base-200 rounded p-3 space-y-1">
              <h4 className="text-xs font-medium">Snapshot written</h4>
              <SnapshotResultTable
                result={snapshotResult}
                cohortKeys={cohorts.map((cohort) => cohort.cohortKey)}
              />
            </div>
          )}
        </div>
      </div>

      {/* Invitations */}
      <div className="card bg-base-100 shadow-sm border border-base-200">
        <div className="card-body">
          <h3 className="card-title text-sm">Invitations</h3>
          {cohorts.length === 0 || (!detail.invitationCounts && !detail.holdoutCounts) ? (
            <p className="text-sm text-base-content/60">No invitations yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="table table-sm w-full">
                <thead>
                  <tr>
                    <th>Cohort</th>
                    {invitationStatuses.map((status) => (
                      <th key={status} className="text-right capitalize">
                        {status}
                      </th>
                    ))}
                    <th className="text-right">Holdout</th>
                  </tr>
                </thead>
                <tbody>
                  {cohorts.map((cohort) => {
                    const counts = detail.invitationCounts?.[cohort.cohortKey];
                    return (
                      <tr key={cohort.cohortKey}>
                        <td className="font-medium">{cohort.cohortKey}</td>
                        {invitationStatuses.map((status) => (
                          <td key={status} className="text-right">
                            {typeof counts === 'object' ? (counts[status] ?? 0) : 0}
                          </td>
                        ))}
                        <td className="text-right">
                          {detail.holdoutCounts?.[cohort.cohortKey] ?? 0}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Campaigns */}
      <div className="card bg-base-100 shadow-sm border border-base-200">
        <div className="card-body space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="card-title text-sm">Survey campaigns</h3>
              <p className="text-xs text-base-content/60">
                Reminder starts {SURVEY_REMINDER_DELAY_DAYS} days after the study opens; edit the
                campaign start date to change.
              </p>
            </div>
            <button
              className="btn btn-sm btn-primary gap-1"
              onClick={() => setPending('campaigns')}
              disabled={busy || cohorts.length === 0}
            >
              <FiMail /> Create campaigns
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="table table-sm w-full">
              <thead>
                <tr>
                  <th>Cohort</th>
                  <th>Invite</th>
                  <th>Reminder</th>
                </tr>
              </thead>
              <tbody>
                {cohorts.map((cohort) => (
                  <tr key={cohort.cohortKey}>
                    <td className="font-medium">{cohort.cohortKey}</td>
                    {(['invite', 'reminder'] as const).map((mode) => {
                      const campaign = campaignsByCohort(cohort.cohortKey, mode);
                      const linkedId =
                        mode === 'invite' ? cohort.inviteCampaignId : cohort.reminderCampaignId;
                      const id = campaign?.id ?? linkedId;
                      return (
                        <td key={mode}>
                          {id ? (
                            <Link href={`/email-campaigns/${id}`} className="link link-primary">
                              {campaign?.title ?? id}
                              {campaign && (
                                <span className="badge badge-sm badge-outline ml-2 capitalize">
                                  {campaign.status}
                                </span>
                              )}
                            </Link>
                          ) : (
                            <span className="text-base-content/50">Not created</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={pending !== null}
        title={dialog?.title ?? ''}
        message={dialog?.message ?? ''}
        confirmLabel={dialog?.label ?? 'Confirm'}
        danger={dialog?.danger}
        busy={busy}
        onConfirm={confirmPending}
        onCancel={() => setPending(null)}
      />
    </div>
  );
}
