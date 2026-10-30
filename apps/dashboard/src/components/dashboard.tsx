import type { Stats } from '../../contract';

import { Section } from './chart-parts';
import { TimeSavedCalendar } from './charts/calendar';
import { Clients } from './clients';
import { Hero } from './hero';
import { KeyFigures } from './key-figures';
import { Storage } from './storage';
import { TaskSources } from './task-sources';
import { TeamsTable } from './teams-table';

export function Dashboard({ stats }: { stats: Stats }) {
  return (
    <>
      <Hero stats={stats} />
      <KeyFigures stats={stats} />
      <TaskSources stats={stats} />
      <Section
        title="A year of saved time"
        description="Time the caches saved each day over the last twelve months, in UTC days."
      >
        <TimeSavedCalendar calendar={stats.calendar} />
      </Section>
      <Storage stats={stats} />
      <Clients stats={stats} />
      {stats.teams.length > 0 ? <TeamsTable teams={stats.teams} /> : null}
    </>
  );
}
