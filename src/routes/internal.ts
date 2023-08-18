import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { bearerAuth } from 'hono/bearer-auth';
import { z } from 'zod';
import { Env } from '..';
import { deleteOldCache } from '../crons/deleteOldCache';

export const internalRouter = new Hono<{ Bindings: Env }>();

internalRouter.use('*', async (c, next) => {
  const middleware = bearerAuth({ token: c.env.TURBO_TOKEN });
  await middleware(c, next);
});

internalRouter.post('/delete-expired-objects', async (c) => {
  await deleteOldCache(c.env);
  return c.json({ success: true });
});

internalRouter.post(
  '/populate-random-objects',
  zValidator(
    'json',
    z.object({
      count: z.number().int().min(1).max(1000),
    })
  ),
  async (c) => {
    const { count } = c.req.valid('json');
    const { R2_STORE } = c.env;

    const emojis: string[] = ['🤪', '🤬', '😄', '🥶', '😆', '😅', '😂', '🤣', '😊', '😇'];
    const promises = [];
    for (let i = 0; i < count; i++) {
      const key = `random-data/${crypto.randomUUID()}`;
      promises.push(R2_STORE.put(key, emojis[Math.floor(Math.random() * emojis.length)]));
    }
    await Promise.all(promises);

    return c.json({ success: true });
  }
);
