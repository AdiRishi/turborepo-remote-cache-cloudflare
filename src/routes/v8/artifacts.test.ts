import { beforeEach, expect, test } from 'vitest';
import { app } from '../../routes/';
import { Env } from '../..';

const describe = setupMiniflareIsolatedStorage();

describe('v8 Artifacts API', () => {
  const workerEnv = getMiniflareBindings<Env>();
  const artifactId = 'UNIQUE-artifactId-' + Math.random();
  const artifactTag = 'UNIQUE-artifactTag-' + Math.random();
  const teamId = 'UNIQUE-teamId-' + Math.random();
  const artifactContent = '🎉😄😇';

  describe('GET artifact endpoint', () => {
    beforeEach(async () => {
      await workerEnv.R2_STORE.put(`${teamId}/existing-${artifactId}`, artifactContent, {
        customMetadata: { artifactTag },
      });
    });

    function createArtifactGetRequest(url: string) {
      return new Request(url, {
        headers: { Authorization: 'Bearer ' + workerEnv.AUTH_SECRET },
        method: 'GET',
      });
    }

    test('should return 400 when teamId is missing', async () => {
      const request = createArtifactGetRequest(`http://localhost/v8/artifacts/${artifactId}`);
      const res = await app.fetch(request, workerEnv);
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: 'MISSING_TEAM_ID' });
    });

    test('should accept both teamId and slug as query params', async () => {
      const request = createArtifactGetRequest(
        `http://localhost/v8/artifacts/existing-${artifactId}?teamId=${teamId}`
      );
      const res = await app.fetch(request, workerEnv);
      expect(res.status).toBe(200);

      const request2 = createArtifactGetRequest(
        `http://localhost/v8/artifacts/existing-${artifactId}?slug=${teamId}`
      );
      const res2 = await app.fetch(request2, workerEnv);
      expect(res2.status).toBe(200);
    });

    test('should return 404 when artifact does not exist', async () => {
      const request = createArtifactGetRequest(
        `http://localhost/v8/artifacts/${artifactId}?teamId=${teamId}`
      );
      const res = await app.fetch(request, workerEnv);
      expect(res.status).toBe(404);
    });

    test('should return 200 when artifact exists', async () => {
      const request = createArtifactGetRequest(
        `http://localhost/v8/artifacts/existing-${artifactId}?teamId=${teamId}`
      );
      const res = await app.fetch(request, workerEnv);
      expect(res.status).toBe(200);
    });

    test('should return artifact content when artifact exists', async () => {
      const request = new Request(
        `http://localhost/v8/artifacts/existing-${artifactId}?teamId=${teamId}`,
        {
          headers: { Authorization: 'Bearer ' + workerEnv.AUTH_SECRET },
          method: 'GET',
        }
      );
      const res = await app.fetch(request, workerEnv);
      expect(res.status).toBe(200);
      expect(await res.text()).toBe(artifactContent);
    });

    test('should return the proper content type when artifact exists', async () => {
      const request = new Request(
        `http://localhost/v8/artifacts/existing-${artifactId}?teamId=${teamId}`,
        {
          headers: { Authorization: 'Bearer ' + workerEnv.AUTH_SECRET },
          method: 'GET',
        }
      );
      const res = await app.fetch(request, workerEnv);
      expect(res.status).toBe(200);
      expect(await res.text()).toBe(artifactContent);
      expect(res.headers.get('Content-Type')).toBe('application/octet-stream');
    });

    test('should return the artifact tag', async () => {
      const request = new Request(
        `http://localhost/v8/artifacts/existing-${artifactId}?teamId=${teamId}`,
        {
          headers: { Authorization: 'Bearer ' + workerEnv.AUTH_SECRET },
          method: 'GET',
        }
      );
      const res = await app.fetch(request, workerEnv);
      expect(res.status).toBe(200);
      expect(await res.text()).toBe(artifactContent);
      expect(res.headers.get('Content-Type')).toBe('application/octet-stream');
      expect(res.headers.get('x-artifact-tag')).toBe(artifactTag);
    });
  });

  describe('PUT artifact endpoint', () => {
    test('should return 400 when teamId is missing', async () => {
      const request = new Request(`http://localhost/v8/artifacts/${artifactId}`, {
        headers: { Authorization: 'Bearer ' + workerEnv.AUTH_SECRET },
        method: 'PUT',
      });
      const res = await app.fetch(request, workerEnv);
      expect(res.status).toBe(400);
    });

    test('should successfully save artifact', async () => {
      const request = new Request(`http://localhost/v8/artifacts/${artifactId}?teamId=${teamId}`, {
        headers: {
          Authorization: 'Bearer ' + workerEnv.AUTH_SECRET,
          'Content-Type': 'application/octet-stream',
        },
        method: 'PUT',
        body: artifactContent,
      });
      const res = await app.fetch(request, workerEnv);
      expect(res.status).toBe(201);

      const artifact = await workerEnv.R2_STORE.get(`${teamId}/${artifactId}`);
      expect(await artifact?.text()).toEqual(artifactContent);
    });

    test('should accept both teamId and slug as query params', async () => {
      const request = new Request(`http://localhost/v8/artifacts/${artifactId}?teamId=${teamId}`, {
        headers: {
          Authorization: 'Bearer ' + workerEnv.AUTH_SECRET,
          'Content-Type': 'application/octet-stream',
        },
        method: 'PUT',
        body: artifactContent,
      });
      const res = await app.fetch(request, workerEnv);
      expect(res.status).toBe(201);

      const request2 = new Request(`http://localhost/v8/artifacts/${artifactId}?slug=${teamId}`, {
        headers: {
          Authorization: 'Bearer ' + workerEnv.AUTH_SECRET,
          'Content-Type': 'application/octet-stream',
        },
        method: 'PUT',
        body: artifactContent,
      });
      const res2 = await app.fetch(request2, workerEnv);
      expect(res2.status).toBe(201);
    });
  });
});
