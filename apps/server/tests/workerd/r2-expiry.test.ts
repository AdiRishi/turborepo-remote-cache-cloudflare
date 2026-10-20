import { env } from 'cloudflare:workers';
import { afterEach, expect, test, vi } from 'vitest';

import { deleteExpiredArtifacts } from '../../server/utils/expiry';
import { openStorage } from '../../server/utils/storage';

const ARTIFACTS = 2500;
const HOUR = 3_600_000;

afterEach(() => {
  vi.useRealTimers();
});

test('expires more than a page of artifacts through the R2 binding bulk delete', async () => {
  const storage = openStorage({ R2_STORE: env.R2_STORE });
  await Promise.all(
    Array.from({ length: ARTIFACTS }, (_, index) =>
      env.R2_STORE.put(`team_expiry/${String(index).padStart(5, '0')}`, 'artifact'),
    ),
  );
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(Date.now() + 721 * HOUR);

  expect(await deleteExpiredArtifacts(storage, 720)).toBe(ARTIFACTS);
  expect((await env.R2_STORE.list({ prefix: 'team_expiry/' })).objects).toEqual([]);
});
