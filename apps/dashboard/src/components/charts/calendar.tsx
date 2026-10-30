import { cell, defineChart } from '@tanstack/charts';
import { Chart } from '@tanstack/charts/react/tooltip';
import { scaleBand } from '@tanstack/charts/scales/band';
import { tooltip } from '@tanstack/charts/tooltip';
import { useMemo } from 'react';

import { formatCount, formatDay, formatDuration } from '@/lib/format';

import type { Stats } from '../../../contract';

import { Legend, TooltipCard } from '../chart-parts';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const LEVELS = [0, 0.3, 0.55, 0.78, 1] as const;

/** The paint for a level of the sequential amber ramp. Level 0 is an empty day. */
const levelColor = (level: number) =>
  level === 0
    ? 'var(--grid)'
    : `color-mix(in oklab, var(--remote) ${Math.round((LEVELS[level] ?? 1) * 100)}%, var(--background))`;

/** Splits the non-empty days into four levels by quartile, so one busy day doesn't flatten the rest. */
const levelThresholds = (values: readonly number[]) => {
  const sorted = values.filter((value) => value > 0).toSorted((a, b) => a - b);
  return [0.25, 0.5, 0.75].map((quantile) => sorted[Math.floor(quantile * sorted.length)] ?? 0);
};

export function TimeSavedCalendar({ calendar }: { calendar: Stats['calendar'] }) {
  const definition = useMemo(() => {
    const first = calendar[0]?.day ?? 0;
    const offset = new Date(first).getUTCDay();
    const thresholds = levelThresholds(calendar.map(({ timeSavedMs }) => timeSavedMs));
    const rows = calendar.map((entry, index) => ({
      ...entry,
      week: Math.floor((index + offset) / 7),
      weekday: new Date(entry.day).getUTCDay(),
      level:
        entry.timeSavedMs === 0
          ? 0
          : 1 + thresholds.filter((threshold) => entry.timeSavedMs > threshold).length,
    }));
    const monthStarts = rows.filter(
      ({ day }) => new Date(day).getUTCDate() <= 7 && new Date(day).getUTCDay() === 0,
    );
    const weekMonths = new Map(
      monthStarts.map(({ week, day }) => [
        week,
        new Date(day).toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' }),
      ]),
    );
    return defineChart({
      marks: [
        cell(rows, {
          x: 'week',
          y: 'weekday',
          color: 'level',
          radius: 2.5,
          inset: 1.5,
        }),
      ],
      scales: {
        x: {
          scale: () => scaleBand<number>(),
          axis: {
            line: false,
            ticks: {
              size: 0,
              values: [...weekMonths.keys()],
              format: (week: number) => weekMonths.get(week) ?? '',
            },
          },
        },
        y: {
          // A configured instance keeps Sunday to Saturday; a factory would infer the order from the data.
          scale: scaleBand<number>().domain([0, 1, 2, 3, 4, 5, 6]),
          axis: {
            line: false,
            ticks: {
              size: 0,
              values: [1, 3, 5],
              format: (weekday: number) => WEEKDAYS[weekday] ?? '',
            },
          },
        },
      },
      color: { domain: [0, 1, 2, 3, 4], range: LEVELS.map((_, level) => levelColor(level)) },
      tooltip,
    });
  }, [calendar]);

  return (
    <div>
      <div className="overflow-x-auto">
        <div className="min-w-[720px]">
          <Chart
            definition={definition}
            aspectRatio={6.2}
            initialWidth={1040}
            ariaLabel="Time saved per day over the last year"
            className="text-muted-foreground"
            renderTooltipBody={({ primaryPoint }) =>
              primaryPoint ? (
                <TooltipCard
                  title={formatDay(primaryPoint.datum.day)}
                  rows={[
                    { label: 'saved', value: formatDuration(primaryPoint.datum.timeSavedMs) },
                    {
                      label: primaryPoint.datum.runs === 1 ? 'run' : 'runs',
                      value: formatCount(primaryPoint.datum.runs),
                    },
                  ]}
                />
              ) : null
            }
          />
        </div>
      </div>
      <Legend className="mt-3 justify-end gap-x-1.5 text-xs">
        <li className="mr-1 text-muted-foreground">Less</li>
        {LEVELS.map((_, level) => (
          <li
            key={level}
            className="size-3 rounded-[3px]"
            style={{ background: levelColor(level) }}
            aria-hidden
          />
        ))}
        <li className="ml-1 text-muted-foreground">More</li>
      </Legend>
    </div>
  );
}
