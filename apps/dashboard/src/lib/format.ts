const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export interface DurationPart {
  value: number;
  unit: 'd' | 'h' | 'm' | 's';
}

/** Splits a duration into its two most significant units, such as `312h 14m` or `9d 4h`. */
export const durationParts = (ms: number): DurationPart[] => {
  if (ms >= 2 * DAY) {
    return [
      { value: Math.floor(ms / DAY), unit: 'd' },
      { value: Math.floor((ms % DAY) / HOUR), unit: 'h' },
    ];
  }
  if (ms >= HOUR) {
    return [
      { value: Math.floor(ms / HOUR), unit: 'h' },
      { value: Math.floor((ms % HOUR) / MINUTE), unit: 'm' },
    ];
  }
  if (ms >= MINUTE) {
    return [
      { value: Math.floor(ms / MINUTE), unit: 'm' },
      { value: Math.floor((ms % MINUTE) / SECOND), unit: 's' },
    ];
  }
  return [{ value: Math.round(ms / SECOND), unit: 's' }];
};

const integer = new Intl.NumberFormat('en-US');

export const formatDuration = (ms: number) =>
  durationParts(ms)
    .map(({ value, unit }) => `${integer.format(value)}${unit}`)
    .join(' ');

/** Hours with one decimal, for chart axes where a single unit keeps ticks comparable. */
export const formatHours = (ms: number) =>
  `${new Intl.NumberFormat('en-US', { maximumFractionDigits: ms < 10 * HOUR ? 1 : 0 }).format(ms / HOUR)}h`;

const compact = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 });

export const formatCount = (value: number) =>
  value >= 10_000 ? compact.format(value) : integer.format(value);

const BYTE_UNITS = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'] as const;

/** Decimal units, as storage providers bill them. */
export const formatBytes = (bytes: number) => {
  const exponent = Math.min(
    BYTE_UNITS.length - 1,
    Math.max(0, Math.floor(Math.log10(Math.max(bytes, 1)) / 3)),
  );
  const value = bytes / 1000 ** exponent;
  const digits = value >= 100 || exponent === 0 ? 0 : 1;
  return `${new Intl.NumberFormat('en-US', { maximumFractionDigits: digits }).format(value)} ${BYTE_UNITS[exponent]}`;
};

export const formatPercent = (ratio: number) =>
  new Intl.NumberFormat('en-US', { style: 'percent', maximumFractionDigits: 0 }).format(ratio);

/** The relative change from `previous` to `current`, or `null` when there is nothing to compare with. */
export const relativeChange = (current: number, previous: number) =>
  previous > 0 ? (current - previous) / previous : null;

const utcDay = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
});
const utcDayLong = new Intl.DateTimeFormat('en-US', {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
});
const localHour = new Intl.DateTimeFormat('en-US', { hour: 'numeric' });
const localHourLong = new Intl.DateTimeFormat('en-US', {
  weekday: 'short',
  hour: 'numeric',
  minute: '2-digit',
});

/** Labels a bucket start. Day buckets are UTC days, so they are labelled in UTC to keep their date. */
export const formatBucket = (start: number, bucketMs: number, { long = false } = {}) => {
  if (bucketMs < DAY) {
    return (long ? localHourLong : localHour).format(start);
  }
  return (long ? utcDayLong : utcDay).format(start);
};

export const formatDay = (day: number) => utcDayLong.format(day);

const relativeTime = new Intl.RelativeTimeFormat('en-US', { numeric: 'auto' });

export const formatAge = (timestamp: number, now = Date.now()) => {
  const elapsed = now - timestamp;
  if (elapsed < MINUTE) {
    return 'just now';
  }
  if (elapsed < HOUR) {
    return relativeTime.format(-Math.round(elapsed / MINUTE), 'minute');
  }
  if (elapsed < DAY) {
    return relativeTime.format(-Math.round(elapsed / HOUR), 'hour');
  }
  return relativeTime.format(-Math.round(elapsed / DAY), 'day');
};
