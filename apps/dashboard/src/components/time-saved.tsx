import { durationParts, formatDuration, formatHours, relativeChange } from '@/lib/format';
import { useTweened } from '@/lib/motion';
import { RANGE_LABELS, timeSaved } from '@/lib/stats';

import type { Stats } from '../../contract';
import type { Layer } from './charts/stacked-bars';

import { Legend, LegendItem } from './chart-parts';
import { SERIES } from './charts/series';
import { StackedBars } from './charts/stacked-bars';
import { Delta } from './delta';

const HOUR = 3_600_000;

const LAYERS: readonly Layer[] = [
  { series: 'remote', value: (point) => point.remoteTimeSavedMs },
  { series: 'local', value: (point) => point.localTimeSavedMs },
];

export function Headline({ stats }: { stats: Stats }) {
  const { current, previous } = stats.totals;
  const saved = timeSaved(current);
  const shown = useTweened(saved);
  const change = relativeChange(saved, timeSaved(previous));
  const period = RANGE_LABELS[stats.range.name].toLowerCase();
  return (
    <div>
      <p className="text-[clamp(4.5rem,13vw,9rem)] leading-[0.85] font-semibold tracking-[-0.06em] tabular-nums">
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
      <p className="mt-4 flex items-center gap-3 text-muted-foreground">
        saved in the {period}
        <span title={`Compared with the ${period.replace('last', 'previous')}`}>
          <Delta change={change === null ? null : { ratio: change }} better="up" />
        </span>
      </p>
    </div>
  );
}

export function Timeline({ stats }: { stats: Stats }) {
  const { current } = stats.totals;
  return (
    <section aria-label="Time saved per period">
      <div className="mb-5 flex flex-wrap items-baseline justify-between gap-x-8 gap-y-2">
        <h2 className="text-sm font-medium">
          Time saved per {stats.range.bucketMs === HOUR ? 'hour' : 'day'}
        </h2>
        <Legend>
          <LegendItem
            color={SERIES.remote.color}
            label={SERIES.remote.label}
            value={formatDuration(current.remoteTimeSavedMs)}
          />
          <LegendItem
            color={SERIES.local.color}
            label={SERIES.local.label}
            value={formatDuration(current.localTimeSavedMs)}
          />
        </Legend>
      </div>
      <StackedBars
        points={stats.series}
        bucketMs={stats.range.bucketMs}
        layers={LAYERS}
        height={150}
        formatValue={formatHours}
        ariaLabel="Time saved by this server and by local caches per period"
      />
    </section>
  );
}
