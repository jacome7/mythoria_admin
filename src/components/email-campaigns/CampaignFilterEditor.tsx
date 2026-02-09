'use client';

import type { FilterTree, FilterCondition } from '@/lib/schemas/campaigns';
import type { CampaignAudienceSource } from '@/db/schema/campaigns';
import { FiPlus, FiTrash2, FiUsers } from 'react-icons/fi';

// Available fields per audience type
const USER_FIELDS = [
  { value: 'createdAt', label: 'Created At', type: 'timestamp' },
  { value: 'lastLoginAt', label: 'Last Login At', type: 'timestamp' },
  {
    value: 'preferredLocale',
    label: 'Preferred Locale',
    type: 'enum',
    options: ['en-US', 'pt-PT', 'es-ES', 'fr-FR', 'de-DE'],
  },
  {
    value: 'notificationPreference',
    label: 'Notification Preference',
    type: 'enum',
    options: ['essential', 'inspiration', 'news'],
  },
  {
    value: 'gender',
    label: 'Gender',
    type: 'enum',
    options: ['female', 'male', 'prefer_not_to_say'],
  },
  {
    value: 'literaryAge',
    label: 'Literary Age',
    type: 'enum',
    options: [
      'school_age',
      'teen',
      'emerging_adult',
      'experienced_adult',
      'midlife_mentor_or_elder',
    ],
  },
];

const LEAD_FIELDS = [
  {
    value: 'language',
    label: 'Language',
    type: 'enum',
    options: ['en-US', 'pt-PT', 'es-ES', 'fr-FR', 'de-DE'],
  },
  {
    value: 'emailStatus',
    label: 'Email Status',
    type: 'enum',
    options: ['ready', 'sent', 'open', 'click', 'soft_bounce', 'hard_bounce', 'unsub'],
  },
  { value: 'lastEmailSentAt', label: 'Last Email Sent At', type: 'timestamp' },
];

const OPERATORS: Record<string, { value: string; label: string }[]> = {
  timestamp: [
    { value: 'gt', label: 'After' },
    { value: 'gte', label: 'On or after' },
    { value: 'lt', label: 'Before' },
    { value: 'lte', label: 'On or before' },
    { value: 'between', label: 'Between' },
    { value: 'is_null', label: 'Is empty' },
  ],
  enum: [
    { value: 'eq', label: 'Equals' },
    { value: 'in', label: 'In' },
    { value: 'not_in', label: 'Not in' },
  ],
};

interface CampaignFilterEditorProps {
  audienceSource: CampaignAudienceSource;
  filterTree: FilterTree | null;
  onChange: (tree: FilterTree | null) => void;
  onEstimate: () => void;
  audienceCount: { users: number; leads: number; total: number } | null;
  audienceDeltaTotal?: number | null;
  isEstimating: boolean;
  readOnly?: boolean;
}

export default function CampaignFilterEditor({
  audienceSource,
  filterTree,
  onChange,
  onEstimate,
  audienceCount,
  audienceDeltaTotal = null,
  isEstimating,
  readOnly = false,
}: CampaignFilterEditorProps) {
  const availableFields = [
    ...(audienceSource === 'users' || audienceSource === 'both'
      ? USER_FIELDS.map((f) => ({ ...f, group: 'Users' }))
      : []),
    ...(audienceSource === 'leads' || audienceSource === 'both'
      ? LEAD_FIELDS.map((f) => ({ ...f, group: 'Leads' }))
      : []),
  ];

  const currentTree: FilterTree = filterTree ?? { logic: 'and', conditions: [] };

  function updateTree(tree: FilterTree) {
    onChange(tree.conditions.length === 0 ? null : tree);
  }

  function addCondition() {
    const firstField = availableFields[0];
    if (!firstField) return;
    const defaultOp = OPERATORS[firstField.type]?.[0]?.value ?? 'eq';
    const newCondition: FilterCondition = {
      field: firstField.value,
      operator: defaultOp as FilterCondition['operator'],
      value: firstField.type === 'enum' ? (firstField.options?.[0] ?? '') : '',
    };
    updateTree({ ...currentTree, conditions: [...currentTree.conditions, newCondition] });
  }

  function removeCondition(index: number) {
    const updated = currentTree.conditions.filter((_, i) => i !== index);
    updateTree({ ...currentTree, conditions: updated });
  }

  function updateCondition(index: number, condition: FilterCondition) {
    const updated = [...currentTree.conditions];
    updated[index] = condition;
    updateTree({ ...currentTree, conditions: updated });
  }

  function toggleLogic() {
    updateTree({ ...currentTree, logic: currentTree.logic === 'and' ? 'or' : 'and' });
  }

  return (
    <div className="card bg-base-100 shadow-sm border border-base-200">
      <div className="card-body">
        <div className="flex items-center justify-between mb-3">
          <h3 className="card-title text-sm">
            <FiUsers className="text-base-content/60" />
            Audience Filters
          </h3>
          <div className="flex items-center gap-2">
            {currentTree.conditions.length > 1 && !readOnly && (
              <button className="btn btn-xs btn-ghost" onClick={toggleLogic}>
                Match: <span className="font-bold">{currentTree.logic.toUpperCase()}</span>
              </button>
            )}
            <button
              className="btn btn-xs btn-outline btn-primary"
              onClick={onEstimate}
              disabled={isEstimating}
            >
              {isEstimating ? (
                <span className="loading loading-spinner loading-xs" />
              ) : (
                'Estimate Audience'
              )}
            </button>
          </div>
        </div>

        {/* Audience count display */}
        {audienceCount && (
          <div className="flex gap-4 mb-3 text-sm">
            {(audienceSource === 'users' || audienceSource === 'both') && (
              <span className="badge badge-sm badge-outline">
                Users: {audienceCount.users.toLocaleString()}
              </span>
            )}
            {(audienceSource === 'leads' || audienceSource === 'both') && (
              <span className="badge badge-sm badge-outline">
                Leads: {audienceCount.leads.toLocaleString()}
              </span>
            )}
            <span className="badge badge-sm badge-primary">
              Total: {audienceCount.total.toLocaleString()}
            </span>
            {audienceDeltaTotal !== null && audienceDeltaTotal !== 0 && (
              <span
                className={`badge badge-sm ${audienceDeltaTotal > 0 ? 'badge-success' : 'badge-error'}`}
              >
                Change:{' '}
                {audienceDeltaTotal > 0
                  ? `+${audienceDeltaTotal.toLocaleString()}`
                  : `-${Math.abs(audienceDeltaTotal).toLocaleString()}`}
              </span>
            )}
          </div>
        )}

        {/* Conditions */}
        <div className="space-y-2">
          {currentTree.conditions.map((condition, index) => {
            if ('logic' in condition) return null; // Skip nested groups for now
            const cond = condition as FilterCondition;
            const fieldDef = availableFields.find((f) => f.value === cond.field);
            const ops = OPERATORS[fieldDef?.type ?? 'enum'] ?? OPERATORS.enum;

            return (
              <div key={index} className="flex items-center gap-2 flex-wrap">
                {index > 0 && (
                  <span className="text-xs text-base-content/50 w-10 text-center">
                    {currentTree.logic.toUpperCase()}
                  </span>
                )}

                {/* Field */}
                <select
                  className="select select-bordered select-xs w-40"
                  value={cond.field}
                  onChange={(e) => {
                    const newField = availableFields.find((f) => f.value === e.target.value);
                    const newOp = OPERATORS[newField?.type ?? 'enum']?.[0]?.value ?? 'eq';
                    updateCondition(index, {
                      field: e.target.value,
                      operator: newOp as FilterCondition['operator'],
                      value: newField?.type === 'enum' ? (newField.options?.[0] ?? '') : '',
                    });
                  }}
                  disabled={readOnly}
                >
                  {availableFields.map((f) => (
                    <option key={f.value} value={f.value}>
                      {f.group ? `${f.group}: ` : ''}
                      {f.label}
                    </option>
                  ))}
                </select>

                {/* Operator */}
                <select
                  className="select select-bordered select-xs w-32"
                  value={cond.operator}
                  onChange={(e) =>
                    updateCondition(index, {
                      ...cond,
                      operator: e.target.value as FilterCondition['operator'],
                    })
                  }
                  disabled={readOnly}
                >
                  {ops.map((op) => (
                    <option key={op.value} value={op.value}>
                      {op.label}
                    </option>
                  ))}
                </select>

                {/* Value */}
                {cond.operator !== 'is_null' && (
                  <>
                    {fieldDef?.type === 'enum' &&
                    (cond.operator === 'in' || cond.operator === 'not_in') ? (
                      <select
                        className="select select-bordered select-xs w-40"
                        multiple
                        value={Array.isArray(cond.value) ? cond.value : [String(cond.value)]}
                        onChange={(e) => {
                          const selected = Array.from(e.target.selectedOptions, (o) => o.value);
                          updateCondition(index, { ...cond, value: selected });
                        }}
                        disabled={readOnly}
                      >
                        {fieldDef.options?.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    ) : fieldDef?.type === 'enum' ? (
                      <select
                        className="select select-bordered select-xs w-40"
                        value={String(cond.value)}
                        onChange={(e) => updateCondition(index, { ...cond, value: e.target.value })}
                        disabled={readOnly}
                      >
                        {fieldDef.options?.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type={fieldDef?.type === 'timestamp' ? 'date' : 'text'}
                        className="input input-bordered input-xs w-40"
                        value={String(cond.value ?? '')}
                        onChange={(e) => updateCondition(index, { ...cond, value: e.target.value })}
                        disabled={readOnly}
                      />
                    )}
                  </>
                )}

                {!readOnly && (
                  <button
                    className="btn btn-ghost btn-xs text-error"
                    onClick={() => removeCondition(index)}
                  >
                    <FiTrash2 />
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {!readOnly && (
          <button className="btn btn-ghost btn-xs mt-2" onClick={addCondition}>
            <FiPlus /> Add condition
          </button>
        )}

        {currentTree.conditions.length === 0 && (
          <p className="text-xs text-base-content/50 mt-2">
            No filters applied. All eligible recipients will be included (with default suppression
            rules).
          </p>
        )}
      </div>
    </div>
  );
}
