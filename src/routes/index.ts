import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { cors } from 'hono/cors';
import { Env } from '..';
import { v8App } from './v8';
import { commandCentralRouter } from './commandCentral';

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

// simulate latency for global performance testing
app.post('/latency-test', async (c) => {
  const artifactId = 'UNIQUE-artifactId-' + Math.random();
  const artifactTag = 'UNIQUE-artifactTag-' + Math.random();
  const teamId = 'arishi-performance-testing';
  const artifactContent = '🎉😄😇🎉😄😇🎉😄😇🎉😄😇';
  // store and get back content to simulate latency
  await c.env.R2_STORE.put(`${teamId}/existing-${artifactId}`, artifactContent, {
    customMetadata: { artifactTag },
  });
  const r2Object = await c.env.R2_STORE.get(`${teamId}/existing-${artifactId}`);
  if (!r2Object) {
    throw new Error('r2Object not found');
  }
  const r2Text = await r2Object.text();
  return c.json({ content: r2Text });
});

app.route('/v8', v8App);
app.route('/commandCentral', commandCentralRouter);
