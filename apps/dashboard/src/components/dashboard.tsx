import { RANGE_LABELS, tasks } from '@/lib/stats';

import type { Stats, StatsRange } from '../../contract';

import { Clients } from './clients';
import { RangeControl } from './range-control';
import { Storage } from './storage';
import { TaskBreakdown } from './task-breakdown';
import { TeamsTable } from './teams-table';
import { Headline, Timeline } from './time-saved';
import { YearStrip } from './year-strip';

export function Dashboard({
  stats,
  onRangeChange,
}: {
  stats: Stats;
  onRangeChange: (range: StatsRange) => void;
}) {
  const { current } = stats.totals;
  return (
    <div className="pt-6 pb-24">
      <YearStrip
        stats={stats}
        control={<RangeControl range={stats.range.name} onChange={onRangeChange} />}
      />
      <div className="mt-16 sm:mt-20">
        <Headline stats={stats} />
      </div>
      <div className="mt-12">
        {tasks(current) === 0 ? (
          <p className="text-muted-foreground">
            No tasks used the cache in the {RANGE_LABELS[stats.range.name].toLowerCase()}.
          </p>
        ) : (
          <TaskBreakdown current={current} previous={stats.totals.previous} />
        )}
      </div>
      <div className="mt-20">
        <Timeline stats={stats} />
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
