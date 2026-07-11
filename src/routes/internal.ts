import { vValidator } from '@hono/valibot-validator';
import { Hono } from 'hono/tiny';
import * as v from 'valibot';

import type { AppBindings } from '../runtime/app-env';

import { deleteOldCache } from '../crons/deleteOldCache';
import { bearerAuthFromEnv } from './auth';

export const internalRouter = new Hono<{ Bindings: AppBindings }>();

internalRouter.use('*', bearerAuthFromEnv);

internalRouter.post(
  '/delete-expired-objects',
  vValidator('json', v.object({ expireInHours: v.optional(v.pipe(v.number(), v.minValue(0))) })),
  async (c) => {
    const { expireInHours } = c.req.valid('json');
    await deleteOldCache(c.env.FILES, expireInHours ?? c.env.CACHE_RETENTION_HOURS);
    return c.json({ success: true });
  },
);

internalRouter.post(
  '/populate-random-objects',
  vValidator('json', v.object({ count: v.pipe(v.number(), v.maxValue(1000), v.minValue(1)) })),
  async (c) => {
    const { count } = c.req.valid('json');
    const files = c.env.FILES;

    const emojis: string[] = ['🤪', '🤬', '😄', '🥶', '😆', '😅', '😂', '🤣', '😊', '😇'];
    const promises = [];
    for (let i = 0; i < count; i++) {
      const key = `random-data/${crypto.randomUUID()}`;
      promises.push(files.upload(key, emojis[Math.floor(Math.random() * emojis.length)]));
    }
    await Promise.all(promises);

    return c.json({ success: true });
  },
);

internalRouter.get('/count-objects', async (c) => {
  let cursor: string | undefined;
  let count = 0;
  const files = c.env.FILES;
  do {
    const page = await files.list({ cursor, limit: 999 });
    cursor = page.cursor;
    count += page.items.length;
  } while (cursor);

  return c.json({ count });
});
