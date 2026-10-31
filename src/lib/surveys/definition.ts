/**
 * Lightweight, read-only view of a published survey definition (survey_versions.definition).
 * The authoritative contract lives in the WebApp (`src/lib/surveys/definition-schema.ts`); the
 * admin only reads the fields it needs and tolerates unknown ones.
 */

export type LocalizedText = Record<string, string>;

export interface DefinitionOption {
  id: string;
  label: LocalizedText;
  value?: number;
  notApplicable?: boolean;
  exclusive?: boolean;
  allowOtherText?: boolean;
}

export type DefinitionLeafCondition = {
  question: string;
  operator: string;
  value?: string | number | string[];
};
export type DefinitionCondition =
  DefinitionLeafCondition | { all: DefinitionLeafCondition[] } | { any: DefinitionLeafCondition[] };

export interface DefinitionQuestion {
  id: string;
  type: string;
  label: LocalizedText;
  help?: LocalizedText;
  dimension?: string;
  required?: boolean;
  visibleWhen?: DefinitionCondition;
  options?: DefinitionOption[];
  naOptions?: DefinitionOption[];
  selection?: 'single' | 'multiple';
  validation?: Record<string, unknown>;
  screen?: string;
}

export interface SurveyDefinitionView {
  id?: string;
  version?: number;
  purpose?: string;
  title?: LocalizedText;
  estimatedMinutes?: number;
  rewardEligible?: boolean;
  questions: DefinitionQuestion[];
  [key: string]: unknown;
}

export const DEFAULT_LOCALE = 'en-US';

export function localize(text: LocalizedText | undefined, locale: string = DEFAULT_LOCALE): string {
  if (!text) return '';
  return text[locale] ?? text[DEFAULT_LOCALE] ?? Object.values(text)[0] ?? '';
}

export function asDefinition(raw: unknown): SurveyDefinitionView {
  const value = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const questions = Array.isArray(value.questions) ? (value.questions as DefinitionQuestion[]) : [];
  return { ...value, questions } as SurveyDefinitionView;
}

export function isAnswerableQuestion(question: DefinitionQuestion): boolean {
  return question.type !== 'static_content';
}

export type QuestionKind = 'single_choice' | 'multi_choice' | 'rating' | 'numeric' | 'text';

export function questionKind(question: DefinitionQuestion): QuestionKind | null {
  switch (question.type) {
    case 'static_content':
      return null;
    case 'stars':
    case 'smileys':
      return 'rating';
    case 'number':
    case 'slider':
      return 'numeric';
    case 'short_text':
    case 'long_text':
      return 'text';
    case 'multi_choice':
      return 'multi_choice';
    case 'buttons':
      return question.selection === 'multiple' ? 'multi_choice' : 'single_choice';
    default:
      return 'single_choice';
  }
}

const OPERATOR_TEXT: Record<string, string> = {
  equals: 'is',
  not_equals: 'is not',
  in: 'is one of',
  not_in: 'is not one of',
  contains: 'includes',
  not_contains: 'does not include',
  gt: '>',
  gte: '>=',
  lt: '<',
  lte: '<=',
  answered: 'is answered',
  not_answered: 'is not answered',
};

function describeLeaf(
  leaf: DefinitionLeafCondition,
  byId: Map<string, DefinitionQuestion>,
  locale: string,
): string {
  const target = byId.get(leaf.question);
  const options = target?.options ?? [];
  const valueText = (v: string | number) => {
    const option = options.find((o) => o.id === v);
    return option ? `"${localize(option.label, locale)}" (${option.id})` : String(v);
  };
  const subject = target ? `${leaf.question} "${localize(target.label, locale)}"` : leaf.question;
  const op = OPERATOR_TEXT[leaf.operator] ?? leaf.operator;
  if (leaf.operator === 'answered' || leaf.operator === 'not_answered') return `${subject} ${op}`;
  const rhs = Array.isArray(leaf.value)
    ? leaf.value.map(valueText).join(' / ')
    : leaf.value === undefined
      ? ''
      : valueText(leaf.value);
  return `${subject} ${op} ${rhs}`.trim();
}

/** Human-readable description of a `visibleWhen` condition. */
export function describeCondition(
  condition: DefinitionCondition,
  questions: DefinitionQuestion[],
  locale: string = DEFAULT_LOCALE,
): string {
  const byId = new Map(questions.map((q) => [q.id, q]));
  if ('all' in condition) {
    return condition.all.map((leaf) => describeLeaf(leaf, byId, locale)).join(' AND ');
  }
  if ('any' in condition) {
    return condition.any.map((leaf) => describeLeaf(leaf, byId, locale)).join(' OR ');
  }
  return describeLeaf(condition, byId, locale);
}

/** Stable signature of a question's option set (ids, order-insensitive) for comparability checks. */
export function optionSetSignature(question: DefinitionQuestion): string {
  const ids = [...(question.options ?? []), ...(question.naOptions ?? [])].map((o) => o.id).sort();
  return ids.join('|');
}
