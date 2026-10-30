import { formatCount } from '@/lib/format';

import type { Stats } from '../../contract';
import type { Layer } from './charts/stacked-bars';

import { Legend, LegendItem, Section } from './chart-parts';
import { SERIES } from './charts/series';
import { StackedBars } from './charts/stacked-bars';

const LOOKUP_LAYERS: readonly Layer[] = [
  { series: 'remote', value: (point) => point.remoteHits },
  { series: 'local', value: (point) => point.localHits },
  { series: 'ran', value: (point) => point.remoteMisses },
];

export function TaskSources({ stats }: { stats: Stats }) {
  const { current } = stats.totals;
  return (
    <Section
      title="Where tasks came from"
      description="Every task checks the cache on its machine first and asks this server only when that misses. A task that misses both runs. Each bar shows the share of that period's tasks."
      className="mt-14"
    >
      <StackedBars
        points={stats.series}
        bucketMs={stats.range.bucketMs}
        layers={LOOKUP_LAYERS}
        height={240}
        formatValue={formatCount}
        share
        ariaLabel="Tasks served by the remote cache, a local cache, or run"
      />
      <Legend className="mt-4">
        <LegendItem
          color={SERIES.remote.color}
          label={SERIES.remote.label}
          value={formatCount(current.remoteHits)}
        />
        <LegendItem
          color={SERIES.local.color}
          label={SERIES.local.label}
          value={formatCount(current.localHits)}
        />
        <LegendItem
          color={SERIES.ran.color}
          label={SERIES.ran.label}
          value={formatCount(current.remoteMisses)}
        />
      </Legend>
    </Section>
  );
}
