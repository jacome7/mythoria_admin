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
import type { loadFunnel } from '@/db/services/survey-analytics';
import { fmtDuration, fmtInt } from './format';
import { NotTrackedBadge, RateStat, StatTile } from './SurveyUi';

export type FunnelData = Awaited<ReturnType<typeof loadFunnel>>;

export default function FunnelPanel({
  funnel,
  duration,
}: {
  funnel: FunnelData;
  duration?: { measuredN: number; medianMs: number | null; note: string | null };
}) {
  const { counts, rates, delivery } = funnel;
  const stages = [
    { name: 'Eligible (snapshot)', value: counts.eligible },
    { name: 'Invited (excl. holdout)', value: counts.invited },
    ...(counts.sent !== null ? [{ name: 'Sent (email)', value: counts.sent }] : []),
    { name: 'Survey opened', value: counts.opened },
    { name: 'Started', value: counts.started },
    { name: 'Completed', value: counts.completed },
  ];

  return (
    <div className="space-y-4">
      <div className="card bg-base-100 shadow">
        <div className="card-body p-4">
          <h3 className="font-semibold">Invitation funnel</h3>
          <div role="img" aria-label="Funnel bar chart" style={{ height: 260 }}>
            <MeasuredChartFrame minHeight={260}>
              {({ width, height }) => (
                <ResponsiveContainer width={width} height={height}>
                  <BarChart
                    data={stages}
                    layout="vertical"
                    margin={{ top: 4, right: 48, left: 8, bottom: 4 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="rgba(148,163,184,0.4)"
                      horizontal={false}
                    />
                    <XAxis type="number" allowDecimals={false} />
                    <YAxis type="category" dataKey="name" width={170} tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Bar dataKey="value" fill="#2563eb" radius={[0, 4, 4, 0]}>
                      <LabelList dataKey="value" position="right" fontSize={12} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </MeasuredChartFrame>
          </div>
          <ul className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-base-content/70">
            <li>
              Delivered:{' '}
              <NotTrackedBadge hint="Inbox delivery is not reported by the email provider" />
            </li>
            <li>Holdout (never emailed): {fmtInt(counts.holdout)}</li>
            {counts.sent === null ? (
              <li>
                Sent: <NotTrackedBadge label="no linked invite campaign" />
              </li>
            ) : null}
            <li>Reminders sent: {fmtInt(delivery.reminderSent)}</li>
          </ul>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <RateStat label="Invitation rate" rate={rates.invitationRate} />
        <RateStat label="Survey visit rate" rate={rates.surveyVisitRate} />
        <RateStat label="Response rate" rate={rates.responseRate} />
        <RateStat label="Completion rate (of started)" rate={rates.completionRate} />
      </div>
      {counts.sent !== null && counts.sent > 0 ? (
        <p className="text-xs text-base-content/60">
          Response rate of all invited users (excl. holdout):{' '}
          {rates.responseRateOfInvited.value === null
            ? 'n/a'
            : `${(rates.responseRateOfInvited.value * 100).toFixed(1)}%`}{' '}
          (n = {fmtInt(rates.responseRateOfInvited.numerator)} of{' '}
          {fmtInt(rates.responseRateOfInvited.denominator)}).
        </p>
      ) : null}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile
          label="Median completion time"
          value={duration ? fmtDuration(duration.medianMs) : 'n/a'}
          hint={duration ? `measured on ${fmtInt(duration.measuredN)} responses` : undefined}
        />
        <StatTile
          label="Email delivery failures"
          value={fmtInt(delivery.failed)}
          tone={delivery.failed > 0 ? 'error' : 'default'}
          hint={`${fmtInt(delivery.skipped)} skipped, ${fmtInt(delivery.queued)} queued (kept out of response rate)`}
        />
      </div>
    </div>
  );
}
