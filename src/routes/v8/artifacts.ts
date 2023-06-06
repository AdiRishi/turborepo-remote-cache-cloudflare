import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { z } from 'zod';
import { Env } from '../..';

// Route - /v8/artifacts
export const artifactRouter = new Hono<{ Bindings: Env }>();

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

    const contentType = c.req.headers.get('Content-Type');
    if (contentType !== 'application/octet-stream') {
      return c.json({ error: 'EXPECTED_CONTENT_TYPE_OCTET_STREAM' }, 400);
    }

    // if present the turborepo client has signed the artifact body
    const artifactTag = c.req.headers.get('x-artifact-tag');

    const r2Metadata: Record<string, string> = {};
    if (artifactTag) {
      r2Metadata.artifactTag = artifactTag;
    }
    const r2Object = await c.env.R2_STORE.put(`${teamId}/${artifactId}`, c.req.body, {
      customMetadata: r2Metadata,
    });

    return c.json({ teamId, artifactId, storagePath: r2Object.key, size: r2Object.size }, 201);
  }
);

// Hono router .get() method captures both GET and HEAD requests
artifactRouter.get(
  '/:artifactId/:teamId?',
  zValidator('param', z.object({ artifactId: z.string() })),
  zValidator('query', z.object({ teamId: z.string().optional(), slug: z.string().optional() })),
  async (c) => {
    const { artifactId } = c.req.valid('param');
    const { teamId: teamIdQuery, slug } = c.req.valid('query');
    const teamId = teamIdQuery ?? slug;

    if (!teamId) {
      return c.json({ error: 'MISSING_TEAM_ID' }, 400);
    }

    const r2Object = await c.env.R2_STORE.get(`${teamId}/${artifactId}`);
    if (!r2Object) {
      return c.json({ error: 'NOT_FOUND' }, 404);
    }

    c.header('Content-Type', 'application/octet-stream');
    if (r2Object.customMetadata?.artifactTag) {
      c.header('x-artifact-tag', r2Object.customMetadata.artifactTag);
    }
    c.status(200);
    return c.body(r2Object.body);
  }
);

artifactRouter.post('/events', async (c) => {
  return c.json({});
});
