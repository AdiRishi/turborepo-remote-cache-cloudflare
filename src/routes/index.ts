import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { cors } from 'hono/cors';
import { Env } from '..';
import { v8App } from './v8';
import { internalRouter } from './internal';
import { performanceTestingRouter } from './performanceTesting';

export const app = new Hono<{ Bindings: Env }>();

app.onError((err, c) => {
  if (err instanceof HTTPException) {
    return err.getResponse();
  }
  return c.json({ error: err.message }, 500);
});

app.use('*', cors());

// minimal health check routes
app.get('/ping', (c) => c.text('pong'));
app.get('/throw-exception', () => {
  throw new Error('Expected error');
});

app.route('/v8', v8App);
app.route('/internal', internalRouter);
app.route('/performance-testing', performanceTestingRouter);
