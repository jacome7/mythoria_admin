import Link from 'next/link';
import { FiClipboard } from 'react-icons/fi';

interface SurveyCampaignBadgeProps {
  surveyStudyId: string | null;
  cohortKey: string | null;
  mode: string | null;
  /** Compact variant for list rows; the default variant links to the study page. */
  compact?: boolean;
}

/** "Survey" badge shown on survey campaigns (study / cohort / mode). */
export default function SurveyCampaignBadge({
  surveyStudyId,
  cohortKey,
  mode,
  compact = false,
}: SurveyCampaignBadgeProps) {
  const detail = [cohortKey, mode].filter(Boolean).join(' · ');

  if (compact) {
    return (
      <span className="badge badge-sm badge-secondary gap-1" title={`Study ${surveyStudyId ?? ''}`}>
        <FiClipboard className="w-3 h-3" />
        Survey{detail ? ` ${detail}` : ''}
      </span>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className="badge badge-secondary gap-1">
        <FiClipboard className="w-3 h-3" />
        Survey
      </span>
      {cohortKey && <span className="badge badge-outline">Cohort {cohortKey}</span>}
      {mode && <span className="badge badge-outline capitalize">{mode}</span>}
      {surveyStudyId && (
        <Link href={`/surveys/studies/${surveyStudyId}`} className="link link-primary text-xs">
          Open study
        </Link>
      )}
    </div>
  );
}
