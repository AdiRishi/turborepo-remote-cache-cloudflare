import type { ReactNode } from 'react';

import { useState } from 'react';

import { formatCount, formatDay, formatDuration } from '@/lib/format';

import type { Stats } from '../../contract';

const DAY = 86_400_000;
const HEIGHT = 56;

const sinceDate = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

/**
 * Time saved on each day of the last year, with the chosen range bracketed at its right end. Pointing
 * at a day puts its numbers in the caption.
 */
export function YearStrip({ stats, control }: { stats: Stats; control: ReactNode }) {
  const { calendar, allTime, range } = stats;
  const [hovered, setHovered] = useState<number | null>(null);
  const max = Math.max(1, ...calendar.map(({ timeSavedMs }) => timeSavedMs));
  const rangeDays = Math.ceil((range.to - range.from) / DAY);
  const bracketStart = Math.max(0, calendar.length - rangeDays);
  const day = hovered === null ? undefined : calendar[hovered];

  return (
    <div>
      <div
        className="relative touch-none"
        style={{ height: HEIGHT }}
        onPointerMove={(event) => {
          const box = event.currentTarget.getBoundingClientRect();
          const index = Math.floor(((event.clientX - box.left) / box.width) * calendar.length);
          setHovered(Math.min(calendar.length - 1, Math.max(0, index)));
        }}
        onPointerLeave={() => {
          setHovered(null);
        }}
        role="img"
        aria-label={`Time saved per day over the last year, ${formatDuration(allTime.timeSavedMs)} in total`}
      >
        <div
          aria-hidden
          className="absolute inset-y-[-6px] right-0 rounded-sm border-t-2 border-remote bg-remote/8 transition-[left] duration-500 ease-out motion-reduce:transition-none"
          style={{ left: `${(bracketStart / calendar.length) * 100}%` }}
        />
        <div aria-hidden className="relative flex h-full items-end">
          {calendar.map(({ day: start, timeSavedMs }, index) => (
            <div key={start} className="flex h-full flex-1 items-end justify-center">
              <div
                className="w-[70%] min-w-px rounded-t-[1px] transition-colors duration-300"
                style={{
                  height: timeSavedMs === 0 ? 1 : Math.max(2, (timeSavedMs / max) * HEIGHT),
                  background:
                    index === hovered
                      ? 'var(--foreground)'
                      : timeSavedMs === 0
                        ? 'var(--grid)'
                        : index >= bracketStart
                          ? 'var(--remote)'
                          : 'color-mix(in oklab, var(--foreground) 24%, var(--background))',
                }}
              />
            </div>
          ))}
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <p className="text-sm text-muted-foreground tabular-nums">
          {day ? (
            <>
              <span className="text-foreground">{formatDay(day.day)}</span>
              {`, ${formatDuration(day.timeSavedMs)} saved in ${formatCount(day.runs)} ${day.runs === 1 ? 'run' : 'runs'}`}
            </>
          ) : (
            <>
              <span className="text-foreground">{formatDuration(allTime.timeSavedMs)}</span> saved
              {allTime.since === null ? null : ` since ${sinceDate.format(allTime.since)}`}
            </>
          )}
        </p>
        {control}
      </div>
    </div>
  );
}
