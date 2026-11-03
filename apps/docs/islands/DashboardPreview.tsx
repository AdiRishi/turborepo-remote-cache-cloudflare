import '@fontsource-variable/geist';
import '@fontsource-variable/geist-mono';
import '@turborepo-remote-cache/dashboard/palette.css';
import type { StatsRange } from '@turborepo-remote-cache/dashboard/contract';

import { Dashboard } from '@turborepo-remote-cache/dashboard/dashboard';
import { useMemo, useState } from 'react';

import { demoStats } from '../lib/demo-stats';
import { useSeen } from '../lib/playback';

export const client = 'visible';

export default function DashboardPreview() {
  const [range, setRange] = useState<StatsRange>('30d');
  const stats = useMemo(() => demoStats(range), [range]);
  // Mounting on first sight lets the dashboard's numbers count up while someone watches.
  const { ref, seen } = useSeen<HTMLDivElement>();
  return (
    <figure
      data-dashboard
      className="not-prose [--blume-font-body:'Geist_Variable',ui-sans-serif,system-ui,sans-serif] [--blume-font-mono:'Geist_Mono_Variable',ui-monospace,monospace] mx-auto mt-10 max-w-6xl overflow-hidden rounded-xl border border-border bg-background font-sans text-foreground shadow-[0_30px_80px_-30px_rgb(14_16_19/0.35)]"
    >
      <figcaption className="sr-only">
        The dashboard a server shows at its root, filled with example data: time saved, hit rates,
        time saved per day, and the busiest teams. Pick a range to see it change.
      </figcaption>
      <div className="flex items-center gap-3 border-b border-border px-4 py-2.5">
        <span className="flex gap-1.5" aria-hidden>
          <span className="size-2.5 rounded-full bg-miss" />
          <span className="size-2.5 rounded-full bg-miss" />
          <span className="size-2.5 rounded-full bg-miss" />
        </span>
        <span className="mx-auto truncate rounded-full bg-muted px-4 py-1 font-mono text-xs text-muted-foreground">
          turborepo-remote-cache.acme.workers.dev
        </span>
        <span className="w-[2.625rem]" aria-hidden />
      </div>
      <div ref={ref} className="relative h-[56rem] overflow-hidden px-5 sm:px-8">
        {seen ? <Dashboard stats={stats} onRangeChange={setRange} /> : null}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-linear-to-t from-background to-transparent"
        />
      </div>
    </figure>
  );
}
