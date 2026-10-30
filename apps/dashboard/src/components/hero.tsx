import { useEffect, useRef, useState } from 'react';

import {
  durationParts,
  formatCount,
  formatDuration,
  formatHours,
  relativeChange,
} from '@/lib/format';
import { cacheHits, RANGE_LABELS, timeSaved } from '@/lib/stats';

import type { Stats } from '../../contract';
import type { Layer } from './charts/stacked-bars';

import { Legend, LegendItem } from './chart-parts';
import { SERIES } from './charts/series';
import { StackedBars } from './charts/stacked-bars';

const LAYERS: readonly Layer[] = [
  { series: 'remote', value: (point) => point.remoteTimeSavedMs },
  { series: 'local', value: (point) => point.localTimeSavedMs },
];

const COUNT_UP_MS = 1100;

/** Counts up to `target` once, on first render, unless the reader prefers reduced motion. */
function useCountUp(target: number) {
  const [value, setValue] = useState(target);
  const animated = useRef(false);
  useEffect(() => {
    if (animated.current || matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setValue(target);
      return undefined;
    }
    animated.current = true;
    const started = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const progress = Math.min(1, (now - started) / COUNT_UP_MS);
      setValue(target * (1 - (1 - progress) ** 4));
      if (progress < 1) {
        frame = requestAnimationFrame(tick);
      }
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
    };
  }, [target]);
  return value;
}

function HeroFigure({ ms }: { ms: number }) {
  const shown = useCountUp(ms);
  return (
    <p
      className="mt-3 text-[clamp(4rem,13vw,9.5rem)] leading-[0.82] font-semibold tracking-[-0.06em]"
      aria-label={formatDuration(ms)}
    >
      {durationParts(shown).map(({ value, unit }) => (
        <span key={unit} className="mr-[0.12em] inline-block last:mr-0" aria-hidden>
          {value}
          <span className="ml-[0.02em] text-[0.42em] font-medium tracking-normal text-muted-foreground">
            {unit}
          </span>
        </span>
      ))}
    </p>
  );
}

function Summary({ stats }: { stats: Stats }) {
  const { current, previous } = stats.totals;
  const change = relativeChange(timeSaved(current), timeSaved(previous));
  const period = RANGE_LABELS[stats.range.name].replace('Last ', 'previous ');
  return (
    <p className="mt-8 max-w-[58ch] text-lg leading-relaxed text-muted-foreground">
      Turbo replayed{' '}
      <span className="font-medium text-foreground">{formatCount(cacheHits(current))} tasks</span>{' '}
      from cache instead of running them
      {change === null ? (
        '.'
      ) : (
        <>
          , saving{' '}
          <span className="font-medium text-foreground">
            {Math.round(Math.abs(change) * 100)}% {change >= 0 ? 'more' : 'less'}
          </span>{' '}
          time than the {period}.
        </>
      )}
    </p>
  );
}

export function Hero({ stats }: { stats: Stats }) {
  const { current } = stats.totals;
  const { allTime } = stats;
  return (
    <section className="pt-12 pb-14 sm:pt-16">
      <div className="flex flex-wrap items-start justify-between gap-x-10 gap-y-6">
        <div>
          <h1 className="text-[15px] text-muted-foreground">
            Time saved, {RANGE_LABELS[stats.range.name].toLowerCase()}
          </h1>
          <HeroFigure ms={timeSaved(current)} />
        </div>
        {allTime.since === null ? null : (
          <div className="text-right max-sm:text-left">
            <p className="text-[15px] text-muted-foreground">All time</p>
            <p className="mt-1 text-2xl font-semibold tracking-[-0.03em]">
              {formatDuration(allTime.timeSavedMs)}
            </p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              since{' '}
              {new Date(allTime.since).toLocaleDateString('en-US', {
                month: 'long',
                day: 'numeric',
                year: 'numeric',
              })}
            </p>
          </div>
        )}
      </div>
      <Summary stats={stats} />
      <div className="mt-10">
        <StackedBars
          points={stats.series}
          bucketMs={stats.range.bucketMs}
          layers={LAYERS}
          height={180}
          formatValue={formatHours}
          ariaLabel="Time saved by the remote and local caches per period"
        />
        <Legend className="mt-4">
          <LegendItem
            color={SERIES.remote.color}
            label="Remote cache, this server"
            value={formatDuration(current.remoteTimeSavedMs)}
          />
          <LegendItem
            color={SERIES.local.color}
            label="Local caches on each machine"
            value={formatDuration(current.localTimeSavedMs)}
          />
        </Legend>
      </div>
    </section>
  );
}
