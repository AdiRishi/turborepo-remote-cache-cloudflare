import { expect, test, vi } from 'vitest';

import { authorized, randomHash, send, uploadArtifact } from './support/client';

vi.mock('../src/custom-adapter', () => import('./support/memory-storage'));

// The D1 connector throws like this when the STATS_DB binding is missing.
vi.mock('nitro/database', () => ({
  useDatabase: () => ({
    getInstance: () => Promise.reject(new Error('[db0] [d1] binding `STATS_DB` not found')),
  }),
}));

test('serves the cache without a stats database, and reports stats as disabled', async () => {
  const hash = randomHash();
  expect((await uploadArtifact({ hash, body: new Uint8Array(3) })).status).toBe(202);
  expect((await authorized(`/v8/artifacts/${hash}`)).status).toBe(200);
  const events = await authorized('/v8/artifacts/events', {
    method: 'POST',
    body: JSON.stringify([
      { sessionId: crypto.randomUUID(), source: 'REMOTE', event: 'HIT', hash },
    ]),
  });
  expect(events.status).toBe(200);

  const stats = await send('/stats');
  expect(stats.status).toBe(200);
  expect(await stats.json()).toEqual({ enabled: false });
});
