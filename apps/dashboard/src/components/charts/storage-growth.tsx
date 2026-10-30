import { areaY, defineChart, lineY } from '@tanstack/charts';
import { Chart } from '@tanstack/charts/react/tooltip';
import { scaleLinear } from '@tanstack/charts/scales/linear';
import { scalePoint } from '@tanstack/charts/scales/point';
import { tooltip } from '@tanstack/charts/tooltip';
import { useMemo } from 'react';

import { formatBytes, formatCount, formatDay } from '@/lib/format';

import type { Stats } from '../../../contract';

import { TooltipCard } from '../chart-parts';
import { GRID, NEUTRAL } from './series';

/** Stored bytes after each expiry run. */
export function StorageGrowth({ history }: { history: Stats['storage']['history'] }) {
  const definition = useMemo(
    () =>
      defineChart({
        marks: [
          areaY(history, { x: 'takenAt', y: 'bytes', fill: NEUTRAL, fillOpacity: 0.05 }),
          lineY(history, { x: 'takenAt', y: 'bytes', stroke: NEUTRAL, strokeWidth: 2 }),
        ],
        scales: {
          x: {
            scale: () => scalePoint<number>(),
            axis: {
              line: false,
              ticks: {
                size: 0,
                format: (takenAt: number) => formatDay(takenAt).split(', ')[1] ?? '',
              },
              tickLabels: { thin: { minGap: 36, priority: 'ends' } },
            },
          },
          y: {
            scale: scaleLinear,
            nice: 4,
            grid: GRID,
            axis: { line: false, ticks: { size: 0, count: 4, format: formatBytes } },
          },
        },
        focus: 'nearest-x',
        tooltip,
      }),
    [history],
  );
  return (
    <Chart
      definition={definition}
      height={200}
      ariaLabel="Stored bytes after each expiry run"
      className="text-muted-foreground"
      renderTooltipBody={({ primaryPoint }) =>
        primaryPoint ? (
          <TooltipCard
            title={formatDay(primaryPoint.datum.takenAt)}
            rows={[
              { label: 'stored', value: formatBytes(primaryPoint.datum.bytes) },
              { label: 'artifacts', value: formatCount(primaryPoint.datum.artifacts) },
            ]}
          />
        ) : null
      }
    />
  );
}
