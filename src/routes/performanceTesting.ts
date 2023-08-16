import { Hono } from 'hono';
import { Env } from '..';

export const performanceTestingRouter = new Hono<{ Bindings: Env }>();

performanceTestingRouter.post('/r2-round-trip', async (c) => {
  const artifactId = 'UNIQUE-artifactId-' + Math.random();
  const artifactTag = 'UNIQUE-artifactTag-' + Math.random();
  const teamId = 'performance-testing';
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
