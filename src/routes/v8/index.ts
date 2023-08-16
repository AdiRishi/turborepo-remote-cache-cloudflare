import { Hono } from 'hono';
import { bearerAuth } from 'hono/bearer-auth';
import { Env } from '../..';
import { artifactRouter } from './artifacts';

export const v8App = new Hono<{ Bindings: Env }>();

v8App.use('/artifacts/*', async (c, next) => {
  const middleware = bearerAuth({ token: c.env.TURBO_TOKEN });
  await middleware(c, next);
});
v8App.route('/artifacts', artifactRouter);
