import { Hono } from 'hono';
import { bearerAuth } from 'hono/bearer-auth';
import { Env } from '..';
import { deleteOldCache } from '../crons/deleteOldCache';

export const commandCentralRouter = new Hono<{ Bindings: Env }>();

commandCentralRouter.use('*', async (c, next) => {
  if (c.env.REQUIRE_AUTH) {
    const middleware = bearerAuth({ token: c.env.TURBO_TOKEN });
    await middleware(c, next);
  } else {
    await next();
  }
});

commandCentralRouter.post('/delete-expired-objects', async (c) => {
  await deleteOldCache(c.env);
  return c.json({ success: true });
});
