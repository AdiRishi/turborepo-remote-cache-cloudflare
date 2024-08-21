import type { Env } from '../..';
import { vValidator } from '@hono/valibot-validator';
import { bearerAuth } from 'hono/bearer-auth';
import { cache } from 'hono/cache';
import { Hono } from 'hono/tiny';
import * as v from 'valibot';

export const DEFAULT_TEAM_ID = 'team_default_team';

// Route - /v8/artifacts
export const artifactRouter = new Hono<{ Bindings: Env }>();

artifactRouter.use('*', async (c, next) => {
  const middleware = bearerAuth({ token: c.env.TURBO_TOKEN });
  await middleware(c, next);
});

const vCoerceNumber = () => v.pipe(v.unknown(), v.transform(Number), v.number());

artifactRouter.post(
  '/',
  vValidator(
    'json',
    v.object({
      hashes: v.array(v.string()),
    })
  ),
  vValidator('query', v.object({ teamId: v.optional(v.string()), slug: v.optional(v.string()) })),
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
  vValidator('param', v.object({ artifactId: v.string() })),
  vValidator('query', v.object({ teamId: v.optional(v.string()), slug: v.optional(v.string()) })),
  vValidator(
    'header',
    v.object({
      'content-type': v.literal('application/octet-stream'),
      'content-length': v.optional(vCoerceNumber()),
      'x-artifact-duration': v.optional(vCoerceNumber()),
      'x-artifact-client-ci': v.optional(v.string()),
      'x-artifact-client-interactive': v.optional(
        v.pipe(vCoerceNumber(), v.minValue(0), v.maxValue(1))
      ),
      'x-artifact-tag': v.optional(v.string()),
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
  vValidator('param', v.object({ artifactId: v.string() })),
  vValidator('query', v.object({ teamId: v.optional(v.string()), slug: v.optional(v.string()) })),
  vValidator(
    'header',
    v.object({
      'x-artifact-client-ci': v.optional(v.string()),
      'x-artifact-client-interactive': v.optional(
        v.pipe(vCoerceNumber(), v.minValue(0), v.maxValue(1))
      ),
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
  vValidator(
    'json',
    v.array(
      v.object({
        sessionId: v.string(),
        source: v.union([v.literal('LOCAL'), v.literal('REMOTE')]),
        event: v.union([v.literal('HIT'), v.literal('MISS')]),
        hash: v.string(),
        duration: v.optional(v.number()),
      })
    )
  ),
  vValidator('query', v.object({ teamId: v.optional(v.string()), slug: v.optional(v.string()) })),
  vValidator(
    'header',
    v.object({
      'x-artifact-client-ci': v.optional(v.string()),
      'x-artifact-client-interactive': v.optional(
        v.pipe(vCoerceNumber(), v.minValue(0), v.maxValue(1))
      ),
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
