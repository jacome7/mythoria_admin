'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import MeasuredChartFrame from '@/components/charts/MeasuredChartFrame';
import type { QuestionResult } from '@/lib/surveys/analytics-compute';
import { fmtInt, fmtNumber, fmtPct } from './format';

const BAR = '#2563eb';
const NA_BAR = '#94a3b8';

interface ChartDatum {
  name: string;
  count: number;
  rate: number | null;
  notApplicable: boolean;
}

function ChoiceChart({ data }: { data: ChartDatum[] }) {
  const height = Math.max(160, data.length * 34 + 40);
  return (
    <div role="img" aria-label="Bar chart of answer counts" style={{ height }}>
      <MeasuredChartFrame minHeight={height}>
        {({ width, height: frameHeight }) => (
          <ResponsiveContainer width={width} height={frameHeight}>
            <BarChart
              data={data}
              layout="vertical"
              margin={{ top: 4, right: 40, left: 8, bottom: 4 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="rgba(148,163,184,0.4)"
                horizontal={false}
              />
              <XAxis type="number" allowDecimals={false} />
              <YAxis
                type="category"
                dataKey="name"
                width={190}
                tick={{ fontSize: 12 }}
                interval={0}
              />
              <Tooltip
                formatter={(value, _name, item) => {
                  const rate = (item?.payload as ChartDatum | undefined)?.rate;
                  return [
                    `${value}${rate !== null && rate !== undefined ? ` (${fmtPct(rate)})` : ''}`,
                    'n',
                  ];
                }}
              />
              <Bar dataKey="count" radius={[0, 4, 4, 0]} fill={BAR}>
                <LabelList dataKey="count" position="right" fontSize={12} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </MeasuredChartFrame>
    </div>
  );
}

function truncate(text: string, length = 34) {
  return text.length > length ? `${text.slice(0, length - 1)}…` : text;
}

export default function QuestionResultCard({ question }: { question: QuestionResult }) {
  const isRatingOrNumeric = question.kind === 'rating' || question.kind === 'numeric';
  const choiceData: ChartDatum[] = question.options
    .filter((o) => !o.notApplicable)
    .map((o) => ({ name: truncate(o.label), count: o.count, rate: o.rate, notApplicable: false }));
  if (question.kind === 'single_choice' || question.kind === 'multi_choice') {
    choiceData.sort((a, b) => b.count - a.count);
  }
  const naOptions = question.options.filter((o) => o.notApplicable);

  const distribution = question.numeric?.distribution ?? [];
  const distributionData: ChartDatum[] = distribution.map((d) => ({
    name: truncate(d.label, 24),
    count: d.count,
    rate: question.answeredN > 0 ? d.count / question.answeredN : null,
    notApplicable: false,
  }));

  return (
    <article className="card bg-base-100 shadow" aria-labelledby={`q-${question.questionId}`}>
      <div className="card-body p-4 gap-3">
        <header className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h3 id={`q-${question.questionId}`} className="font-semibold">
              <span className="badge badge-neutral badge-sm mr-2">{question.questionId}</span>
              {question.label}
            </h3>
            <p className="text-xs text-base-content/60">
              {question.type}
              {question.dimension ? ` · dimension: ${question.dimension}` : ''}
              {question.required ? ' · required' : ' · optional'}
            </p>
          </div>
          {question.isBranch ? (
            <span
              className="badge badge-warning badge-outline"
              title={question.branchCondition ?? ''}
            >
              branch question
            </span>
          ) : null}
        </header>

        {question.isBranch && question.branchCondition ? (
          <p className="text-xs rounded bg-base-200 p-2">
            Shown when: {question.branchCondition}. Respondents who never saw it (
            {fmtInt(question.notShownN)}) are <strong>not</strong> counted as skipped.
          </p>
        ) : null}

        <dl className="grid grid-cols-2 gap-2 text-sm md:grid-cols-5">
          <Metric label="Eligible (submitted)" value={question.submittedN} />
          <Metric label="Shown" value={question.shownN} />
          <Metric label="Answered (valid)" value={question.answeredN} />
          <Metric label="Skipped" value={question.skippedN} />
          <Metric label="Not applicable" value={question.notApplicableN} />
        </dl>
        {question.shownEstimated ? (
          <p className="text-xs text-warning">
            Some responses lack a shown-questions record; shown n was estimated from answers.
          </p>
        ) : null}

        {question.kind === 'text' ? (
          <p className="text-sm text-base-content/70">
            Free-text answers are available in the Open feedback tab (analyst access).
          </p>
        ) : null}

        {question.kind === 'rating' || question.kind === 'numeric' ? (
          <div className="flex flex-wrap gap-6 text-sm">
            <div>
              <span className="text-base-content/60">Mean </span>
              <strong className="text-lg">{fmtNumber(question.numeric?.mean)}</strong>
              <span className="text-base-content/60">
                {' '}
                (n = {fmtInt(question.numeric?.n)}, N/A and skipped excluded)
              </span>
            </div>
            {question.kind === 'numeric' ? (
              <div className="text-base-content/70">
                Median {fmtNumber(question.numeric?.median)} · min{' '}
                {fmtNumber(question.numeric?.min)} · max {fmtNumber(question.numeric?.max)}
              </div>
            ) : null}
          </div>
        ) : null}

        {isRatingOrNumeric && distributionData.length > 0 ? (
          <ChoiceChart data={distributionData} />
        ) : null}
        {!isRatingOrNumeric && question.kind !== 'text' && choiceData.length > 0 ? (
          <ChoiceChart data={choiceData} />
        ) : null}

        {question.kind !== 'text' && question.kind !== 'numeric' && question.options.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="table table-xs">
              <caption className="sr-only">Counts for question {question.questionId}</caption>
              <thead>
                <tr>
                  <th>Option</th>
                  <th className="text-right">n</th>
                  <th className="text-right">Rate (of {fmtInt(question.answeredN)} valid)</th>
                </tr>
              </thead>
              <tbody>
                {question.options.map((option) => (
                  <tr
                    key={option.optionId}
                    className={option.notApplicable ? 'text-base-content/60' : ''}
                  >
                    <td>
                      {option.label}
                      {option.notApplicable ? (
                        <span className="badge badge-ghost badge-xs ml-2" style={{ color: NA_BAR }}>
                          N/A, excluded from rates and means
                        </span>
                      ) : null}
                    </td>
                    <td className="text-right">{fmtInt(option.count)}</td>
                    <td className="text-right">
                      {option.rate === null ? '—' : fmtPct(option.rate)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        {naOptions.length === 0 && question.notApplicableN > 0 ? (
          <p className="text-xs text-base-content/60">
            {fmtInt(question.notApplicableN)} not-applicable answers are excluded from rates and
            means.
          </p>
        ) : null}

        <p className="text-xs text-base-content/50">
          Denominator: {question.denominator.selectionRate}.
          {question.otherTextN > 0 ? ` ${fmtInt(question.otherTextN)} added “other” text.` : ''}
        </p>
      </div>
    </article>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dt className="text-xs text-base-content/60">{label}</dt>
      <dd className="font-semibold">{fmtInt(value)}</dd>
    </div>
  );
}
