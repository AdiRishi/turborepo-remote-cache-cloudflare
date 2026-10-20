import { vValidator } from '@hono/valibot-validator';
import { Hono } from 'hono/tiny';
import * as v from 'valibot';

import type { Env } from '../..';

import { bearerAuthFromEnv } from '../auth';

export const DEFAULT_TEAM_ID = 'team_default_team';
const ARTIFACT_CACHE_NAME = 'r2-artifacts';
const ARTIFACT_CACHE_CONTROL = 'max-age=300, stale-while-revalidate=300';
type WaitUntilContext = {
  waitUntil: (promise: Promise<unknown>) => void;
};

// Route - /v8/artifacts
export const artifactRouter = new Hono<{ Bindings: Env }>();

artifactRouter.use('*', bearerAuthFromEnv);

const getActiveStorage = (env: Env) => {
  if (!env.STORAGE_MANAGER) {
    throw new Error('Storage manager is not configured');
  }
  return env.STORAGE_MANAGER.getActiveStorage();
};

const vCoerceNumber = () => v.pipe(v.unknown(), v.transform(Number), v.number());

const canUseArtifactCache = (request: Request) =>
  request.method === 'GET' && typeof caches !== 'undefined';

const getCachedArtifactResponse = async (request: Request) => {
  if (!canUseArtifactCache(request)) return undefined;

  const artifactCache = await caches.open(ARTIFACT_CACHE_NAME);
  const cachedResponse = await artifactCache.match(request.url);

  if (!cachedResponse) return undefined;
  return cachedResponse;
};

const cacheArtifactResponse = (
  executionCtx: WaitUntilContext,
  request: Request,
  response: Response,
) => {
  if (!canUseArtifactCache(request)) return;

  executionCtx.waitUntil(
    caches
      .open(ARTIFACT_CACHE_NAME)
      .then((artifactCache) => artifactCache.put(request.url, response)),
  );
};

artifactRouter.post(
  '/',
  vValidator(
    'json',
    v.object({
      hashes: v.array(v.string()),
    }),
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
  },
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
        v.pipe(vCoerceNumber(), v.minValue(0), v.maxValue(1)),
      ),
      'x-artifact-tag': v.optional(v.string()),
    }),
  ),
  async (c) => {
    const { artifactId } = c.req.valid('param');
    const { teamId: teamIdQuery, slug } = c.req.valid('query');
    const teamId = teamIdQuery ?? slug ?? DEFAULT_TEAM_ID;
    const validatedHeaders = c.req.valid('header');

    const storage = getActiveStorage(c.env);
    const objectKey = `${teamId}/${artifactId}`;

    const storageMetadata: Record<string, string> = {};
    if (validatedHeaders['x-artifact-tag']) {
      storageMetadata.artifactTag = validatedHeaders['x-artifact-tag'];
    }
    await storage.write(objectKey, c.req.raw.body!, storageMetadata);

    const uploadUrl = new URL(`${artifactId}?teamId=${teamId}`, c.req.raw.url).toString();
    return c.json({ urls: [uploadUrl] }, 202);
  },
);

// Hono router .get() method captures both GET and HEAD requests
artifactRouter.get(
  '/:artifactId',
  vValidator('param', v.object({ artifactId: v.string() })),
  vValidator('query', v.object({ teamId: v.optional(v.string()), slug: v.optional(v.string()) })),
  vValidator(
    'header',
    v.object({
      'x-artifact-client-ci': v.optional(v.string()),
      'x-artifact-client-interactive': v.optional(
        v.pipe(vCoerceNumber(), v.minValue(0), v.maxValue(1)),
      ),
    }),
  ),
  async (c) => {
    const { artifactId } = c.req.valid('param');
    const { teamId: teamIdQuery, slug } = c.req.valid('query');
    const teamId = teamIdQuery ?? slug ?? DEFAULT_TEAM_ID;
    const cachedResponse = await getCachedArtifactResponse(c.req.raw);

    if (cachedResponse) {
      return cachedResponse;
    }

    const storage = getActiveStorage(c.env);
    const objectKey = `${teamId}/${artifactId}`;

    const storedObject = await storage.readWithMetadata(objectKey);
    if (!storedObject.data) {
      return c.json({}, 404);
    }

    const responseHeaders: Record<string, string> = {
      'Cache-Control': ARTIFACT_CACHE_CONTROL,
      'Content-Type': 'application/octet-stream',
    };
    if (storedObject.metadata?.customMetadata.artifactTag) {
      responseHeaders['x-artifact-tag'] = storedObject.metadata.customMetadata.artifactTag;
    }
    let responseData = storedObject.data;

    if (canUseArtifactCache(c.req.raw)) {
      const [clientData, cacheData] = storedObject.data.tee();
      responseData = clientData;
      cacheArtifactResponse(
        c.executionCtx,
        c.req.raw,
        new Response(cacheData, { headers: responseHeaders, status: 200 }),
      );
    }

    const response = c.body(responseData, 200, responseHeaders);

    return response;
  },
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
      }),
    ),
  ),
  vValidator('query', v.object({ teamId: v.optional(v.string()), slug: v.optional(v.string()) })),
  vValidator(
    'header',
    v.object({
      'x-artifact-client-ci': v.optional(v.string()),
      'x-artifact-client-interactive': v.optional(
        v.pipe(vCoerceNumber(), v.minValue(0), v.maxValue(1)),
      ),
    }),
  ),
  (c) => {
    const data = c.req.valid('json');
    const { teamId: teamIdQuery, slug } = c.req.valid('query');
    const teamId = teamIdQuery ?? slug ?? DEFAULT_TEAM_ID;
    // TODO: track these events and store them to query later
    void data;
    void teamId;
    return c.json({});
  },
);
