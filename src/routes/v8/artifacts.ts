import { Env } from '../..';
import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { bearerAuth } from 'hono/bearer-auth';
import { cache } from 'hono/cache';
import { z } from 'zod';

export const DEFAULT_TEAM_ID = 'team_default_team';

// Route - /v8/artifacts
export const artifactRouter = new Hono<{ Bindings: Env }>();

artifactRouter.use('*', async (c, next) => {
  const middleware = bearerAuth({ token: c.env.TURBO_TOKEN });
  await middleware(c, next);
});

artifactRouter.post(
  '/',
  zValidator(
    'json',
    z.object({
      hashes: z.array(z.string()), // artifactIds
    })
  ),
  zValidator('query', z.object({ teamId: z.string().optional(), slug: z.string().optional() })),
  (c) => {
    const data = c.req.valid('json');
    const { teamId: teamIdQuery, slug } = c.req.valid('query');
    const teamId = teamIdQuery ?? slug ?? DEFAULT_TEAM_ID;
    void data;
    void teamId;
    // TODO: figure out what this route actually does, the OpenAPI spec is unclear
    return c.json({});
  }
);

artifactRouter.get('/status', (c) => {
  const status: 'disabled' | 'enabled' | 'over_limit' | 'paused' = 'enabled';
  return c.json({ status }, 200);
});

artifactRouter.put(
  '/:artifactId',
  zValidator('param', z.object({ artifactId: z.string() })),
  zValidator('query', z.object({ teamId: z.string().optional(), slug: z.string().optional() })),
  zValidator(
    'header',
    z.object({
      'content-type': z.literal('application/octet-stream'),
      'content-length': z.coerce.number().optional(),
      'x-artifact-duration': z.coerce.number().optional(),
      'x-artifact-client-ci': z.string().optional(),
      'x-artifact-client-interactive': z.coerce.number().min(0).max(1).optional(),
      'x-artifact-tag': z.string().optional(),
    })
  ),
  async (c) => {
    const { artifactId } = c.req.valid('param');
    const { teamId: teamIdQuery, slug } = c.req.valid('query');
    const teamId = teamIdQuery ?? slug ?? DEFAULT_TEAM_ID;
    const validatedHeaders = c.req.valid('header');

    const storage = c.env.STORAGE_MANAGER.getActiveStorage();
    const objectKey = `${teamId}/${artifactId}`;

    const storageMetadata: Record<string, string> = {};
    if (validatedHeaders['x-artifact-tag']) {
      storageMetadata.artifactTag = validatedHeaders['x-artifact-tag'];
    }
    await storage.write(objectKey, c.req.raw.body!, storageMetadata);

    const uploadUrl = new URL(`${artifactId}?teamId=${teamId}`, c.req.raw.url).toString();
    return c.json({ urls: [uploadUrl] }, 202);
  }
);

// Hono router .get() method captures both GET and HEAD requests
artifactRouter.get(
  '/:artifactId',
  cache({
    cacheName: 'r2-artifacts',
    wait: false,
    cacheControl: 'max-age=300, stale-while-revalidate=300',
  }),
  zValidator('param', z.object({ artifactId: z.string() })),
  zValidator('query', z.object({ teamId: z.string().optional(), slug: z.string().optional() })),
  zValidator(
    'header',
    z.object({
      'x-artifact-client-ci': z.string().optional(),
      'x-artifact-client-interactive': z.coerce.number().min(0).max(1).optional(),
    })
  ),
  async (c) => {
    const { artifactId } = c.req.valid('param');
    const { teamId: teamIdQuery, slug } = c.req.valid('query');
    const teamId = teamIdQuery ?? slug ?? DEFAULT_TEAM_ID;

    const storage = c.env.STORAGE_MANAGER.getActiveStorage();
    const objectKey = `${teamId}/${artifactId}`;

    const storedObject = await storage.readWithMetadata(objectKey);
    if (!storedObject.data) {
      return c.json({}, 404);
    }

    c.header('Content-Type', 'application/octet-stream');
    if (storedObject.metadata?.customMetadata.artifactTag) {
      c.header('x-artifact-tag', storedObject.metadata.customMetadata.artifactTag);
    }
    c.status(200);
    return c.body(storedObject.data);
  }
);

artifactRouter.post(
  '/events',
  zValidator(
    'json',
    z.array(
      z.object({
        sessionId: z.string().uuid(),
        source: z.union([z.literal('LOCAL'), z.literal('REMOTE')]),
        event: z.union([z.literal('HIT'), z.literal('MISS')]),
        hash: z.string(), // artifactId
        duration: z.coerce.number().optional(),
      })
    )
  ),
  zValidator('query', z.object({ teamId: z.string().optional(), slug: z.string().optional() })),
  zValidator(
    'header',
    z.object({
      'x-artifact-client-ci': z.string().optional(),
      'x-artifact-client-interactive': z.coerce.number().min(0).max(1).optional(),
    })
  ),
  (c) => {
    const data = c.req.valid('json');
    const { teamId: teamIdQuery, slug } = c.req.valid('query');
    const teamId = teamIdQuery ?? slug ?? DEFAULT_TEAM_ID;
    // TODO: track these events and store them to query later
    void data;
    void teamId;
    return c.json({});
  }
);
