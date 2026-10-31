'use client';

import { useState } from 'react';
import {
  describeCondition,
  localize,
  type DefinitionQuestion,
  type SurveyDefinitionView,
} from '@/lib/surveys/definition';

export default function DefinitionViewer({
  definition,
  version,
}: {
  definition: SurveyDefinitionView;
  version: {
    version: number;
    definitionHash: string;
    publishedAt: string | Date;
    schemaVersion: number;
  };
}) {
  const [showJson, setShowJson] = useState(false);
  return (
    <div className="space-y-4">
      <div className="card bg-base-100 shadow">
        <div className="card-body p-4 gap-1 text-sm">
          <p>
            <strong>Version</strong> v{version.version} (schema {version.schemaVersion}) · published{' '}
            {new Date(version.publishedAt).toISOString().slice(0, 10)}
          </p>
          <p className="break-all">
            <strong>Definition hash</strong> {version.definitionHash}
          </p>
          {definition.purpose ? (
            <p>
              <strong>Purpose</strong> {definition.purpose}
            </p>
          ) : null}
          <p className="text-base-content/60">
            Read-only. Published versions are immutable; edit definitions in the WebApp repository.
          </p>
        </div>
      </div>

      <ol className="space-y-2">
        {definition.questions.map((question, index) => (
          <QuestionNode
            key={question.id}
            question={question}
            all={definition.questions}
            index={index}
          />
        ))}
      </ol>

      <div>
        <button className="btn btn-ghost btn-sm" onClick={() => setShowJson((v) => !v)}>
          {showJson ? 'Hide' : 'Show'} raw JSON
        </button>
        {showJson ? (
          <pre className="mt-2 max-h-[32rem] overflow-auto rounded bg-base-200 p-3 text-xs">
            {JSON.stringify(definition, null, 2)}
          </pre>
        ) : null}
      </div>
    </div>
  );
}

function QuestionNode({
  question,
  all,
  index,
}: {
  question: DefinitionQuestion;
  all: DefinitionQuestion[];
  index: number;
}) {
  const options = [...(question.options ?? []), ...(question.naOptions ?? [])];
  return (
    <li className="card bg-base-100 shadow-sm">
      <div className="card-body p-3 gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-base-content/50">{index + 1}.</span>
          <span className="badge badge-neutral badge-sm">{question.id}</span>
          <span className="badge badge-outline badge-sm">{question.type}</span>
          {question.dimension ? (
            <span className="badge badge-ghost badge-sm">{question.dimension}</span>
          ) : null}
          {question.required ? <span className="badge badge-ghost badge-sm">required</span> : null}
        </div>
        <p className="font-medium">{localize(question.label)}</p>
        {question.visibleWhen ? (
          <p className="text-xs rounded bg-warning/10 p-2">
            Branch — shown when {describeCondition(question.visibleWhen, all)}
          </p>
        ) : null}
        {options.length > 0 ? (
          <ul className="ml-4 list-disc text-sm text-base-content/80">
            {options.map((option) => (
              <li key={option.id}>
                {localize(option.label)}{' '}
                <code className="text-xs text-base-content/60">{option.id}</code>
                {typeof option.value === 'number' ? ` · value ${option.value}` : ''}
                {option.notApplicable ? ' · not applicable' : ''}
                {option.allowOtherText ? ' · other text' : ''}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </li>
  );
}
