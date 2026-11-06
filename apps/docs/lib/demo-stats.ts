import type {
  Activity,
  ActivityPoint,
  Share,
  Stats,
  StatsRange,
  TeamActivity,
} from '@turborepo-remote-cache/dashboard/contract';

export const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const MB = 1_000_000;

const BUCKETS = {
  '24h': { count: 24, ms: HOUR },
  '7d': { count: 7, ms: DAY },
  '30d': { count: 30, ms: DAY },
  '90d': { count: 90, ms: DAY },
} as const satisfies Record<StatsRange, { count: number; ms: number }>;

// A fixed clock keeps every render of the preview identical: Tuesday, 3 November 2026, 14:00 UTC.
const NOW = Date.UTC(2026, 10, 3, 14);

const TEAMS = [
  { team: 'web', share: 0.47 },
  { team: 'platform', share: 0.29 },
  { team: 'mobile', share: 0.16 },
  { team: 'design-system', share: 0.08 },
];

// Deterministic noise, so the bars look organic without changing between renders.
const noise = (seed: number) => {
  const x = Math.sin(seed * 12.9898) * 43_758.5453;
  return 0.75 + (x - Math.floor(x)) * 0.5;
};

/**
 * How busy a bucket is: quiet nights and weekends, busy working hours and weekdays. Hours are the reader's
 * own, so the team works while they do.
 */
const busyness = (start: number, bucketMs: number) => {
  const date = new Date(start);
  if (bucketMs === HOUR) {
    const hour = date.getHours();
    return hour >= 8 && hour <= 18 ? 1 : 0.15;
  }
  const day = date.getDay();
  return day === 0 || day === 6 ? 0.25 : 1;
};

/** `remoteShare` is the share of task lookups that this server answers with a hit. */
export const activity = (runs: number, remoteShare = 0.41): Activity => {
  const lookups = runs * 14;
  const localHits = Math.round(lookups * 0.44);
  const remoteHits = Math.round(lookups * remoteShare);
  const remoteMisses = lookups - localHits - remoteHits;
  return {
    localHits,
    localMisses: remoteHits + remoteMisses,
    remoteHits,
    remoteMisses,
    localTimeSavedMs: localHits * 21_000,
    remoteTimeSavedMs: remoteHits * 37_000,
    runs,
    ciRuns: Math.round(runs * 0.62),
    agentRuns: Math.round(runs * 0.18),
    uploads: remoteMisses,
    uploadedBytes: remoteMisses * 3.4 * MB,
    runTimeMs: remoteMisses * 46_000,
    downloads: remoteHits,
    downloadedBytes: remoteHits * 3.4 * MB,
  };
};

/** Adds two activities field by field. */
export const add = (total: Activity, item: Activity): Activity => ({
  localHits: total.localHits + item.localHits,
  localMisses: total.localMisses + item.localMisses,
  remoteHits: total.remoteHits + item.remoteHits,
  remoteMisses: total.remoteMisses + item.remoteMisses,
  localTimeSavedMs: total.localTimeSavedMs + item.localTimeSavedMs,
  remoteTimeSavedMs: total.remoteTimeSavedMs + item.remoteTimeSavedMs,
  runs: total.runs + item.runs,
  ciRuns: total.ciRuns + item.ciRuns,
  agentRuns: total.agentRuns + item.agentRuns,
  uploads: total.uploads + item.uploads,
  uploadedBytes: total.uploadedBytes + item.uploadedBytes,
  runTimeMs: total.runTimeMs + item.runTimeMs,
  downloads: total.downloads + item.downloads,
  downloadedBytes: total.downloadedBytes + item.downloadedBytes,
});

export const sum = (items: readonly Activity[]): Activity =>
  items.reduce((total, item) => add(total, item), activity(0));

const shares = (total: number, parts: readonly (readonly [string, number])[]): Share[] =>
  parts.map(([name, share]) => ({ name, count: Math.round(total * share) }));

const buildSeries = (from: number, count: number, ms: number): ActivityPoint[] => {
  const runsPerBucket = ms === HOUR ? 9 : 150;
  return Array.from({ length: count }, (_, index) => {
    const start = from + index * ms;
    const runs = Math.round(runsPerBucket * busyness(start, ms) * noise(start / ms));
    return Object.assign(activity(runs), { start });
  });
};

const buildTeams = (current: Activity, series: readonly ActivityPoint[]): TeamActivity[] =>
  TEAMS.map(({ team, share }) =>
    Object.assign(activity(Math.round(current.runs * share)), {
      team,
      storedArtifacts: Math.round(21_400 * share),
      storedBytes: Math.round(64_000 * MB * share),
      timeSavedSeries: series.map(
        (point) =>
          (point.localTimeSavedMs + point.remoteTimeSavedMs) * share * noise(point.start + share),
      ),
    }),
  );

const buildStorage = (to: number, rangeMs: number): Stats['storage'] => {
  // The expiry task measures storage once a day.
  const days = Math.max(2, rangeMs / DAY);
  const history = Array.from({ length: days }, (_, index) => ({
    takenAt: to - (days - index) * DAY,
    artifacts: Math.round(17_800 + index * 120),
    bytes: Math.round((52_000 + index * 400) * MB),
  }));
  return { expirationHours: 720, latest: history.at(-1) ?? null, history };
};

const buildClients = (current: Activity): Stats['clients'] => {
  const requests = current.downloads + current.uploads;
  return {
    ci: shares(current.runs, [
      ['GITHUB_ACTIONS', 0.55],
      ['local', 0.38],
      ['BUILDKITE', 0.07],
    ]),
    agents: shares(current.agentRuns, [
      ['claude-code', 0.52],
      ['codex', 0.31],
      ['cursor', 0.17],
    ]),
    versions: shares(requests, [
      ['2.11.10', 0.71],
      ['2.11.9', 0.22],
      ['2.10.4', 0.07],
    ]),
    platforms: shares(requests, [
      ['linux x86_64', 0.58],
      ['macos aarch64', 0.36],
      ['linux aarch64', 0.06],
    ]),
  };
};

/** A busy four-team monorepo's stats, shaped like `GET /stats` for the given range. */
export const demoStats = (range: StatsRange): Stats => {
  const { count, ms } = BUCKETS[range];
  const to = Math.floor(NOW / ms) * ms + ms;
  const from = to - count * ms;
  const series = buildSeries(from, count, ms);
  const current = sum(series);
  return {
    enabled: true,
    generatedAt: NOW,
    range: { name: range, from, to, bucketMs: ms },
    // The period before had fewer runs, and the server answered fewer of them, so the deltas point up.
    totals: { current, previous: activity(Math.round(current.runs * 0.81), 0.34) },
    series,
    allTime: { timeSavedMs: 1_870 * HOUR, since: NOW - 214 * DAY },
    storage: buildStorage(to, count * ms),
    teams: buildTeams(current, series),
    clients: buildClients(current),
  };
};
