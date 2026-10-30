import { formatBytes, formatCount, formatDuration, formatPercent } from '@/lib/format';
import { useTweened } from '@/lib/motion';
import { tasks } from '@/lib/stats';

import type { Activity } from '../../contract';

import { countChange, Delta } from './delta';

/** Every task ends one of three ways. Amber is reserved for this server. */
const OUTCOMES = [
  {
    name: 'This server',
    color: 'var(--remote)',
    count: (activity: Activity) => activity.remoteHits,
    detail: (activity: Activity) =>
      `${formatDuration(activity.remoteTimeSavedMs)} saved, ${formatBytes(activity.downloadedBytes)} sent`,
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
    detail: (activity: Activity) =>
      `${formatDuration(activity.runTimeMs)} spent, ${formatBytes(activity.uploadedBytes)} uploaded`,
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
    <li className="grid grid-cols-[1fr_4.5rem_3.5rem_4.5rem] items-center gap-x-4 py-2.5 sm:grid-cols-[1fr_17rem_4.5rem_3.5rem_4.5rem]">
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

/** How the range's tasks were served, each outcome against the period before. */
export function TaskBreakdown({ current, previous }: { current: Activity; previous: Activity }) {
  const shownTotal = useTweened(tasks(current));
  return (
    <section aria-label="Tasks" className="tabular-nums">
      <p className="flex items-baseline gap-2.5">
        <span className="text-3xl font-semibold tracking-[-0.03em]">
          {formatCount(Math.round(shownTotal))}
        </span>
        <span className="text-muted-foreground">tasks</span>
      </p>
      <div className="mt-4 flex h-2 gap-0.5 overflow-hidden rounded-full bg-grid" aria-hidden>
        {OUTCOMES.map((outcome) => (
          <div
            key={outcome.name}
            className="transition-[flex-grow] duration-700 ease-out first:rounded-l-full last:rounded-r-full motion-reduce:transition-none"
            style={{ flexGrow: outcome.count(current), background: outcome.color }}
          />
        ))}
      </div>
      <ul className="mt-3 divide-y">
        {OUTCOMES.map((outcome) => (
          <OutcomeRow key={outcome.name} outcome={outcome} current={current} previous={previous} />
        ))}
      </ul>
    </section>
  );
}
