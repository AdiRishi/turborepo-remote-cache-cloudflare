import { barY, defineChart } from '@tanstack/charts';
import { Chart } from '@tanstack/charts/react/tooltip';
import { scaleBand } from '@tanstack/charts/scales/band';
import { scaleLinear } from '@tanstack/charts/scales/linear';
import { tooltip } from '@tanstack/charts/tooltip';
import { useMemo } from 'react';

import { formatBytes, formatCount } from '@/lib/format';

import type { HistogramBin } from '../../../contract';

import { TooltipCard } from '../chart-parts';
import { GRID, NEUTRAL } from './series';

export interface LabelledBin extends HistogramBin {
  label: string;
}

/** Bars for the bins of a storage histogram, measured in artifacts or in bytes. */
export function BinChart({
  bins,
  measure,
  ariaLabel,
}: {
  bins: readonly LabelledBin[];
  measure: 'artifacts' | 'bytes';
  ariaLabel: string;
}) {
  const format = measure === 'bytes' ? formatBytes : formatCount;
  const definition = useMemo(
    () =>
      defineChart({
        marks: [
          barY(bins, {
            x: 'label',
            y: measure,
            fill: NEUTRAL,
            maxThickness: 40,
            radius: { end: 3 },
          }),
        ],
        scales: {
          x: {
            scale: () => scaleBand().padding(0.3),
            axis: { line: false, ticks: { size: 0 }, tickLabels: { thin: { minGap: 6 } } },
          },
          y: {
            scale: scaleLinear,
            nice: 4,
            grid: GRID,
            axis: { line: false, ticks: { size: 0, count: 4, format } },
          },
        },
        tooltip,
      }),
    [bins, measure, format],
  );
  return (
    <Chart
      definition={definition}
      height={220}
      ariaLabel={ariaLabel}
      className="text-muted-foreground"
      renderTooltipBody={({ primaryPoint }) =>
        primaryPoint ? (
          <TooltipCard
            title={primaryPoint.datum.label}
            rows={[
              { label: 'artifacts', value: formatCount(primaryPoint.datum.artifacts) },
              { label: 'stored', value: formatBytes(primaryPoint.datum.bytes) },
            ]}
          />
        ) : null
      }
    />
  );
}
