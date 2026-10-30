import { RANGE_LABELS, tasks } from '@/lib/stats';

import type { Stats, StatsRange } from '../../contract';

import { Clients } from './clients';
import { Hero, Timeline } from './hero';
import { RangeControl } from './range-control';
import { Storage } from './storage';
import { TaskBreakdown } from './task-breakdown';
import { TeamsTable } from './teams-table';

export function Dashboard({
  stats,
  onRangeChange,
}: {
  stats: Stats;
  onRangeChange: (range: StatsRange) => void;
}) {
  const { current } = stats.totals;
  return (
    <div className="pt-8 pb-24">
      <Hero
        stats={stats}
        control={<RangeControl range={stats.range.name} onChange={onRangeChange} />}
      />
      <div className="mt-16">
        <Timeline stats={stats} />
      </div>
      <div className="mt-20">
        {tasks(current) === 0 ? (
          <p className="text-muted-foreground">
            No tasks used the cache in the {RANGE_LABELS[stats.range.name].toLowerCase()}.
          </p>
        ) : (
          <TaskBreakdown current={current} previous={stats.totals.previous} />
        )}
      </div>
      {stats.teams.length > 1 ? (
        <div className="mt-20">
          <TeamsTable teams={stats.teams} />
        </div>
      ) : null}
      <div className="mt-20 grid gap-x-16 gap-y-12 border-t pt-10 lg:grid-cols-[1fr_2fr]">
        <Storage stats={stats} />
        <Clients stats={stats} />
      </div>
    </div>
  );
}
