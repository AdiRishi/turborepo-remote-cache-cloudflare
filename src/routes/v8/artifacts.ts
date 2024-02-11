import { Env } from '../..';
import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { bearerAuth } from 'hono/bearer-auth';
import { cache } from 'hono/cache';
import { z } from 'zod';

// Route - /v8/artifacts
export const artifactRouter = new Hono<{ Bindings: Env }>();

artifactRouter.use('*', async (c, next) => {
  const middleware = bearerAuth({ token: c.env.TURBO_TOKEN });
  await middleware(c, next);
});

artifactRouter.put(
  '/:artifactId',
  zValidator('param', z.object({ artifactId: z.string() })),
  zValidator('query', z.object({ teamId: z.string().optional(), slug: z.string().optional() })),
  async (c) => {
    const { artifactId } = c.req.valid('param');
    const { teamId: teamIdQuery, slug } = c.req.valid('query');
    const teamId = teamIdQuery ?? slug;

    if (!teamId) {
      return c.json({ error: 'MISSING_TEAM_ID' }, 400);
    }

    const contentType = c.req.raw.headers.get('Content-Type');
    if (contentType !== 'application/octet-stream') {
      return c.json({ error: 'EXPECTED_CONTENT_TYPE_OCTET_STREAM' }, 400);
    }

    // if present the turborepo client has signed the artifact body
    const artifactTag = c.req.raw.headers.get('x-artifact-tag');
    const storage = c.env.STORAGE_MANAGER.getActiveStorage();
    const objectKey = `${teamId}/${artifactId}`;

    const storageMetadata: Record<string, string> = {};
    if (artifactTag) {
      storageMetadata.artifactTag = artifactTag;
    }
    await storage.write(objectKey, c.req.raw.body!, storageMetadata);

    return c.json({ teamId, artifactId, storagePath: objectKey }, 201);
  }
);

// Hono router .get() method captures both GET and HEAD requests
artifactRouter.get(
  '/:artifactId/:teamId?',
  cache({
    cacheName: 'r2-artifacts',
    wait: false,
    cacheControl: 'max-age=300, stale-while-revalidate=300',
  }),
  zValidator('param', z.object({ artifactId: z.string() })),
  zValidator('query', z.object({ teamId: z.string().optional(), slug: z.string().optional() })),
  async (c) => {
    const { artifactId } = c.req.valid('param');
    const { teamId: teamIdQuery, slug } = c.req.valid('query');
    const teamId = teamIdQuery ?? slug;

    if (!teamId) {
      return c.json({ error: 'MISSING_TEAM_ID' }, 400);
    }
    const storage = c.env.STORAGE_MANAGER.getActiveStorage();
    const objectKey = `${teamId}/${artifactId}`;

    const storedObject = await storage.readWithMetadata(objectKey);
    if (!storedObject.data) {
      return c.json({ error: 'NOT_FOUND' }, 404);
    }

    c.header('Content-Type', 'application/octet-stream');
    if (storedObject.metadata?.customMetadata.artifactTag) {
      c.header('x-artifact-tag', storedObject.metadata.customMetadata.artifactTag);
    }
    c.status(200);
    return c.body(storedObject.data);
  }
);

artifactRouter.post('/events', (c) => {
  return c.json({});
});
