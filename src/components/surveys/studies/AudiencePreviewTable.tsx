import { FiAlertTriangle, FiCheckCircle } from 'react-icons/fi';
import type { SurveyAudiencePreview } from '@/lib/surveys/study-types';

const CLASSIFIED_KEYS = ['C1', 'C2', 'C3'] as const;
const UNCLASSIFIED_KEYS = ['U1', 'U2'] as const;

const UNCLASSIFIED_LABELS: Record<string, string> = {
  U1: '2+ published stories, no purchase',
  U2: 'Purchase, no published story',
};

function fmt(value: number | undefined): string {
  return (value ?? 0).toLocaleString();
}

/**
 * Cohort preview: C1/C2/C3 classified / eligible / suppressed / already invited, U1/U2 shown as
 * explicitly excluded, duplicates and total with a reconciliation badge.
 */
export default function AudiencePreviewTable({ preview }: { preview: SurveyAudiencePreview }) {
  const unclassifiedTotal = UNCLASSIFIED_KEYS.reduce(
    (sum, key) => sum + (preview.unclassified?.[key] ?? 0),
    0,
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span>
          Total authors: <strong>{fmt(preview.totalAuthors)}</strong>
        </span>
        <span>
          Closed accounts: <strong>{fmt(preview.closedAccounts)}</strong>
        </span>
        <span>
          Duplicate emails: <strong>{fmt(preview.duplicateEmails)}</strong>
        </span>
        {preview.reconciles ? (
          <span className="badge badge-success gap-1">
            <FiCheckCircle /> Reconciles
          </span>
        ) : (
          <span className="badge badge-error gap-1">
            <FiAlertTriangle /> Does not reconcile
          </span>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="table table-zebra table-sm w-full">
          <thead>
            <tr>
              <th>Cohort</th>
              <th className="text-right">Classified</th>
              <th className="text-right">Email eligible</th>
              <th className="text-right">Suppressed</th>
              <th className="text-right">Already invited</th>
            </tr>
          </thead>
          <tbody>
            {CLASSIFIED_KEYS.map((key) => {
              const row = preview.cohorts?.[key];
              return (
                <tr key={key}>
                  <td className="font-medium">{key}</td>
                  <td className="text-right">{fmt(row?.classified)}</td>
                  <td className="text-right">{fmt(row?.emailEligible)}</td>
                  <td className="text-right">{fmt(row?.suppressed)}</td>
                  <td className="text-right">{fmt(row?.alreadyInvited)}</td>
                </tr>
              );
            })}
            {UNCLASSIFIED_KEYS.map((key) => (
              <tr key={key} className="opacity-70">
                <td>
                  <span className="font-medium">{key}</span>{' '}
                  <span className="text-xs text-base-content/60">{UNCLASSIFIED_LABELS[key]}</span>
                </td>
                <td className="text-right">{fmt(preview.unclassified?.[key])}</td>
                <td colSpan={3} className="text-right">
                  <span className="badge badge-ghost badge-sm">Excluded - not invited</span>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th>Total (incl. unclassified {fmt(unclassifiedTotal)})</th>
              <th className="text-right">
                {fmt(
                  CLASSIFIED_KEYS.reduce(
                    (sum, key) => sum + (preview.cohorts?.[key]?.classified ?? 0),
                    unclassifiedTotal,
                  ),
                )}
              </th>
              <th colSpan={3} />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
