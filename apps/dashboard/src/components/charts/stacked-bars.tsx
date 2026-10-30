import { barY, defineChart, stack } from '@tanstack/charts';
import { Chart } from '@tanstack/charts/react/tooltip';
import { scaleBand } from '@tanstack/charts/scales/band';
import { scaleLinear } from '@tanstack/charts/scales/linear';
import { tooltip } from '@tanstack/charts/tooltip';
import { useMemo } from 'react';

import { formatBucket, formatPercent } from '@/lib/format';

import type { ActivityPoint } from '../../../contract';
import type { SeriesName } from './series';

import { TooltipCard } from '../chart-parts';
import { GRID, SERIES } from './series';

export interface Layer {
  series: SeriesName;
  value: (point: ActivityPoint) => number;
}

/**
 * Bars per time bucket, one stacked segment per layer, drawn bottom-up in layer order. With `share`,
 * every bar is scaled to 100% so the chart shows each layer's share of the bucket.
 */
export function StackedBars({
  points,
  bucketMs,
  layers,
  height,
  formatValue,
  ariaLabel,
  showAxis = true,
  share = false,
}: {
  points: readonly ActivityPoint[];
  bucketMs: number;
  layers: readonly Layer[];
  height: number;
  formatValue: (value: number) => string;
  ariaLabel: string;
  showAxis?: boolean;
  share?: boolean;
}) {
  const definition = useMemo(() => {
    const rows = points.flatMap((point) =>
      layers.map((layer) => ({
        start: point.start,
        series: layer.series,
        value: layer.value(point),
      })),
    );
    const order = layers.map((layer) => layer.series);
    return defineChart({
      marks: [
        barY(rows, {
          x: 'start',
          y: 'value',
          color: 'series',
          layout: stack(share ? { order, offset: 'normalize' } : { order }),
          maxThickness: 22,
          radius: { end: 3 },
          stroke: 'var(--background)',
          strokeWidth: 1.5,
        }),
      ],
      scales: {
        x: {
          scale: () => scaleBand<number>().padding(0.22),
          axis: showAxis
            ? {
                line: false,
                ticks: { size: 0, format: (start: number) => formatBucket(start, bucketMs) },
                tickLabels: { thin: { minGap: 28, priority: 'ends' } },
              }
            : false,
        },
        y: {
          scale: scaleLinear,
          nice: 4,
          grid: GRID,
          axis: showAxis
            ? {
                line: false,
                ticks: { size: 0, count: 4, format: share ? formatPercent : formatValue },
              }
            : false,
        },
      },
      color: { domain: order, range: order.map((series) => SERIES[series].color) },
      focus: 'group-x',
      tooltip,
    });
  }, [points, layers, bucketMs, formatValue, showAxis, share]);

  return (
    <Chart
      definition={definition}
      height={height}
      ariaLabel={ariaLabel}
      className="text-muted-foreground"
      renderTooltipBody={({ points: focused }) => {
        const first = focused[0];
        if (!first) {
          return null;
        }
        const valueOf = (layer: Layer) =>
          focused.find((point) => point.datum.series === layer.series)?.datum.value ?? 0;
        const total = layers.reduce((sum, layer) => sum + valueOf(layer), 0);
        return (
          <TooltipCard
            title={formatBucket(first.datum.start, bucketMs, { long: true })}
            rows={layers.toReversed().map((layer) => ({
              color: SERIES[layer.series].color,
              label: SERIES[layer.series].label,
              value: formatValue(valueOf(layer)),
              detail: share && total > 0 ? formatPercent(valueOf(layer) / total) : undefined,
            }))}
          />
        );
      }}
    />
  );
}
