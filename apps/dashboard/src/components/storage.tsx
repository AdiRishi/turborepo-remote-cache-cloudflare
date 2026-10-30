import { formatAge } from '@/lib/format';

import type { Stats } from '../../contract';

import { Section } from './chart-parts';
import { StorageGrowth } from './charts/storage-growth';

const HOURS_PER_DAY = 24;

export function Storage({ stats }: { stats: Stats }) {
  const { latest, history, expirationHours } = stats.storage;
  const expiryDays = Math.round(expirationHours / HOURS_PER_DAY);
  if (!latest) {
    return (
      <Section
        title="Storage"
        description="The daily expiry task measures storage at 03:00 UTC. Numbers appear here after its first run."
      />
    );
  }
  return (
    <Section
      title="Storage"
      description={`Expiry deletes artifacts after ${expiryDays} days. This snapshot was taken ${formatAge(latest.takenAt, stats.generatedAt)}, when the last expiry run finished.`}
    >
      {history.length > 1 ? <StorageGrowth history={history} /> : null}
    </Section>
  );
}
