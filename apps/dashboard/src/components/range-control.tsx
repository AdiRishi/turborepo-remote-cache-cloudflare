import { ToggleGroup } from 'radix-ui';
import { useLayoutEffect, useRef, useState } from 'react';

import { RANGE_LABELS } from '@/lib/stats';

import type { StatsRange } from '../../contract';

import { STATS_RANGES } from '../../contract';

const isRange = (value: string): value is StatsRange =>
  STATS_RANGES.some((range) => range === value);

/** A segmented control whose pill glides to the chosen range as soon as it is picked. */
export function RangeControl({
  range,
  onChange,
}: {
  range: StatsRange;
  onChange: (range: StatsRange) => void;
}) {
  const [picked, setPicked] = useState(range);
  const [confirmed, setConfirmed] = useState(range);
  if (range !== confirmed) {
    setConfirmed(range);
    setPicked(range);
  }
  const rootRef = useRef<HTMLDivElement>(null);
  const [pill, setPill] = useState<{ left: number; width: number } | null>(null);
  useLayoutEffect(() => {
    const item = rootRef.current?.querySelector<HTMLElement>('[data-state="on"]');
    if (item) {
      setPill({ left: item.offsetLeft, width: item.offsetWidth });
    }
  }, [picked]);

  return (
    <ToggleGroup.Root
      ref={rootRef}
      type="single"
      value={picked}
      onValueChange={(value) => {
        if (isRange(value)) {
          setPicked(value);
          onChange(value);
        }
      }}
      aria-label="Time range"
      className="relative flex rounded-full bg-muted p-0.5"
    >
      {pill ? (
        <span
          aria-hidden
          className="absolute inset-y-0.5 rounded-full bg-background shadow-[0_1px_2px_rgb(0_0_0/0.12),0_0_0_1px_var(--border)] transition-[left,width] duration-300 ease-[cubic-bezier(0.3,1.3,0.5,1)] motion-reduce:transition-none"
          style={pill}
        />
      ) : null}
      {STATS_RANGES.map((option) => (
        <ToggleGroup.Item
          key={option}
          value={option}
          aria-label={RANGE_LABELS[option]}
          className="relative h-7 rounded-full px-3 text-sm text-muted-foreground tabular-nums transition-colors outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/60 data-[state=on]:text-foreground"
        >
          {option}
        </ToggleGroup.Item>
      ))}
    </ToggleGroup.Root>
  );
}
