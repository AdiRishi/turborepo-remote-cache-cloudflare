import { describe, expect, test } from 'vitest';

import {
  formatAge,
  formatBytes,
  formatCount,
  formatDuration,
  formatHourCount,
  formatPercent,
  relativeChange,
} from '../src/lib/format';

describe('formatDuration', () => {
  test.each([
    [0, '0s'],
    [1_400, '1s'],
    [59_400, '59s'],
    [59_600, '1m 0s'],
    [90_000, '1m 30s'],
    [3_599_600, '1h 0m'],
    [4_440_000, '1h 14m'],
    [169_200_000, '47h 0m'],
    [187_200_000, '2d 4h'],
    [129_600_000_000, '1,500d 0h'],
  ])('prints %i ms as %s', (ms, expected) => {
    expect(formatDuration(ms)).toBe(expected);
  });
});

describe('formatBytes', () => {
  test.each([
    [0, '0 B'],
    [999, '999 B'],
    [1_000, '1 KB'],
    [1_500, '1.5 KB'],
    [999_499, '999 KB'],
    [999_950, '1 MB'],
    [1_234_567, '1.2 MB'],
    [123_456_789, '123 MB'],
    [5_000_000_000, '5 GB'],
  ])('prints %i bytes as %s', (bytes, expected) => {
    expect(formatBytes(bytes)).toBe(expected);
  });
});

describe('formatCount', () => {
  test.each([
    [9_999, '9,999'],
    [12_345, '12.3K'],
  ])('prints %i as %s', (value, expected) => {
    expect(formatCount(value)).toBe(expected);
  });
});

describe('formatPercent', () => {
  test.each([
    [0.256, '26%'],
    [1, '100%'],
  ])('prints %d as %s', (ratio, expected) => {
    expect(formatPercent(ratio)).toBe(expected);
  });
});

describe('formatHourCount', () => {
  test.each([
    [720, '30 days'],
    [36, '36 hours'],
  ])('prints %i hours as %s', (count, expected) => {
    expect(formatHourCount(count)).toBe(expected);
  });
});

describe('relativeChange', () => {
  test('is the change as a fraction of the previous value', () => {
    expect(relativeChange(150, 100)).toBe(0.5);
  });

  test('is null when there is no previous value to compare with', () => {
    expect(relativeChange(10, 0)).toBeNull();
  });
});

describe('formatAge', () => {
  test.each([
    [30_000, 'just now'],
    [60_000, '1 minute ago'],
    [3_570_000, '59 minutes ago'],
    [5_400_000, '1 hour ago'],
    [84_960_000, '23 hours ago'],
    [129_600_000, 'yesterday'],
    [259_200_000, '3 days ago'],
  ])('calls a timestamp %i ms old %s', (elapsed, expected) => {
    expect(formatAge(0, elapsed)).toBe(expected);
  });
});
