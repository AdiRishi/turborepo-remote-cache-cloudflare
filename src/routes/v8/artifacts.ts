import { Env } from '../..';
import { vValidator } from '@hono/valibot-validator';
import { bearerAuth } from 'hono/bearer-auth';
import { cache } from 'hono/cache';
import { Hono } from 'hono/tiny';
import {
  object,
  number,
  optional,
  pipe,
  minValue,
  maxValue,
  string,
  literal,
  transform,
  array,
  union,
} from 'valibot';

export const DEFAULT_TEAM_ID = 'team_default_team';

// Route - /v8/artifacts
export const artifactRouter = new Hono<{ Bindings: Env }>();

artifactRouter.use('*', async (c, next) => {
  const middleware = bearerAuth({ token: c.env.TURBO_TOKEN });
  await middleware(c, next);
});

const vCoerceNumber = () => pipe(string(), transform(Number), number());

artifactRouter.post(
  '/',
  vValidator(
    'json',
    object({
      hashes: array(string()),
    })
  ),
  vValidator('query', object({ teamId: optional(string()), slug: optional(string()) })),
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
  vValidator('param', object({ artifactId: string() })),
  vValidator('query', object({ teamId: optional(string()), slug: optional(string()) })),
  vValidator(
    'header',
    object({
      'content-type': literal('application/octet-stream'),
      'content-length': optional(vCoerceNumber()),
      'x-artifact-duration': optional(vCoerceNumber()),
      'x-artifact-client-ci': optional(string()),
      'x-artifact-client-interactive': optional(pipe(vCoerceNumber(), minValue(0), maxValue(1))),
      'x-artifact-tag': optional(string()),
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
  vValidator('param', object({ artifactId: string() })),
  vValidator('query', object({ teamId: optional(string()), slug: optional(string()) })),
  vValidator(
    'header',
    object({
      'x-artifact-client-ci': optional(string()),
      'x-artifact-client-interactive': optional(pipe(vCoerceNumber(), minValue(0), maxValue(1))),
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
    array(
      object({
        sessionId: string(),
        source: union([literal('LOCAL'), literal('REMOTE')]),
        event: union([literal('HIT'), literal('MISS')]),
        hash: string(),
        duration: optional(number()),
      })
    )
  ),
  vValidator('query', object({ teamId: optional(string()), slug: optional(string()) })),
  vValidator(
    'header',
    object({
      'x-artifact-client-ci': optional(string()),
      'x-artifact-client-interactive': optional(pipe(vCoerceNumber(), minValue(0), maxValue(1))),
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
