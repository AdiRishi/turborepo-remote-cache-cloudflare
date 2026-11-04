import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import { authorized, randomHash } from './support/client';
import { storage } from './support/memory-storage';

// A store that accepts writes and lists, but fails reads with a provider error. It refuses each delete
// the way S3's DeleteObjects does for credentials without s3:DeleteObject: the request succeeds and
// reports an error for every key.
vi.mock('../src/custom-adapter', async () => {
  const { FilesError } = await import('files-sdk');
  const { adapter } = await import('./support/memory-storage');
  const unavailable = () => Promise.reject(new FilesError('Provider', 'The store is unavailable'));
  return {
    customAdapter: () => ({
      ...adapter,
      download: unavailable,
      head: unavailable,
      deleteMany: (keys: string[]) =>
        Promise.resolve({
          results: [],
          errors: keys.map((key) => ({
            key,
            error: new FilesError('Unauthorized', 'Access denied'),
          })),
        }),
    }),
  };
});

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

test('answers a download with a 500 when the store fails, not with a miss', async () => {
  const response = await authorized(`/v8/artifacts/${randomHash()}`);
  expect(response.status).toBe(500);
});

test('answers a query with a 500 when the store fails, instead of reporting misses', async () => {
  const response = await authorized('/v8/artifacts', {
    method: 'POST',
    body: JSON.stringify({ hashes: [randomHash()] }),
  });
  expect(response.status).toBe(500);
});

test('fails expiry when the store refuses to delete, instead of reporting success', async () => {
  await storage.upload(`team_default_team/${randomHash()}`, new Uint8Array(1));

  const response = await authorized('/internal/delete-expired-objects', {
    method: 'POST',
    body: JSON.stringify({ expireInHours: 0 }),
  });
  expect(response.status).toBe(500);
  expect(console.error).toHaveBeenCalledWith(
    expect.objectContaining({ message: 'Failed to delete 1 expired artifacts' }),
  );
});
