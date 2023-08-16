import { beforeEach, expect, test } from 'vitest';
import { app } from '../../routes/';
import { Env } from '../..';

const describe = setupMiniflareIsolatedStorage();

describe('Authentication module for artifacts API', () => {
  const artifactId = 'UNIQUE-artifactId-' + Math.random();
  const teamId = 'UNIQUE-teamId-' + Math.random();

  beforeEach(async () => {
    const workerEnv = getMiniflareBindings<Env>();
    await workerEnv.R2_STORE.put(`${teamId}/${artifactId}`, '🎉😄😇', {
      customMetadata: { artifactTag: 'UNIQUE-artifactTag-' + Math.random() },
    });
  });

  function createArtifactGetRequest(url: string, includeAuth = true) {
    const request = new Request(url, {
      method: 'GET',
    });
    if (includeAuth) {
      request.headers.set('Authorization', 'Bearer ' + getMiniflareBindings<Env>().TURBO_TOKEN);
    }
    return request;
  }

  describe('should require authentication when uploading artifacts', () => {
    let workerEnv: Env;
    let ctx: ExecutionContext;

    beforeEach(() => {
      workerEnv = getMiniflareBindings<Env>();
      ctx = new ExecutionContext();
    });

    test('should return 401 when Authorization header is missing', async () => {
      const request = createArtifactGetRequest(
        `http://localhost/v8/artifacts/${artifactId}?teamId=${teamId}`,
        false
      );
      const res = await app.fetch(request, workerEnv, ctx);
      expect(res.status).toBe(401);
    });

    test('should return 200 when Authorization header is present', async () => {
      const request = createArtifactGetRequest(
        `http://localhost/v8/artifacts/${artifactId}?teamId=${teamId}`
      );
      const res = await app.fetch(request, workerEnv, ctx);
      expect(res.status).toBe(200);
    });
  });
});
