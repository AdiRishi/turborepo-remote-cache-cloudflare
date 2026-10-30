import { cn } from 'cn';
import { ArrowDown, ArrowUp } from 'lucide-react';

import { relativeChange } from '@/lib/format';

export type Change = { ratio: number } | { points: number };

export const countChange = (current: number, previous: number): Change | null => {
  const ratio = relativeChange(current, previous);
  return ratio === null ? null : { ratio };
};

export const rateChange = (current: number | null, previous: number | null): Change | null =>
  current === null || previous === null ? null : { points: current - previous };

const TONES = {
  good: 'bg-positive/12 text-positive',
  bad: 'bg-negative/12 text-negative',
  neutral: 'bg-muted text-muted-foreground',
} as const;

/**
 * A change against the previous period: `ratio` is relative, as from `relativeChange`, and `points` is
 * the difference between two rates. `better` is the direction that is good news, and sets the colour.
 */
export function Delta({ change, better }: { change: Change | null; better: 'up' | 'down' | null }) {
  if (change === null) {
    return null;
  }
  const value = 'ratio' in change ? change.ratio : change.points;
  const percent = Math.round(Math.abs(value) * 100);
  let direction: 'up' | 'down' | null = null;
  if (percent > 0) {
    direction = value > 0 ? 'up' : 'down';
  }
  let tone: keyof typeof TONES = 'neutral';
  if (direction && better) {
    tone = direction === better ? 'good' : 'bad';
  }
  const Arrow = direction === 'down' ? ArrowDown : ArrowUp;
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-0.5 rounded-md px-1.5 py-0.5 text-xs font-medium tabular-nums',
        TONES[tone],
      )}
    >
      {direction ? <Arrow className="size-3" strokeWidth={2.5} aria-hidden /> : null}
      <span className="sr-only">{direction ?? 'unchanged'}, </span>
      {'ratio' in change ? `${percent}%` : `${percent} ${percent === 1 ? 'pt' : 'pts'}`}
    </span>
  );
}
