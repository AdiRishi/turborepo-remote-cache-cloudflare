import { formatAge, formatBytes } from '@/lib/format';

import type { HistogramBin, Stats } from '../../contract';
import type { LabelledBin } from './charts/bin-chart';

import { Section } from './chart-parts';
import { BinChart } from './charts/bin-chart';
import { StorageGrowth } from './charts/storage-growth';

const HOURS_PER_DAY = 24;

const days = (hours: number) => hours / HOURS_PER_DAY;

const ageLabel = (lower: number, upper: number | null) => {
  if (upper === null) {
    return `> ${days(lower)} days`;
  }
  if (lower === 0) {
    return `< ${days(upper)} day${days(upper) === 1 ? '' : 's'}`;
  }
  return `${days(lower)}–${days(upper)} days`;
};

const sizeLabel = (lower: number, upper: number | null) => {
  if (upper === null) {
    return `> ${formatBytes(lower)}`;
  }
  if (lower === 0) {
    return `< ${formatBytes(upper)}`;
  }
  const [lowerValue, lowerUnit] = formatBytes(lower).split(' ');
  const upperText = formatBytes(upper);
  return upperText.endsWith(` ${lowerUnit}`)
    ? `${lowerValue}–${upperText}`
    : `${formatBytes(lower)}–${upperText}`;
};

/** Labels each bin by its bounds; a bin's lower bound is the previous bin's upper bound. */
const labelBins = (bins: readonly HistogramBin[], label: typeof ageLabel): LabelledBin[] =>
  bins.map((bin, index) => ({ ...bin, label: label(bins[index - 1]?.below ?? 0, bin.below) }));

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
      {history.length > 1 ? (
        <div className="mb-12">
          <h3 className="mb-4 text-[15px] font-medium">Stored over time</h3>
          <StorageGrowth history={history} />
        </div>
      ) : null}
      <div className="grid gap-x-12 gap-y-12 lg:grid-cols-2">
        <div>
          <h3 className="mb-4 text-[15px] font-medium">Artifacts by age</h3>
          <BinChart
            bins={labelBins(latest.ages, ageLabel).filter(
              (bin) => bin.artifacts > 0 || (bin.below ?? Infinity) <= expirationHours,
            )}
            measure="artifacts"
            ariaLabel="Stored artifacts by age"
          />
        </div>
        <div>
          <h3 className="mb-4 text-[15px] font-medium">Space by artifact size</h3>
          <BinChart
            bins={labelBins(latest.sizes, sizeLabel)}
            measure="bytes"
            ariaLabel="Stored bytes by artifact size"
          />
        </div>
      </div>
    </Section>
  );
}
