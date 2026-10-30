/** The time windows `GET /stats` accepts in its `range` query parameter. */
export const STATS_RANGES = ['24h', '7d', '30d', '90d'] as const;

export type StatsRange = (typeof STATS_RANGES)[number];

/** Cache activity summed over a time bucket, a team, or a whole range. */
export interface Activity {
  localHits: number;
  localMisses: number;
  remoteHits: number;
  remoteMisses: number;
  /** Task time that local cache hits replayed instead of running. */
  localTimeSavedMs: number;
  /** Task time that remote cache hits replayed instead of running. */
  remoteTimeSavedMs: number;
  runs: number;
  /** Runs that `turbo` reported from a CI provider. */
  ciRuns: number;
  /** Runs that `turbo` reported an AI coding agent started. */
  agentRuns: number;
  uploads: number;
  uploadedBytes: number;
  /** Run time of the tasks that missed and uploaded their artifacts, as `turbo` reports with each upload. */
  runTimeMs: number;
  downloads: number;
  downloadedBytes: number;
}

export interface ActivityPoint extends Activity {
  /** The start of the bucket, in milliseconds since the epoch. Buckets are UTC hours or days. */
  start: number;
}

export interface TeamActivity extends Activity {
  team: string;
  /** Artifacts the team had stored at the latest storage snapshot. */
  storedArtifacts: number;
  storedBytes: number;
  /** Time saved in each bucket of the range, aligned with `Stats.series`. */
  timeSavedSeries: number[];
}

export interface Share {
  name: string;
  count: number;
}

export interface StorageSnapshot {
  takenAt: number;
  artifacts: number;
  bytes: number;
}

export interface Stats {
  enabled: true;
  generatedAt: number;
  range: {
    name: StatsRange;
    from: number;
    to: number;
    bucketMs: number;
  };
  /** Activity in the range, then in the range of the same length just before it. */
  totals: { current: Activity; previous: Activity };
  series: ActivityPoint[];
  allTime: {
    timeSavedMs: number;
    /** When the first cache event was recorded, or `null` before there is one. */
    since: number | null;
  };
  /** Runs and time saved per UTC day over the last 53 weeks, oldest first. */
  calendar: { day: number; runs: number; timeSavedMs: number }[];
  storage: {
    expirationHours: number;
    latest: StorageSnapshot | null;
    history: StorageSnapshot[];
  };
  teams: TeamActivity[];
  clients: {
    /** Runs by CI provider. Local runs are named `local`. */
    ci: Share[];
    /** Runs by AI coding agent. */
    agents: Share[];
    /** Artifact requests by `turbo` version. */
    versions: Share[];
    /** Artifact requests by operating system and architecture. */
    platforms: Share[];
  };
}

/** The body of `GET /stats`. */
export type StatsResponse = Stats | { enabled: false };
