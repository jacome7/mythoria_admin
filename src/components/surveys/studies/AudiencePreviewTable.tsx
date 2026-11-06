import { FiAlertTriangle, FiCheckCircle } from 'react-icons/fi';
import type { SurveyAudiencePreview } from '@/lib/surveys/study-types';

const CLASSIFIED_KEYS = ['C1', 'C2', 'C3'] as const;
/**
 * Labels of legacy excluded groups. Every author is now classified as C1/C2/C3, so a current
 * WebApp preview returns no `unclassified` groups at all. Older WebApp revisions may still send
 * U1 (2+ published, no purchase) or U2 (purchase, no published story); rows are driven by the keys
 * actually present, so nothing is rendered when the block is missing or empty.
 */
const LEGACY_UNCLASSIFIED_LABELS: Record<string, string> = {
  U1: '2+ published stories, no purchase (legacy)',
  U2: 'Purchase, no published story (legacy)',
};
const LEGACY_UNCLASSIFIED_ORDER = Object.keys(LEGACY_UNCLASSIFIED_LABELS);

function fmt(value: number | undefined): string {
  return (value ?? 0).toLocaleString();
}

function unclassifiedKeys(unclassified: Record<string, number> | undefined): string[] {
  const present = Object.keys(unclassified ?? {});
  return [
    ...LEGACY_UNCLASSIFIED_ORDER.filter((key) => present.includes(key)),
    ...present.filter((key) => !LEGACY_UNCLASSIFIED_ORDER.includes(key)).sort(),
  ];
}

/**
 * Cohort preview: C1/C2/C3 classified / eligible / suppressed / already invited, duplicates and
 * total with a reconciliation badge. Every author belongs to exactly one cohort; legacy excluded
 * groups are shown (as not invited) only when an older WebApp still returns them.
 */
export default function AudiencePreviewTable({ preview }: { preview: SurveyAudiencePreview }) {
  const excludedKeys = unclassifiedKeys(preview.unclassified);
  const unclassifiedTotal = excludedKeys.reduce(
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
            {excludedKeys.map((key) => (
              <tr key={key} className="opacity-70">
                <td>
                  <span className="font-medium">{key}</span>{' '}
                  <span className="text-xs text-base-content/60">
                    {LEGACY_UNCLASSIFIED_LABELS[key] ?? 'Excluded group'}
                  </span>
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
              <th>
                {excludedKeys.length > 0
                  ? `Total (incl. unclassified ${fmt(unclassifiedTotal)})`
                  : 'Total'}
              </th>
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
