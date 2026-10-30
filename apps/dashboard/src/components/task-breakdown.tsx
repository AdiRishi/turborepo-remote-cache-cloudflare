import type { ReactNode } from 'react';

import {
  formatBytes,
  formatCount,
  formatDuration,
  formatPercent,
  relativeChange,
} from '@/lib/format';
import { useTweened } from '@/lib/motion';
import { hitRate, serverHitRate, tasks, timeSaved } from '@/lib/stats';

import type { Activity } from '../../contract';
import type { Change } from './delta';

import { Delta } from './delta';

const countChange = (current: number, previous: number): Change | null => {
  const ratio = relativeChange(current, previous);
  return ratio === null ? null : { ratio };
};

const rateChange = (current: number | null, previous: number | null): Change | null =>
  current === null || previous === null ? null : { points: current - previous };

const perRun = (activity: Activity) =>
  activity.runs === 0 ? null : timeSaved(activity) / activity.runs;

/** Every task ends one of three ways. Amber is reserved for this server. */
const OUTCOMES = [
  {
    name: 'This server',
    color: 'var(--remote)',
    count: (activity: Activity) => activity.remoteHits,
    detail: (activity: Activity) => `${formatDuration(activity.remoteTimeSavedMs)} saved`,
    better: 'up',
  },
  {
    name: 'Local caches',
    color: 'var(--local)',
    count: (activity: Activity) => activity.localHits,
    detail: (activity: Activity) => `${formatDuration(activity.localTimeSavedMs)} saved`,
    better: 'up',
  },
  {
    name: 'Ran',
    color: 'var(--miss)',
    count: (activity: Activity) => activity.remoteMisses,
    detail: (activity: Activity) => `${formatBytes(activity.uploadedBytes)} uploaded`,
    better: 'down',
  },
] as const;

function OutcomeRow({
  outcome,
  current,
  previous,
}: {
  outcome: (typeof OUTCOMES)[number];
  current: Activity;
  previous: Activity;
}) {
  const count = outcome.count(current);
  const shown = useTweened(count);
  const total = tasks(current);
  return (
    <li className="grid grid-cols-[1fr_auto_3.5rem_4.5rem] items-center gap-x-4 py-2.5 sm:grid-cols-[1fr_9rem_auto_3.5rem_4.5rem]">
      <span className="flex items-center gap-2.5">
        <span
          className="size-2.5 rounded-[3px]"
          style={{ background: outcome.color }}
          aria-hidden
        />
        {outcome.name}
      </span>
      <span className="text-right text-muted-foreground max-sm:hidden">
        {outcome.detail(current)}
      </span>
      <span className="text-right font-medium">{formatCount(Math.round(shown))}</span>
      <span className="text-right text-muted-foreground">
        {formatPercent(total === 0 ? 0 : count / total)}
      </span>
      <span className="flex justify-end">
        <Delta change={countChange(count, outcome.count(previous))} better={outcome.better} />
      </span>
    </li>
  );
}

function Stat({ label, value, change }: { label: string; value: string; change: ReactNode }) {
  return (
    <div className="px-5 py-4 first:pl-0 max-lg:odd:pl-0">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1">
        <span className="text-xl font-semibold tracking-[-0.02em]">{value}</span>
        {change}
      </dd>
    </div>
  );
}

/** How the range's tasks were served, and the rates that follow from it, each against the period before. */
export function TaskBreakdown({ current, previous }: { current: Activity; previous: Activity }) {
  const total = tasks(current);
  const shownTotal = useTweened(total);
  const rate = hitRate(current);
  const serverRate = serverHitRate(current);
  const savedPerRun = perRun(current);
  const previousPerRun = perRun(previous);

  return (
    <section aria-label="Tasks" className="tabular-nums">
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-2">
        <p className="flex items-baseline gap-2.5">
          <span className="text-4xl font-semibold tracking-[-0.04em]">
            {formatCount(Math.round(shownTotal))}
          </span>
          <span className="text-muted-foreground">tasks</span>
        </p>
        {rate === null ? null : (
          <p className="flex items-center gap-2.5 text-muted-foreground">
            <span>
              <span className="font-medium text-foreground">{formatPercent(rate)}</span> from a
              cache
            </span>
            <Delta change={rateChange(rate, hitRate(previous))} better="up" />
          </p>
        )}
      </div>

      <div className="mt-5 flex h-2 gap-0.5 overflow-hidden rounded-full bg-grid" aria-hidden>
        {OUTCOMES.map((outcome) => (
          <div
            key={outcome.name}
            className="transition-[flex-grow] duration-700 ease-out first:rounded-l-full last:rounded-r-full motion-reduce:transition-none"
            style={{ flexGrow: outcome.count(current), background: outcome.color }}
          />
        ))}
      </div>

      <ul className="mt-3 divide-y text-sm">
        {OUTCOMES.map((outcome) => (
          <OutcomeRow key={outcome.name} outcome={outcome} current={current} previous={previous} />
        ))}
      </ul>

      <dl className="mt-2 grid grid-cols-2 border-t lg:grid-cols-4 lg:divide-x">
        <Stat
          label="Server hit rate"
          value={serverRate === null ? '–' : formatPercent(serverRate)}
          change={<Delta change={rateChange(serverRate, serverHitRate(previous))} better="up" />}
        />
        <Stat
          label="Saved per run"
          value={savedPerRun === null ? '–' : formatDuration(savedPerRun)}
          change={
            <Delta
              change={
                savedPerRun === null || previousPerRun === null
                  ? null
                  : countChange(savedPerRun, previousPerRun)
              }
              better="up"
            />
          }
        />
        <Stat
          label="Runs"
          value={formatCount(current.runs)}
          change={<Delta change={countChange(current.runs, previous.runs)} better={null} />}
        />
        <Stat
          label="Sent"
          value={formatBytes(current.downloadedBytes)}
          change={
            <Delta
              change={countChange(current.downloadedBytes, previous.downloadedBytes)}
              better={null}
            />
          }
        />
      </dl>
    </section>
  );
}
