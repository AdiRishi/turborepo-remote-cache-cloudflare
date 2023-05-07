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
        headers: { Authorization: 'Bearer ' + workerEnv.TURBO_TOKEN },
        method: 'GET',
      });
    }

    test('should return 400 when teamId is missing', async () => {
      const request = createArtifactGetRequest(`http://localhost/v8/artifacts/${artifactId}`);
      const res = await app.fetch(request, workerEnv);
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: 'MISSING_TEAM_ID' });
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

    test('should return artifact content when artifact exists', async () => {
      const request = createArtifactGetRequest(
        `http://localhost/v8/artifacts/existing-${artifactId}?teamId=${teamId}`
      );
      const res = await app.fetch(request, workerEnv);
      expect(res.status).toBe(200);
      expect(await res.text()).toBe(artifactContent);
    });

    test('should return the proper content type when artifact exists', async () => {
      const request = createArtifactGetRequest(
        `http://localhost/v8/artifacts/existing-${artifactId}?teamId=${teamId}`
      );
      const res = await app.fetch(request, workerEnv);
      expect(res.status).toBe(200);
      expect(await res.text()).toBe(artifactContent);
      expect(res.headers.get('Content-Type')).toBe('application/octet-stream');
    });

    test('should return the artifact tag', async () => {
      const request = createArtifactGetRequest(
        `http://localhost/v8/artifacts/existing-${artifactId}?teamId=${teamId}`
      );
      const res = await app.fetch(request, workerEnv);
      expect(res.status).toBe(200);
      expect(await res.text()).toBe(artifactContent);
      expect(res.headers.get('Content-Type')).toBe('application/octet-stream');
      expect(res.headers.get('x-artifact-tag')).toBe(artifactTag);
    });
  });

  describe('PUT artifact endpoint', () => {
    function createArtifactPutRequest(url: string, includeTag = false) {
      const request = new Request(url, {
        headers: {
          Authorization: 'Bearer ' + workerEnv.TURBO_TOKEN,
          'Content-Type': 'application/octet-stream',
        },
        method: 'PUT',
        body: artifactContent,
      });
      if (includeTag) {
        request.headers.set('x-artifact-tag', artifactTag);
      }
      return request;
    }

    test('should return 400 when teamId is missing', async () => {
      const request = createArtifactPutRequest(`http://localhost/v8/artifacts/${artifactId}`);
      const res = await app.fetch(request, workerEnv);
      expect(res.status).toBe(400);
    });

    test('should successfully save artifact', async () => {
      const request = createArtifactPutRequest(
        `http://localhost/v8/artifacts/${artifactId}?teamId=${teamId}`
      );
      const res = await app.fetch(request, workerEnv);
      expect(res.status).toBe(201);

      const artifact = await workerEnv.R2_STORE.get(`${teamId}/${artifactId}`);
      expect(await artifact?.text()).toEqual(artifactContent);
    });

    test('should accept both teamId and slug as query params', async () => {
      const request = createArtifactPutRequest(
        `http://localhost/v8/artifacts/${artifactId}?teamId=${teamId}`
      );
      const res = await app.fetch(request, workerEnv);
      expect(res.status).toBe(201);

      const request2 = createArtifactPutRequest(
        `http://localhost/v8/artifacts/${artifactId}?slug=${teamId}`
      );
      const res2 = await app.fetch(request2, workerEnv);
      expect(res2.status).toBe(201);
    });

    test('should save artifact tag when provided', async () => {
      const request = createArtifactPutRequest(
        `http://localhost/v8/artifacts/${artifactId}?teamId=${teamId}`,
        true
      );
      const res = await app.fetch(request, workerEnv);
      expect(res.status).toBe(201);

      const artifact = await workerEnv.R2_STORE.get(`${teamId}/${artifactId}`);
      expect(await artifact?.text()).toEqual(artifactContent);
      expect(artifact?.customMetadata?.artifactTag).toEqual(artifactTag);
    });

    test('should return 400 when content type is not application/octet-stream', async () => {
      const request = createArtifactPutRequest(
        `http://localhost/v8/artifacts/${artifactId}?teamId=${teamId}`
      );
      request.headers.delete('Content-Type');
      const res = await app.fetch(request, workerEnv);
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: 'EXPECTED_CONTENT_TYPE_OCTET_STREAM' });
    });
  });

  describe('HEAD artifact endpoint', () => {
    beforeEach(async () => {
      await workerEnv.R2_STORE.put(`${teamId}/existing-${artifactId}`, artifactContent, {
        customMetadata: { artifactTag },
      });
    });

    function createArtifactHeadRequest(url: string) {
      return new Request(url, {
        headers: { Authorization: 'Bearer ' + workerEnv.TURBO_TOKEN },
        method: 'HEAD',
      });
    }

    test('should return 400 when teamId is missing', async () => {
      const request = createArtifactHeadRequest(`http://localhost/v8/artifacts/${artifactId}`);
      const res = await app.fetch(request, workerEnv);
      expect(res.status).toBe(400);
    });

    test('should return 404 when artifact does not exist', async () => {
      const request = createArtifactHeadRequest(
        `http://localhost/v8/artifacts/${artifactId}?teamId=${teamId}`
      );
      const res = await app.fetch(request, workerEnv);
      expect(res.status).toBe(404);
    });

    test('should return 200 when artifact exists', async () => {
      const request = createArtifactHeadRequest(
        `http://localhost/v8/artifacts/existing-${artifactId}?teamId=${teamId}`
      );
      const res = await app.fetch(request, workerEnv);
      expect(res.status).toBe(200);
    });

    test('should accept both teamId and slug as query params', async () => {
      const request = createArtifactHeadRequest(
        `http://localhost/v8/artifacts/existing-${artifactId}?teamId=${teamId}`
      );
      const res = await app.fetch(request, workerEnv);
      expect(res.status).toBe(200);

      const request2 = createArtifactHeadRequest(
        `http://localhost/v8/artifacts/existing-${artifactId}?slug=${teamId}`
      );
      const res2 = await app.fetch(request2, workerEnv);
      expect(res2.status).toBe(200);
    });
  });

  describe('Artifact events endpoint', () => {
    test('it should return 200', async () => {
      const request = new Request('http://localhost/v8/artifacts/events', {
        headers: { Authorization: 'Bearer ' + workerEnv.TURBO_TOKEN },
        method: 'POST',
        body: JSON.stringify({}),
      });
      const res = await app.fetch(request, workerEnv);
      expect(res.status).toBe(200);
    });
  });
});
