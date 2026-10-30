import type { ReactNode } from 'react';

import {
  durationParts,
  formatCount,
  formatDuration,
  formatPercent,
  relativeChange,
} from '@/lib/format';
import { useTweened } from '@/lib/motion';
import {
  cachedShare,
  hitRate,
  RANGE_LABELS,
  savedPerRun,
  serverHitRate,
  timeSaved,
} from '@/lib/stats';

import type { Activity, Stats } from '../../contract';
import type { Layer } from './charts/stacked-bars';

import { SERIES } from './charts/series';
import { StackedBars } from './charts/stacked-bars';
import { countChange, Delta, rateChange } from './delta';

const HOUR = 3_600_000;

const LAYERS: readonly Layer[] = [
  { series: 'remote', value: (point) => point.remoteTimeSavedMs },
  { series: 'local', value: (point) => point.localTimeSavedMs },
];

const sinceDate = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

function Figure({ label, value, change }: { label: string; value: string; change: ReactNode }) {
  return (
    <div>
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1">
        <span className="text-3xl font-semibold tracking-[-0.03em]">{value}</span>
        {change}
      </dd>
    </div>
  );
}

function KeyFigures({ current, previous }: { current: Activity; previous: Activity }) {
  const rate = hitRate(current);
  const serverRate = serverHitRate(current);
  const perRun = savedPerRun(current);
  const previousPerRun = savedPerRun(previous);
  return (
    <dl className="grid grid-cols-2 gap-x-12 gap-y-7 tabular-nums">
      <Figure
        label="Cache hit rate"
        value={rate === null ? '–' : formatPercent(rate)}
        change={<Delta change={rateChange(rate, hitRate(previous))} better="up" />}
      />
      <Figure
        label="Server hit rate"
        value={serverRate === null ? '–' : formatPercent(serverRate)}
        change={<Delta change={rateChange(serverRate, serverHitRate(previous))} better="up" />}
      />
      <Figure
        label="Saved per run"
        value={perRun === null ? '–' : formatDuration(perRun)}
        change={
          <Delta
            change={
              perRun === null || previousPerRun === null
                ? null
                : countChange(perRun, previousPerRun)
            }
            better="up"
          />
        }
      />
      <Figure
        label="Runs"
        value={formatCount(current.runs)}
        change={<Delta change={countChange(current.runs, previous.runs)} better={null} />}
      />
    </dl>
  );
}

/** All task time in the range, split into what each cache replayed and what ran. */
function TaskTimeMeter({ current, previous }: { current: Activity; previous: Activity }) {
  const share = cachedShare(current);
  const shownShare = useTweened(share ?? 0);
  if (share === null) {
    return null;
  }
  const parts = [
    { ...SERIES.remote, ms: current.remoteTimeSavedMs },
    { ...SERIES.local, ms: current.localTimeSavedMs },
    { label: 'Ran', color: 'var(--miss)', ms: current.runTimeMs },
  ];
  return (
    <div className="tabular-nums">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <p className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
          <span className="text-3xl font-semibold tracking-[-0.03em]">
            {formatPercent(shownShare)}
          </span>
          <span className="text-muted-foreground">of all task time came from a cache</span>
          <Delta change={rateChange(share, cachedShare(previous))} better="up" />
        </p>
        <p className="text-sm text-muted-foreground">
          {formatDuration(timeSaved(current) + current.runTimeMs)} of task time
        </p>
      </div>
      <div className="mt-4 flex h-3 gap-0.5 overflow-hidden rounded-full bg-grid" aria-hidden>
        {parts.map(({ label, color, ms }) => (
          <div
            key={label}
            className="transition-[flex-grow] duration-700 ease-out first:rounded-l-full last:rounded-r-full motion-reduce:transition-none"
            style={{ flexGrow: ms, background: color }}
          />
        ))}
      </div>
      <ul className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm">
        {parts.map(({ label, color, ms }) => (
          <li key={label} className="flex items-center gap-2">
            <span className="size-2.5 rounded-[3px]" style={{ background: color }} aria-hidden />
            <span className="text-muted-foreground">{label}</span>
            <span className="font-medium">{formatDuration(ms)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Hero({ stats, control }: { stats: Stats; control: ReactNode }) {
  const { current, previous } = stats.totals;
  const { allTime } = stats;
  const saved = timeSaved(current);
  const shown = useTweened(saved);
  const change = relativeChange(saved, timeSaved(previous));
  const period = RANGE_LABELS[stats.range.name].toLowerCase();
  return (
    <section aria-label="Time saved">
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <p className="text-sm text-muted-foreground tabular-nums">
          <span className="text-foreground">{formatDuration(allTime.timeSavedMs)}</span> saved
          {allTime.since === null ? null : ` since ${sinceDate.format(allTime.since)}`}
        </p>
        {control}
      </div>

      <div className="mt-12 grid items-end gap-x-16 gap-y-10 lg:grid-cols-[1fr_auto]">
        <div>
          <p className="text-[clamp(4.5rem,12vw,8.5rem)] leading-[0.85] font-semibold tracking-[-0.06em] tabular-nums">
            <span className="sr-only">{formatDuration(saved)}</span>
            {durationParts(shown).map(({ value, unit }) => (
              <span key={unit} className="mr-[0.14em] inline-block last:mr-0" aria-hidden>
                {value}
                <span className="ml-[0.03em] text-[0.4em] font-medium tracking-normal text-muted-foreground">
                  {unit}
                </span>
              </span>
            ))}
          </p>
          <p className="mt-4 flex items-center gap-3 text-muted-foreground">
            saved in the {period}
            <span title={`Compared with the ${period.replace('last', 'previous')}`}>
              <Delta change={change === null ? null : { ratio: change }} better="up" />
            </span>
          </p>
        </div>
        <KeyFigures current={current} previous={previous} />
      </div>

      <div className="mt-12">
        <TaskTimeMeter current={current} previous={previous} />
      </div>
    </section>
  );
}

export function Timeline({ stats }: { stats: Stats }) {
  return (
    <section aria-label="Time saved per period">
      <h2 className="mb-4 text-sm text-muted-foreground">
        Time saved per {stats.range.bucketMs === HOUR ? 'hour' : 'day'}
      </h2>
      <StackedBars
        points={stats.series}
        bucketMs={stats.range.bucketMs}
        layers={LAYERS}
        height={140}
        formatValue={formatDuration}
        ariaLabel="Time saved by this server and by local caches per period"
      />
    </section>
  );
}
