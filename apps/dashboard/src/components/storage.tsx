import { formatAge, formatBytes, formatCount, relativeChange } from '@/lib/format';

import type { Stats } from '../../contract';

import { Sparkline } from './charts/sparkline';
import { Delta } from './delta';

const HOURS_PER_DAY = 24;

export function Storage({ stats }: { stats: Stats }) {
  const { latest, history, expirationHours } = stats.storage;
  const first = history[0];
  const growth =
    first && history.length > 1 && latest ? relativeChange(latest.bytes, first.bytes) : null;
  return (
    <div>
      <h2 className="text-sm text-muted-foreground">Stored</h2>
      {latest ? (
        <>
          <div className="mt-2 flex items-end justify-between gap-6">
            <p className="flex items-center gap-2.5">
              <span className="text-3xl font-semibold tracking-[-0.03em] tabular-nums">
                {formatBytes(latest.bytes)}
              </span>
              <Delta change={growth === null ? null : { ratio: growth }} better={null} />
            </p>
            {history.length > 1 ? (
              <Sparkline
                values={history.map(({ bytes }) => bytes)}
                className="h-9 w-32 text-muted-foreground"
              />
            ) : null}
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            {formatCount(latest.artifacts)} artifacts, kept{' '}
            {Math.round(expirationHours / HOURS_PER_DAY)} days. Measured{' '}
            {formatAge(latest.takenAt, stats.generatedAt)}.
          </p>
        </>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">
          Measured by the first expiry run, at 03:00 UTC.
        </p>
      )}
    </div>
  );
}
