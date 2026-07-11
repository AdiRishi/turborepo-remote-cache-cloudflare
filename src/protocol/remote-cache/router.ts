import type { Context, Input } from 'hono';

import { vValidator } from '@hono/valibot-validator';
import { HTTPException } from 'hono/http-exception';
import { Hono } from 'hono/tiny';
import { timingSafeEqual } from 'hono/utils/buffer';
import * as v from 'valibot';

import type { AppBindings } from '../../runtime/app-env';

import {
  RemoteCacheProtocolError,
  type ArtifactMetadata,
  type RemoteCacheErrorBody,
  type RemoteCacheHandlerContext,
  type RemoteCacheHandlers,
} from './contract';
import { remoteCacheOperations } from './generated';
import { remoteCacheHandlers } from './handlers';

const ARTIFACT_CACHE_NAME = 'remote-cache-artifacts';
const ARTIFACT_CACHE_CONTROL = 'max-age=300';
const ARTIFACT_PATH_PREFIX = '/artifacts';

type RemoteCacheEnv = { Bindings: AppBindings };

const teamQuerySchema = v.object({
  slug: v.optional(v.string()),
  teamId: v.optional(v.string()),
});
const artifactPathSchema = v.object({
  hash: v.pipe(v.string(), v.minLength(1), v.regex(/^[a-fA-F0-9]+$/)),
});
const nonNegativeIntegerHeader = v.pipe(
  v.string(),
  v.regex(/^\d+$/),
  v.transform(Number),
  v.number(),
  v.integer(),
  v.minValue(0),
);
const interactiveHeader = v.pipe(
  v.picklist(['0', '1']),
  v.transform((value): 0 | 1 => (value === '0' ? 0 : 1)),
);
const clientHeadersSchema = v.object({
  'x-artifact-client-ci': v.optional(v.pipe(v.string(), v.maxLength(50))),
  'x-artifact-client-interactive': v.optional(interactiveHeader),
});
const uploadHeadersSchema = v.object({
  'content-length': nonNegativeIntegerHeader,
  'content-type': v.literal('application/octet-stream'),
  'x-artifact-client-ci': v.optional(v.pipe(v.string(), v.maxLength(50))),
  'x-artifact-client-interactive': v.optional(interactiveHeader),
  'x-artifact-dirty-hash': v.optional(v.string()),
  'x-artifact-duration': v.optional(nonNegativeIntegerHeader),
  'x-artifact-sha': v.optional(v.string()),
  'x-artifact-tag': v.optional(v.pipe(v.string(), v.maxLength(600))),
});
const artifactQuerySchema = v.object({ hashes: v.array(v.string()) });
const cacheEventsSchema = v.array(
  v.object({
    duration: v.optional(v.pipe(v.number(), v.integer(), v.minValue(0))),
    event: v.picklist(['HIT', 'MISS']),
    hash: v.string(),
    sessionId: v.pipe(v.string(), v.uuid()),
    source: v.picklist(['LOCAL', 'REMOTE']),
  }),
);

type RemoteCacheOperationId = keyof typeof remoteCacheOperations;

const operationPath = <OperationId extends RemoteCacheOperationId>(
  operationId: OperationId,
  expectedMethod: (typeof remoteCacheOperations)[OperationId]['method'],
): string => {
  const operation = remoteCacheOperations[operationId];
  if (operation.method !== expectedMethod) {
    throw new Error(
      `Remote cache operation ${operationId} changed from ${expectedMethod.toUpperCase()} to ${operation.method.toUpperCase()}`,
    );
  }

  const path = operation.path;
  if (path !== ARTIFACT_PATH_PREFIX && !path.startsWith(`${ARTIFACT_PATH_PREFIX}/`)) {
    throw new Error(`Remote cache operation ${operationId} is outside ${ARTIFACT_PATH_PREFIX}`);
  }

  return path.slice(ARTIFACT_PATH_PREFIX.length).replace(/\{([^}]+)\}/g, ':$1') || '/';
};

const operationRoutes = {
  artifactExists: operationPath('artifactExists', 'head'),
  downloadArtifact: operationPath('downloadArtifact', 'get'),
  getArtifactStatus: operationPath('getArtifactStatus', 'get'),
  queryArtifacts: operationPath('queryArtifacts', 'post'),
  recordCacheEvents: operationPath('recordCacheEvents', 'post'),
  uploadArtifact: operationPath('uploadArtifact', 'put'),
} satisfies Record<RemoteCacheOperationId, string>;

if (operationRoutes.downloadArtifact !== operationRoutes.artifactExists) {
  throw new Error(
    'Hono HEAD dispatch requires downloadArtifact and artifactExists to share a path',
  );
}

const protocolError = <Path extends string, InputType extends Input>(
  c: Context<RemoteCacheEnv, Path, InputType>,
  status: 400 | 401 | 404 | 500,
  code: string,
  message: string,
): Response =>
  c.json(
    {
      code,
      message,
    } satisfies RemoteCacheErrorBody,
    status,
  );

const validationHook = (
  result: { success: boolean },
  c: Context<RemoteCacheEnv, string, Input>,
): Response | undefined =>
  result.success ? undefined : protocolError(c, 400, 'bad_request', 'Request validation failed');

const operationFailure = <Path extends string, InputType extends Input>(
  c: Context<RemoteCacheEnv, Path, InputType>,
  error: unknown,
): Response => {
  if (error instanceof RemoteCacheProtocolError) {
    return protocolError(c, error.status, error.code, error.message);
  }

  if (error instanceof HTTPException && error.status >= 400 && error.status < 500) {
    return protocolError(c, 400, 'bad_request', 'Request validation failed');
  }

  console.error(
    JSON.stringify({
      error: error instanceof Error ? error.message : String(error),
      message: 'Remote cache operation failed',
      path: new URL(c.req.raw.url).pathname,
    }),
  );
  return protocolError(c, 500, 'internal_error', 'The remote cache operation failed');
};

const handlerContext = <Path extends string, InputType extends Input>(
  c: Context<RemoteCacheEnv, Path, InputType>,
): RemoteCacheHandlerContext => ({
  files: c.env.FILES,
  request: c.req.raw,
  waitUntil: c.env.WAIT_UNTIL,
});

const emptyBody = (): ReadableStream<Uint8Array> =>
  new ReadableStream<Uint8Array>({
    start(controller) {
      controller.close();
    },
  });

const canUseArtifactCache = (request: Request): boolean =>
  request.method === 'GET' && typeof caches !== 'undefined';

const getCachedArtifactResponse = async (request: Request): Promise<Response | undefined> => {
  if (!canUseArtifactCache(request)) return undefined;
  return (await caches.open(ARTIFACT_CACHE_NAME)).match(request.url);
};

const cacheArtifactResponse = (context: RemoteCacheHandlerContext, response: Response): void => {
  if (!canUseArtifactCache(context.request)) return;
  context.waitUntil(
    caches
      .open(ARTIFACT_CACHE_NAME)
      .then((artifactCache) => artifactCache.put(context.request.url, response)),
  );
};

const responseHeaders = (
  size: number,
  metadata: ArtifactMetadata,
  includeTag: boolean,
): Record<string, string> => ({
  'Content-Length': String(size),
  ...(metadata.dirtyHash === undefined ? {} : { 'x-artifact-dirty-hash': metadata.dirtyHash }),
  ...(metadata.duration === undefined ? {} : { 'x-artifact-duration': String(metadata.duration) }),
  ...(metadata.sha === undefined ? {} : { 'x-artifact-sha': metadata.sha }),
  ...(includeTag && metadata.tag !== undefined ? { 'x-artifact-tag': metadata.tag } : {}),
});

const requestHeaders = (request: Request): Record<string, string | undefined> => ({
  'x-artifact-client-ci': request.headers.get('x-artifact-client-ci') ?? undefined,
  'x-artifact-client-interactive':
    request.headers.get('x-artifact-client-interactive') ?? undefined,
});

export const createArtifactRouter = (
  handlers: RemoteCacheHandlers = remoteCacheHandlers,
): Hono<RemoteCacheEnv> => {
  const router = new Hono<RemoteCacheEnv>();

  router.onError((error, c) => operationFailure(c, error));

  router.use('*', async (c, next) => {
    const authorization = c.req.header('Authorization');
    const match = authorization?.match(/^Bearer\s+([^\s]+)$/i);
    if (!match || !(await timingSafeEqual(c.env.TURBO_TOKEN, match[1]))) {
      return protocolError(c, 401, 'unauthorized', 'A valid bearer token is required');
    }
    return next();
  });

  router.get(
    operationRoutes.getArtifactStatus,
    vValidator('query', teamQuerySchema, validationHook),
    async (c) => {
      const output = await handlers.getArtifactStatus(
        { query: c.req.valid('query') },
        handlerContext(c),
      );
      return c.json(output, 200);
    },
  );

  router.post(
    operationRoutes.queryArtifacts,
    vValidator('json', artifactQuerySchema, validationHook),
    vValidator('query', teamQuerySchema, validationHook),
    async (c) => {
      const output = await handlers.queryArtifacts(
        {
          body: c.req.valid('json'),
          query: c.req.valid('query'),
        },
        handlerContext(c),
      );
      return c.json(output, 200);
    },
  );

  router.post(
    operationRoutes.recordCacheEvents,
    vValidator('json', cacheEventsSchema, validationHook),
    vValidator('query', teamQuerySchema, validationHook),
    vValidator('header', clientHeadersSchema, validationHook),
    async (c) => {
      await handlers.recordCacheEvents(
        {
          body: c.req.valid('json'),
          headers: c.req.valid('header'),
          query: c.req.valid('query'),
        },
        handlerContext(c),
      );
      return c.body(null, 200);
    },
  );

  router.put(
    operationRoutes.uploadArtifact,
    vValidator('param', artifactPathSchema, validationHook),
    vValidator('query', teamQuerySchema, validationHook),
    vValidator('header', uploadHeadersSchema, validationHook),
    async (c) => {
      const headers = c.req.valid('header');
      const requestBody = c.req.raw.body;
      if (!requestBody && headers['content-length'] !== 0) {
        return protocolError(c, 400, 'bad_request', 'The artifact request body is required');
      }

      const output = await handlers.uploadArtifact(
        {
          body: requestBody ?? emptyBody(),
          headers: {
            'Content-Length': headers['content-length'],
            'x-artifact-client-ci': headers['x-artifact-client-ci'],
            'x-artifact-client-interactive': headers['x-artifact-client-interactive'],
            'x-artifact-dirty-hash': headers['x-artifact-dirty-hash'],
            'x-artifact-duration': headers['x-artifact-duration'],
            'x-artifact-sha': headers['x-artifact-sha'],
            'x-artifact-tag': headers['x-artifact-tag'],
          },
          path: c.req.valid('param'),
          query: c.req.valid('query'),
        },
        handlerContext(c),
      );
      return c.json(output, 202);
    },
  );

  // Hono deliberately converts HEAD to GET before matching routes. Keep this
  // single GET route and dispatch the two OpenAPI operationIds inside it.
  router.get(
    operationRoutes.downloadArtifact,
    vValidator('param', artifactPathSchema, validationHook),
    vValidator('query', teamQuerySchema, validationHook),
    async (c) => {
      const context = handlerContext(c);
      const path = c.req.valid('param');
      const query = c.req.valid('query');

      if (c.req.raw.method === 'HEAD') {
        const artifact = await handlers.artifactExists({ path, query }, context);
        if (!artifact) {
          return protocolError(c, 404, 'artifact_not_found', 'Artifact not found');
        }
        return c.body(null, 200, responseHeaders(artifact.size, artifact.metadata, false));
      }

      const parsedHeaders = v.safeParse(clientHeadersSchema, requestHeaders(c.req.raw));
      if (!parsedHeaders.success) {
        return protocolError(c, 400, 'bad_request', 'Request validation failed');
      }

      const cachedResponse = await getCachedArtifactResponse(c.req.raw);
      if (cachedResponse) return cachedResponse;

      const artifact = await handlers.downloadArtifact(
        { headers: parsedHeaders.output, path, query },
        context,
      );
      if (!artifact) {
        return protocolError(c, 404, 'artifact_not_found', 'Artifact not found');
      }

      const headers = {
        ...responseHeaders(artifact.size, artifact.metadata, true),
        'Cache-Control': ARTIFACT_CACHE_CONTROL,
        'Content-Type': 'application/octet-stream',
      };
      let responseBody = artifact.body;
      if (canUseArtifactCache(c.req.raw)) {
        const [clientBody, cacheBody] = responseBody.tee();
        responseBody = clientBody;
        cacheArtifactResponse(context, new Response(cacheBody, { headers, status: 200 }));
      }

      return c.body(responseBody, 200, headers);
    },
  );

  return router;
};

export const createRemoteCacheRouter = (
  handlers: RemoteCacheHandlers = remoteCacheHandlers,
): Hono<RemoteCacheEnv> => {
  const router = new Hono<RemoteCacheEnv>();
  router.route('/artifacts', createArtifactRouter(handlers));
  return router;
};
