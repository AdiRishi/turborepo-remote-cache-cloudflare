import type { ReactNode } from 'react';

import { formatAge, formatBytes, formatCount, formatPercent } from '@/lib/format';
import { cacheHits, hitRate, RANGE_LABELS, tasks } from '@/lib/stats';

import type { Stats } from '../../contract';

function Figure({
  label,
  value,
  detail,
  change,
}: {
  label: string;
  value: string;
  detail: ReactNode;
  change?: string | null;
}) {
  return (
    <div className="py-6 sm:px-6 sm:first:pl-0 lg:py-1">
      <dt className="text-[15px] text-muted-foreground">{label}</dt>
      <dd className="mt-2 text-[2.5rem] leading-none font-semibold tracking-[-0.045em]">{value}</dd>
      <dd className="mt-3 text-sm leading-snug text-muted-foreground">{detail}</dd>
      {change ? <dd className="mt-1 text-sm text-muted-foreground">{change}</dd> : null}
    </div>
  );
}

const signed = (value: number, unit: string) =>
  `${value > 0 ? '+' : value < 0 ? '−' : '±'}${Math.abs(value)}${unit}`;

export function KeyFigures({ stats }: { stats: Stats }) {
  const { current, previous } = stats.totals;
  const rate = hitRate(current);
  const previousRate = hitRate(previous);
  const period = RANGE_LABELS[stats.range.name].replace('Last ', 'previous ');
  const { latest } = stats.storage;
  const share = (part: number) => formatPercent(current.runs === 0 ? 0 : part / current.runs);

  return (
    <dl className="grid border-t sm:grid-cols-2 sm:divide-x lg:grid-cols-4 lg:py-8 max-sm:divide-y">
      <Figure
        label="Cache hit rate"
        value={rate === null ? '–' : formatPercent(rate)}
        detail={`${formatCount(cacheHits(current))} of ${formatCount(tasks(current))} tasks came from a cache`}
        change={
          rate === null || previousRate === null
            ? null
            : `${signed(Math.round((rate - previousRate) * 100), ' points')} on the ${period}`
        }
      />
      <Figure
        label="Runs"
        value={formatCount(current.runs)}
        detail={`${share(current.ciRuns)} in CI, ${share(current.agentRuns)} started by coding agents`}
      />
      <Figure
        label="Stored"
        value={latest ? formatBytes(latest.bytes) : '–'}
        detail={
          latest
            ? `${formatCount(latest.artifacts)} artifacts, measured ${formatAge(latest.takenAt, stats.generatedAt)}`
            : 'Measured by the daily expiry task at 03:00 UTC'
        }
      />
      <Figure
        label="Downloaded"
        value={formatBytes(current.downloadedBytes)}
        detail={`${formatCount(current.downloads)} artifacts, and ${formatBytes(current.uploadedBytes)} uploaded`}
      />
    </dl>
  );
}
