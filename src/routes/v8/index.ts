import { Hono } from 'hono';
import { bearerAuth } from 'hono/bearer-auth';
import { Env } from '../..';
import { artifactRouter } from './artifacts';

export const v8App = new Hono<{ Bindings: Env }>();

v8App.use('/artifacts/*', async (c, next) => {
  if (c.env.REQUIRE_AUTH) {
    const middleware = bearerAuth({ token: c.env.AUTH_SECRET });
    await middleware(c, next);
  } else {
    await next();
  }
});
v8App.route('/artifacts', artifactRouter);
