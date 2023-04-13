import { expect, test, describe } from 'vitest';
import { isDateOlderThan } from './date';

describe('isDateOlderThan', () => {
  const millisecondsInHour = 1000 * 60 * 60;

  test('should return true when date is older than hours', () => {
    const now = new Date();
    const date = new Date(now.getTime() - millisecondsInHour * 2);
    expect(isDateOlderThan(date, 1)).toBe(true);
  });

  test('should return false when date is newer than hours', () => {
    const now = new Date();
    const date = new Date(now.getTime() - millisecondsInHour * 1);
    expect(isDateOlderThan(date, 2)).toBe(false);
  });

  test('should work when hours passed in are in milliseconds', () => {
    const now = new Date();
    const oneSecondInMilliseconds = 1000;
    const twoSecondsInHours = 2 / 60 / 60;
    const halfSecondInHours = 0.5 / 60 / 60;
    const date = new Date(now.getTime() - oneSecondInMilliseconds);
    expect(isDateOlderThan(date, twoSecondsInHours)).toBe(false);
    expect(isDateOlderThan(date, halfSecondInHours)).toBe(true);
  });
});
