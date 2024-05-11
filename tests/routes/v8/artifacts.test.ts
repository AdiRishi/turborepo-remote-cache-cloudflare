import { beforeEach, expect, test } from 'vitest';
import { Env, workerHandler } from '~/index';
import { DEFAULT_TEAM_ID } from '~/routes/v8/artifacts';
import { StorageManager } from '~/storage';

const describe = setupMiniflareIsolatedStorage();

describe('v8 Artifacts API', () => {
  const app = workerHandler;
  let workerEnv: Env;
  let ctx: ExecutionContext;
  const artifactId = 'UNIQUE-artifactId-' + Math.random();
  const artifactTag = 'UNIQUE-artifactTag-' + Math.random();
  const teamId = 'UNIQUE-teamId-' + Math.random();
  const artifactContent = '🎉😄😇';

  describe('GET artifact endpoint', () => {
    beforeEach(async () => {
      workerEnv = getMiniflareBindings();
      workerEnv.STORAGE_MANAGER = new StorageManager(workerEnv);
      ctx = new ExecutionContext();
      await workerEnv.STORAGE_MANAGER.getActiveStorage().write(
        `${teamId}/${artifactId}`,
        artifactContent,
        { artifactTag }
      );
    });

    function createArtifactGetRequest(url: string) {
      return new Request(url, {
        headers: { Authorization: 'Bearer ' + workerEnv.TURBO_TOKEN },
        method: 'GET',
      });
    }

    test('should use the default team ID when none is provided', async () => {
      let request = createArtifactGetRequest(`http://localhost/v8/artifacts/${artifactId}`);
      let res = await app.fetch(request, workerEnv, ctx);
      expect(res.status).toBe(404);

      await workerEnv.STORAGE_MANAGER.getActiveStorage().write(
        `${DEFAULT_TEAM_ID}/${artifactId}`,
        artifactContent,
        { artifactTag }
      );

      request = createArtifactGetRequest(`http://localhost/v8/artifacts/${artifactId}`);
      res = await app.fetch(request, workerEnv, ctx);
      expect(res.status).toBe(200);
    });

    test('should return 404 when artifact does not exist', async () => {
      const request = createArtifactGetRequest(
        `http://localhost/v8/artifacts/missing-${artifactId}?teamId=${teamId}`
      );
      const res = await app.fetch(request, workerEnv, ctx);
      expect(res.status).toBe(404);
    });

    test('should return 200 when artifact exists', async () => {
      const request = createArtifactGetRequest(
        `http://localhost/v8/artifacts/${artifactId}?teamId=${teamId}`
      );
      const res = await app.fetch(request, workerEnv, ctx);
      expect(res.status).toBe(200);
    });

    test('should accept both teamId and slug as query params', async () => {
      const request = createArtifactGetRequest(
        `http://localhost/v8/artifacts/${artifactId}?teamId=${teamId}`
      );
      const res = await app.fetch(request, workerEnv, ctx);
      expect(res.status).toBe(200);

      const request2 = createArtifactGetRequest(
        `http://localhost/v8/artifacts/${artifactId}?slug=${teamId}`
      );
      const res2 = await app.fetch(request2, workerEnv, ctx);
      expect(res2.status).toBe(200);
    });

    test('should return artifact content when artifact exists', async () => {
      const request = createArtifactGetRequest(
        `http://localhost/v8/artifacts/${artifactId}?teamId=${teamId}`
      );
      const res = await app.fetch(request, workerEnv, ctx);
      expect(res.status).toBe(200);
      expect(await res.text()).toBe(artifactContent);
    });

    test('should return the proper content type when artifact exists', async () => {
      const request = createArtifactGetRequest(
        `http://localhost/v8/artifacts/${artifactId}?teamId=${teamId}`
      );
      const res = await app.fetch(request, workerEnv, ctx);
      expect(res.status).toBe(200);
      expect(await res.text()).toBe(artifactContent);
      expect(res.headers.get('Content-Type')).toBe('application/octet-stream');
    });

    test('should return the artifact tag', async () => {
      const request = createArtifactGetRequest(
        `http://localhost/v8/artifacts/${artifactId}?teamId=${teamId}`
      );
      const res = await app.fetch(request, workerEnv, ctx);
      expect(res.status).toBe(200);
      expect(await res.text()).toBe(artifactContent);
      expect(res.headers.get('Content-Type')).toBe('application/octet-stream');
      expect(res.headers.get('x-artifact-tag')).toBe(artifactTag);
    });

    test('should return cache headers on every request', async () => {
      const request = createArtifactGetRequest(
        `http://localhost/v8/artifacts/${artifactId}?teamId=${teamId}`
      );
      const res = await app.fetch(request, workerEnv, ctx);
      expect(res.status).toBe(200);
      expect(res.headers.get('Cache-Control')).toBe('max-age=300, stale-while-revalidate=300');
    });
  });

  describe('PUT artifact endpoint', () => {
    beforeEach(() => {
      workerEnv = getMiniflareBindings();
      workerEnv.STORAGE_MANAGER = new StorageManager(workerEnv);
      ctx = new ExecutionContext();
    });

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

    test('should use the default team ID when none is provided', async () => {
      const request = createArtifactPutRequest(`http://localhost/v8/artifacts/${artifactId}`);
      const res = await app.fetch(request, workerEnv, ctx);
      expect(res.status).toBe(202);

      const artifactStream = await workerEnv.STORAGE_MANAGER.getActiveStorage().read(
        `${DEFAULT_TEAM_ID}/${artifactId}`
      );
      const artifact = await StorageManager.readableStreamToText(artifactStream!);
      expect(artifact).toEqual(artifactContent);
    });

    test('should successfully save artifact', async () => {
      const request = createArtifactPutRequest(
        `http://localhost/v8/artifacts/${artifactId}?teamId=${teamId}`
      );
      const res = await app.fetch(request, workerEnv, ctx);
      expect(res.status).toBe(202);

      const artifactStream = await workerEnv.STORAGE_MANAGER.getActiveStorage().read(
        `${teamId}/${artifactId}`
      );
      const artifact = await StorageManager.readableStreamToText(artifactStream!);
      expect(artifact).toEqual(artifactContent);
    });

    test('should accept both teamId and slug as query params', async () => {
      const request = createArtifactPutRequest(
        `http://localhost/v8/artifacts/${artifactId}?teamId=${teamId}`
      );
      const res = await app.fetch(request, workerEnv, ctx);
      expect(res.status).toBe(202);

      const request2 = createArtifactPutRequest(
        `http://localhost/v8/artifacts/${artifactId}?slug=${teamId}`
      );
      const res2 = await app.fetch(request2, workerEnv, ctx);
      expect(res2.status).toBe(202);
    });

    test('should save artifact tag when provided', async () => {
      const request = createArtifactPutRequest(
        `http://localhost/v8/artifacts/${artifactId}?teamId=${teamId}`,
        true
      );
      const res = await app.fetch(request, workerEnv, ctx);
      expect(res.status).toBe(202);

      const artifactWithMeta = await workerEnv.STORAGE_MANAGER.getActiveStorage().readWithMetadata(
        `${teamId}/${artifactId}`
      );
      const artifact = await StorageManager.readableStreamToText(artifactWithMeta.data!);
      expect(artifact).toEqual(artifactContent);
      expect(artifactWithMeta?.metadata?.customMetadata?.artifactTag).toEqual(artifactTag);
    });

    test('should return 400 when content type is not application/octet-stream', async () => {
      const request = createArtifactPutRequest(
        `http://localhost/v8/artifacts/${artifactId}?teamId=${teamId}`
      );
      request.headers.delete('Content-Type');
      const res = await app.fetch(request, workerEnv, ctx);
      expect(res.status).toBe(400);
    });
  });

  describe('HEAD artifact endpoint', () => {
    beforeEach(async () => {
      workerEnv = getMiniflareBindings();
      workerEnv.STORAGE_MANAGER = new StorageManager(workerEnv);
      ctx = new ExecutionContext();
      await workerEnv.STORAGE_MANAGER.getActiveStorage().write(
        `${teamId}/${artifactId}`,
        artifactContent,
        { artifactTag }
      );
    });

    function createArtifactHeadRequest(url: string) {
      return new Request(url, {
        headers: { Authorization: 'Bearer ' + workerEnv.TURBO_TOKEN },
        method: 'HEAD',
      });
    }

    test('should use the default team ID when none is provided', async () => {
      let request = createArtifactHeadRequest(`http://localhost/v8/artifacts/${artifactId}`);
      let res = await app.fetch(request, workerEnv, ctx);
      expect(res.status).toBe(404);

      await workerEnv.STORAGE_MANAGER.getActiveStorage().write(
        `${DEFAULT_TEAM_ID}/${artifactId}`,
        artifactContent,
        { artifactTag }
      );
      request = createArtifactHeadRequest(`http://localhost/v8/artifacts/${artifactId}`);
      res = await app.fetch(request, workerEnv, ctx);
      expect(res.status).toBe(200);
    });

    test('should return 404 when artifact does not exist', async () => {
      const request = createArtifactHeadRequest(
        `http://localhost/v8/artifacts/missing-${artifactId}?teamId=${teamId}`
      );
      const res = await app.fetch(request, workerEnv, ctx);
      expect(res.status).toBe(404);
    });

    test('should return 200 when artifact exists', async () => {
      const request = createArtifactHeadRequest(
        `http://localhost/v8/artifacts/${artifactId}?teamId=${teamId}`
      );
      const res = await app.fetch(request, workerEnv, ctx);
      expect(res.status).toBe(200);
    });

    test('should accept both teamId and slug as query params', async () => {
      const request = createArtifactHeadRequest(
        `http://localhost/v8/artifacts/${artifactId}?teamId=${teamId}`
      );
      const res = await app.fetch(request, workerEnv, ctx);
      expect(res.status).toBe(200);

      const request2 = createArtifactHeadRequest(
        `http://localhost/v8/artifacts/${artifactId}?slug=${teamId}`
      );
      const res2 = await app.fetch(request2, workerEnv, ctx);
      expect(res2.status).toBe(200);
    });
  });

  describe('Artifact events endpoint', () => {
    beforeEach(() => {
      workerEnv = getMiniflareBindings();
      workerEnv.STORAGE_MANAGER = new StorageManager(workerEnv);
      ctx = new ExecutionContext();
    });

    test('it should return 200', async () => {
      const request = new Request('http://localhost/v8/artifacts/events', {
        headers: {
          Authorization: 'Bearer ' + workerEnv.TURBO_TOKEN,
          'Content-Type': 'application/json',
        },
        method: 'POST',
        body: JSON.stringify([
          {
            sessionId: '30fb7fdf-8124-4fce-8121-d525170942a0',
            source: 'LOCAL',
            event: 'HIT',
            hash: '12HKQaOmR5t5Uy6vdcQsNIiZgHGB',
            duration: 400,
          },
        ]),
      });
      const res = await app.fetch(request, workerEnv, ctx);
      expect(res.status).toBe(200);
    });
  });
});
