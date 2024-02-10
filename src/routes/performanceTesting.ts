import { Hono } from 'hono';
import { Env } from '..';

export const performanceTestingRouter = new Hono<{ Bindings: Env }>();

performanceTestingRouter.post('/r2-round-trip', async (c) => {
  const requestLocation = c.req.raw?.cf?.colo as string | undefined;
  const artifactId = `pref-${requestLocation ?? 'unknown-colo'}-${crypto.randomUUID()}`;
  const artifactTag = 'UNIQUE-artifactTag-' + Math.random();
  const teamId = 'performance-testing';
  const artifactContent = '🎉😄😇🎉😄😇🎉😄😇🎉😄😇';
  const storage = c.env.STORAGE_MANAGER.getActiveStorage();
  // store and get back content to simulate latency
  await storage.write(`${teamId}/existing-${artifactId}`, artifactContent, { artifactTag });
  const dataStream = await storage.read(`${teamId}/existing-${artifactId}`);
  if (!dataStream) {
    throw new Error('r2Object not found');
  }
  const r2Text = await new Response(dataStream).text();
  return c.json({ content: r2Text });
});

performanceTestingRouter.post('/ping', (c) => {
  return c.text('pong');
});
