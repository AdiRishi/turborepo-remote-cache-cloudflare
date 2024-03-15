import { env, createExecutionContext } from 'cloudflare:test';
import { describe, beforeEach, test, expect } from 'vitest';
import { Env } from '~/index';
import { app } from '~/routes';

describe('Homepage route', () => {
  let workerEnv: Env;
  let ctx: ExecutionContext;

  beforeEach(() => {
    workerEnv = env;
    ctx = createExecutionContext();
  });

  test('should return a 200 status code', async () => {
    const request = new Request('http://localhost/', {
      method: 'GET',
    });
    const response = await app.fetch(request, workerEnv, ctx);
    expect(response.status).toBe(200);
  });
});
