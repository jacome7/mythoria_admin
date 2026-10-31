'use client';

import { useState } from 'react';
import { FiPlus } from 'react-icons/fi';
import { surveyStudyClient } from '@/lib/surveys/study-client';
import { REWARD_TYPES, type CreateStudyInput } from '@/lib/surveys/study-schemas';
import {
  SURVEY_STUDY_COHORT_KEYS,
  type SurveyStudyDetail,
  type SurveyVersionSummary,
} from '@/lib/surveys/study-types';

interface StudyCreateFormProps {
  surveys: SurveyVersionSummary[];
  onCreated: (detail: SurveyStudyDetail) => void;
  onCancel: () => void;
}

const COHORT_LABELS: Record<string, string> = {
  C1: 'C1 - no story yet',
  C2: 'C2 - one story, no purchase',
  C3: 'C3 - paying creators',
};

function toIso(localValue: string): string {
  return localValue ? new Date(localValue).toISOString() : '';
}

export default function StudyCreateForm({ surveys, onCreated, onCancel }: StudyCreateFormProps) {
  const [studyKey, setStudyKey] = useState('');
  const [title, setTitle] = useState('');
  const [opensAt, setOpensAt] = useState('');
  const [closesAt, setClosesAt] = useState('');
  const [holdoutPercent, setHoldoutPercent] = useState('10');
  const [rewardTypes, setRewardTypes] = useState<Array<'pdf' | 'audiobook'>>(['pdf', 'audiobook']);
  const [redemptionDeadline, setRedemptionDeadline] = useState('');
  const [allowExistingAudiobook, setAllowExistingAudiobook] = useState(false);
  const [cohortSelection, setCohortSelection] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function versionOptions() {
    return surveys.flatMap((survey) =>
      survey.versions.map((version) => ({
        value: `${survey.surveyId}@${version.version}`,
        label: `${survey.title ?? survey.surveyId} v${version.version}${
          version.status ? ` (${version.status})` : ''
        }`,
      })),
    );
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    const cohorts = Object.entries(cohortSelection)
      .filter(([, value]) => value)
      .map(([cohortKey, value]) => {
        const [surveyId, version] = value.split('@');
        return { cohortKey: cohortKey as 'C1' | 'C2' | 'C3', surveyId, version: Number(version) };
      });
    const payload: CreateStudyInput = {
      studyKey: studyKey.trim(),
      title: title.trim(),
      opensAt: toIso(opensAt),
      closesAt: toIso(closesAt),
      holdoutPercent: Number(holdoutPercent),
      rewardPolicy: {
        rewardTypes,
        redemptionDeadline: redemptionDeadline ? toIso(redemptionDeadline) : null,
        allowExistingAudiobook,
      },
      cohorts,
    };
    setSaving(true);
    try {
      onCreated(await surveyStudyClient.create(payload));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create study');
    } finally {
      setSaving(false);
    }
  }

  const options = versionOptions();

  return (
    <form
      onSubmit={handleSubmit}
      className="card bg-base-100 shadow-sm border border-base-200"
      aria-label="Create survey study"
    >
      <div className="card-body space-y-4">
        <h3 className="card-title text-sm">New study</h3>
        {error && (
          <div className="alert alert-error py-2">
            <span className="text-sm">{error}</span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="form-control">
            <span className="label-text text-sm py-1">Study key</span>
            <input
              className="input input-bordered input-sm"
              value={studyKey}
              onChange={(e) => setStudyKey(e.target.value)}
              placeholder="conversion-research-2026-q4"
              required
              pattern="[a-z0-9][a-z0-9_\-]{2,63}"
            />
          </label>
          <label className="form-control">
            <span className="label-text text-sm py-1">Title</span>
            <input
              className="input input-bordered input-sm"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              maxLength={255}
            />
          </label>
          <label className="form-control">
            <span className="label-text text-sm py-1">Opens</span>
            <input
              type="datetime-local"
              className="input input-bordered input-sm"
              value={opensAt}
              onChange={(e) => setOpensAt(e.target.value)}
              required
            />
          </label>
          <label className="form-control">
            <span className="label-text text-sm py-1">Closes</span>
            <input
              type="datetime-local"
              className="input input-bordered input-sm"
              value={closesAt}
              onChange={(e) => setClosesAt(e.target.value)}
              required
            />
          </label>
          <label className="form-control">
            <span className="label-text text-sm py-1">Holdout % (0-50, never emailed)</span>
            <input
              type="number"
              min={0}
              max={50}
              className="input input-bordered input-sm"
              value={holdoutPercent}
              onChange={(e) => setHoldoutPercent(e.target.value)}
              required
            />
          </label>
        </div>

        <div>
          <h4 className="text-sm font-medium mb-2">Reward policy</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-wrap items-center gap-4">
              {REWARD_TYPES.map((type) => (
                <label key={type} className="label cursor-pointer gap-2">
                  <input
                    type="checkbox"
                    className="checkbox checkbox-sm"
                    checked={rewardTypes.includes(type)}
                    onChange={(e) =>
                      setRewardTypes(
                        e.target.checked
                          ? [...rewardTypes, type]
                          : rewardTypes.filter((value) => value !== type),
                      )
                    }
                  />
                  <span className="label-text uppercase">{type}</span>
                </label>
              ))}
            </div>
            <label className="form-control">
              <span className="label-text text-sm py-1">Redemption deadline (optional)</span>
              <input
                type="datetime-local"
                className="input input-bordered input-sm"
                value={redemptionDeadline}
                onChange={(e) => setRedemptionDeadline(e.target.value)}
                aria-describedby="redemption-deadline-help"
              />
              <span id="redemption-deadline-help" className="text-xs text-base-content/60 pt-1">
                Optional while drafting, but required before the study can be activated.
              </span>
            </label>
            <label className="label cursor-pointer justify-start gap-2">
              <input
                type="checkbox"
                className="checkbox checkbox-sm"
                checked={allowExistingAudiobook}
                onChange={(e) => setAllowExistingAudiobook(e.target.checked)}
              />
              <span className="label-text">
                Allow audiobook reward for stories that already have one
              </span>
            </label>
          </div>
        </div>

        <div>
          <h4 className="text-sm font-medium mb-2">Cohort survey versions</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {SURVEY_STUDY_COHORT_KEYS.map((cohortKey) => (
              <label key={cohortKey} className="form-control">
                <span className="label-text text-sm py-1">{COHORT_LABELS[cohortKey]}</span>
                <select
                  className="select select-bordered select-sm"
                  value={cohortSelection[cohortKey] ?? ''}
                  onChange={(e) =>
                    setCohortSelection({ ...cohortSelection, [cohortKey]: e.target.value })
                  }
                >
                  <option value="">Not included</option>
                  {options.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
          <p className="text-xs text-base-content/60 mt-2">
            Unclassified authors (U1: 2+ published stories and no purchase; U2: purchase but no
            published story) are never invited.
          </p>
        </div>

        <div className="flex justify-end gap-2">
          <button type="button" className="btn btn-sm btn-ghost" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" className="btn btn-sm btn-primary gap-1" disabled={saving}>
            {saving ? <span className="loading loading-spinner loading-xs" /> : <FiPlus />}
            Create study
          </button>
        </div>
      </div>
    </form>
  );
}
