import { Hono } from 'hono';
import { bearerAuth } from 'hono/bearer-auth';
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
