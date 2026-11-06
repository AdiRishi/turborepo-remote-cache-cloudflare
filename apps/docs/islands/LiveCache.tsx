// scripts/record-live-cache.ts records this island into the README's GIF. Re-record after a change that shows.

import '@fontsource-variable/geist';
import '@fontsource-variable/geist-mono';
import '@turborepo-remote-cache/dashboard/palette.css';
import type { Activity } from '@turborepo-remote-cache/dashboard/contract';

import { Delta } from '@turborepo-remote-cache/dashboard/components/delta';
import {
  KeyFigures,
  TaskTimeMeter,
  Timeline,
} from '@turborepo-remote-cache/dashboard/components/hero';
import {
  durationParts,
  formatDuration,
  relativeChange,
} from '@turborepo-remote-cache/dashboard/lib/format';
import { useTweened } from '@turborepo-remote-cache/dashboard/lib/motion';
import { timeSaved } from '@turborepo-remote-cache/dashboard/lib/stats';
import { useMemo } from 'react';

import type { Line, Script } from '../lib/terminal';

import { finished, hit, liveStats, SAVED_BEFORE_MS, upload } from '../lib/live-stats';
import { usePlayback, useSeen } from '../lib/playback';
import {
  activePane,
  COMMAND,
  Frame,
  lastBeat,
  preamble,
  prefix,
  run,
  TASKS,
  Terminal,
} from '../lib/terminal';

export const client = 'load';

type PaneId = 'laptop' | 'ci' | 'dashboard';

const [ui, api, web] = TASKS;

const lines: Line<PaneId>[] = [
  ...preamble('laptop', 1250),
  ...run('laptop', 1600, [
    [0, prefix(ui), 'cache miss, executing ', [ui.hash, 'dim']],
    [150, prefix(ui), `> ${ui.script}`],
    [500, prefix(api), 'cache miss, executing ', [api.hash, 'dim']],
    [560, prefix(web), 'cache miss, executing ', [web.hash, 'dim']],
    [700, prefix(api), `> ${api.script}`],
    [850, prefix(web), `> ${web.script}`],
    [3000, prefix(web), '✓ Compiled successfully in 31.4s'],
    [3400, ''],
    [3450, ' Tasks:    3 successful, 3 total'],
    [3500, 'Cached:    0 cached, 3 total'],
    [3550, '  Time:    48.913s'],
  ]),
  ...preamble('ci', 6850),
  ...run('ci', 7250, [
    [0, prefix(ui), 'cache hit, replaying logs ', [ui.hash, 'dim']],
    [40, prefix(ui), `> ${ui.script}`],
    [140, prefix(api), 'cache hit, replaying logs ', [api.hash, 'dim']],
    [180, prefix(api), `> ${api.script}`],
    [400, prefix(web), 'cache hit, replaying logs ', [web.hash, 'dim']],
    [440, prefix(web), `> ${web.script}`],
    [480, prefix(web), '✓ Compiled successfully in 31.4s'],
    [800, ''],
    [850, ' Tasks:    3 successful, 3 total'],
    [900, 'Cached:    3 cached, 3 total'],
    [950, '  Time:    1.204s ', ['>>> FULL TURBO', 'turbo']],
  ]),
];

const script: Script<PaneId> = {
  commands: [
    { pane: 'laptop', at: 400, text: COMMAND },
    { pane: 'ci', at: 6000, text: COMMAND },
  ],
  lines,
  prompts: [
    { pane: 'laptop', at: 5400 },
    { pane: 'ci', at: 8500 },
  ],
};

// What reaches the server, and when: each miss uploads as its task finishes, each hit downloads as it
// replays, and each run reports when it ends.
const reaches = (at: number, activity: Activity) => ({ pane: 'dashboard' as const, at, activity });

const events = [
  reaches(2700, upload(ui)),
  reaches(3800, upload(api)),
  reaches(4650, upload(web)),
  reaches(5150, finished({ ci: false })),
  reaches(7250, hit(ui)),
  reaches(7390, hit(api)),
  reaches(7650, hit(web)),
  reaches(8200, finished({ ci: true })),
];

const beats = [...script.commands, ...script.lines, ...script.prompts, ...events];

// The finished runs stay on screen this long before the loop starts over.
const HOLD_MS = 4500;
const LOOP = lastBeat(beats) + HOLD_MS;

const savedAtStart = timeSaved(liveStats([]).totals.current);

/** The dashboard's headline, with a chip for the time this morning's runs have saved so far. */
function Headline({ saved, gained }: { saved: number; gained: number }) {
  const shown = useTweened(saved);
  const shownGain = useTweened(gained);
  return (
    <div className="mt-7 flex flex-wrap items-end gap-x-4 gap-y-2">
      <p className="text-[clamp(3.25rem,7vw,4.5rem)] leading-[0.85] font-semibold tracking-[-0.06em] tabular-nums">
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
      <span
        className={`mb-1 rounded-md bg-remote/15 px-2 py-0.5 text-sm font-medium text-remote tabular-nums transition-opacity duration-300 ${
          gained > 0 ? 'opacity-100' : 'opacity-0'
        }`}
      >
        +{formatDuration(shownGain)}
      </span>
    </div>
  );
}

function LiveDashboard({ elapsed }: { elapsed: number }) {
  const landed = events.filter((event) => event.at <= elapsed).length;
  const stats = useMemo(
    () => liveStats(events.slice(0, landed).map((event) => event.activity)),
    [landed],
  );
  const { current, previous } = stats.totals;
  const saved = timeSaved(current);
  const change = relativeChange(saved, timeSaved(previous));
  return (
    <div className="flex h-full flex-col justify-between gap-8 px-5 pt-6 pb-4 sm:px-6">
      <div>
        <div className="flex items-center justify-between gap-4 text-sm text-muted-foreground tabular-nums">
          <p>
            <span className="text-foreground">{formatDuration(SAVED_BEFORE_MS + saved)}</span> saved
            since Apr 3, 2026
          </p>
          <p className="flex items-center gap-2.5">
            Last 24 hours
            <span className="relative flex size-2">
              <span
                key={landed}
                className="absolute inset-0 rounded-full bg-remote motion-safe:animate-[cache-ping_1.4s_cubic-bezier(0,0,0.2,1)_forwards]"
              />
              <span className="size-2 rounded-full bg-remote" />
            </span>
          </p>
        </div>
        <Headline saved={saved} gained={saved - savedAtStart} />
        <p className="mt-3 flex items-center gap-3 text-muted-foreground">
          saved in the last 24 hours
          <Delta change={change === null ? null : { ratio: change }} better="up" />
        </p>
      </div>
      <KeyFigures current={current} previous={previous} />
      <TaskTimeMeter current={current} previous={previous} />
      <Timeline stats={stats} />
    </div>
  );
}

const terminals = [
  { id: 'laptop', title: 'laptop', detail: '~/acme', prompt: '~/acme $' },
  { id: 'ci', title: 'ci', detail: 'github actions', prompt: 'runner $' },
] as const;

export default function LiveCache() {
  const { ref, seen } = useSeen<HTMLElement>();
  const { elapsed } = usePlayback(LOOP, { playing: seen });
  const active = activePane(beats, elapsed, 'laptop');
  return (
    // From 42rem wide, the panes sit side by side: the figure keeps its 65rem layout and zooms to fit the
    // column. tan(atan2(a, b)) is a / b as a plain number, which zoom needs.
    <div className="not-prose mx-auto my-8 max-w-[65rem] @container">
      <figure
        ref={ref}
        data-live-cache
        data-loop={LOOP}
        className="grid gap-x-3 gap-y-5 overflow-hidden rounded-xl bg-[#0e1013] p-4 pt-6 font-mono text-[11px] leading-[1.7] text-[#d9dce1] shadow-[0_30px_80px_-30px_rgb(14_16_19/0.55)] ring-1 ring-black/10 sm:text-xs @2xl:w-[65rem] @2xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] @2xl:[zoom:min(1,tan(atan2(100cqw,65rem)))] dark:ring-white/10"
      >
        <figcaption className="sr-only">
          A laptop runs turbo run build. Three tasks miss the cache, run, and upload their outputs,
          and the dashboard counts the work. A CI runner then runs the same command, replays all
          three tasks from the cache, and finishes in 1.2 seconds with FULL TURBO, while the
          dashboard adds the 1 minute 20 seconds it saved. Then the loop starts over.
        </figcaption>
        <div aria-hidden="true" className="grid gap-y-5">
          {terminals.map((pane) => (
            <Frame
              key={pane.id}
              title={pane.title}
              detail={pane.detail}
              active={pane.id === active}
              className="h-[24.5rem] px-4 pt-7 pb-3"
            >
              <Terminal script={script} pane={pane.id} prompt={pane.prompt} elapsed={elapsed} />
            </Frame>
          ))}
        </div>
        <Frame title="dashboard" detail="cache.acme.dev" active={active === 'dashboard'}>
          <div
            aria-hidden="true"
            data-dashboard
            className="dark h-full [--background:#0e1013] [--blume-font-body:'Geist_Variable',ui-sans-serif,system-ui,sans-serif] [--blume-font-mono:'Geist_Mono_Variable',ui-monospace,monospace] font-sans text-[15px] leading-normal text-foreground"
          >
            {seen ? <LiveDashboard elapsed={elapsed} /> : null}
          </div>
        </Frame>
      </figure>
    </div>
  );
}
