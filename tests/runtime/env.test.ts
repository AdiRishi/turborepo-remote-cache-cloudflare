import { describe, expect, test } from 'vitest';

import {
  DEFAULT_CACHE_RETENTION_HOURS,
  getBoolean,
  getCacheRetentionHours,
  getExpirationTtl,
  getString,
  requireString,
  RuntimeConfigurationError,
} from '~/runtime/env';

describe('runtime environment parsing', () => {
  test('trims optional and required strings', () => {
    expect(getString({ STORAGE_PROVIDER: ' r2 ' }, 'STORAGE_PROVIDER')).toBe('r2');
    expect(getString({ STORAGE_PROVIDER: '   ' }, 'STORAGE_PROVIDER')).toBeUndefined();
    expect(requireString({ TURBO_TOKEN: ' token ' }, 'TURBO_TOKEN')).toBe('token');
    expect(() => requireString({}, 'TURBO_TOKEN')).toThrow(RuntimeConfigurationError);
  });

  test('parses booleans and rejects ambiguous values', () => {
    expect(getBoolean({ S3_FORCE_PATH_STYLE: true }, 'S3_FORCE_PATH_STYLE')).toBe(true);
    expect(getBoolean({ S3_FORCE_PATH_STYLE: 'FALSE' }, 'S3_FORCE_PATH_STYLE')).toBe(false);
    expect(() => getBoolean({ S3_FORCE_PATH_STYLE: 'yes' }, 'S3_FORCE_PATH_STYLE')).toThrow(
      'must be either true or false',
    );
  });

  test('defaults retention and preserves the legacy variable fallback', () => {
    expect(getCacheRetentionHours({})).toBe(DEFAULT_CACHE_RETENTION_HOURS);
    expect(getCacheRetentionHours({ BUCKET_OBJECT_EXPIRATION_HOURS: '48' })).toBe(48);
    expect(
      getCacheRetentionHours({
        BUCKET_OBJECT_EXPIRATION_HOURS: 48,
        CACHE_RETENTION_HOURS: 12,
      }),
    ).toBe(12);
  });

  test('allows zero retention and rejects invalid values', () => {
    expect(getCacheRetentionHours({ CACHE_RETENTION_HOURS: 0 })).toBe(0);
    expect(getExpirationTtl(0)).toBeUndefined();
    expect(getExpirationTtl(24)).toBe(86_400);
    expect(() => getCacheRetentionHours({ CACHE_RETENTION_HOURS: -1 })).toThrow(
      'must be a non-negative number',
    );
    expect(() => getCacheRetentionHours({ CACHE_RETENTION_HOURS: 'forever' })).toThrow(
      'must be a non-negative number',
    );
  });
});
