import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { z } from 'zod';
import { Env } from '../..';

// Route - /v8/artifacts
export const artifactRouter = new Hono<{ Bindings: Env }>();

artifactRouter.put(
  '/:artifactId/:teamId?',
  zValidator('param', z.object({ artifactId: z.string(), teamId: z.string().optional() })),
  zValidator('query', z.object({ teamId: z.string().optional() })),
  async (c) => {
    const { artifactId, teamId: teamIdSlug } = c.req.valid('param');
    const { teamId: teamIdQuery } = c.req.valid('query');
    const teamId = teamIdQuery ?? teamIdSlug;

    if (!teamId) {
      return c.json({ error: 'MISSING_TEAM_ID' }, 400);
    }

    const contentType = c.req.headers.get('Content-Type');
    if (contentType !== 'application/octet-stream') {
      return c.json({ error: 'EXPECTED_CONTENT_TYPE_OCTET_STREAM' }, 400);
    }

    const r2Object = await c.env.R2_STORE.put(`${teamId}/${artifactId}`, c.req.body);

    return c.json({ teamId, artifactId, storagePath: r2Object.key, size: r2Object.size });
  }
);

artifactRouter.get(
  '/:artifactId/:teamId?',
  zValidator('param', z.object({ artifactId: z.string(), teamId: z.string().optional() })),
  zValidator('query', z.object({ teamId: z.string().optional() })),
  async (c) => {
    const { artifactId, teamId: teamIdSlug } = c.req.valid('param');
    const { teamId: teamIdQuery } = c.req.valid('query');
    const teamId = teamIdQuery ?? teamIdSlug;

    if (!teamId) {
      return c.json({ error: 'MISSING_TEAM_ID' }, 400);
    }

    const r2Object = await c.env.R2_STORE.get(`${teamId}/${artifactId}`);
    if (!r2Object) {
      return c.json({ error: 'NOT_FOUND' }, 404);
    }

    c.header('Content-Type', 'application/octet-stream');
    c.status(200);
    return c.body(r2Object.body);
  }
);

artifactRouter.head(
  '/:artifactId/:teamId?',
  zValidator('param', z.object({ artifactId: z.string(), teamId: z.string().optional() })),
  zValidator('query', z.object({ teamId: z.string().optional() })),
  async (c) => {
    const { artifactId, teamId: teamIdSlug } = c.req.valid('param');
    const { teamId: teamIdQuery } = c.req.valid('query');
    const teamId = teamIdQuery ?? teamIdSlug;

    if (!teamId) {
      return c.json({ error: 'MISSING_TEAM_ID' }, 400);
    }

    const r2Object = await c.env.R2_STORE.get(`${teamId}/${artifactId}`);
    if (!r2Object) {
      return c.json({ error: 'NOT_FOUND' }, 404);
    }

    return c.json({ exists: true });
  }
);

artifactRouter.post('/events', (c) => {
  return c.json({});
});
