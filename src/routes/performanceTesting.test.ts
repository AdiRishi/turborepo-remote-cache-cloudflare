import { expect, it, beforeEach } from 'vitest';
import { app } from '.';
import { Env } from '..';

const describe = setupMiniflareIsolatedStorage();

describe('Performance Testing Routes', () => {
  let workerEnv: Env;
  let ctx: ExecutionContext;

  describe('/performance-testing/r2-round-trip route', () => {
    beforeEach(() => {
      workerEnv = getMiniflareBindings();
      ctx = new ExecutionContext();
    });

    it('should respond to the r2-round-trip route via invoking the app', async () => {
      const request = new Request('http://localhost/performance-testing/r2-round-trip', {
        method: 'POST',
      });
      const res = await app.fetch(request, workerEnv, ctx);
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({
        content: '🎉😄😇🎉😄😇🎉😄😇🎉😄😇',
      });
    });
  });

  describe('/performance-testing/ping route', () => {
    beforeEach(() => {
      workerEnv = getMiniflareBindings();
      ctx = new ExecutionContext();
    });

    it('should respond to the ping route via invoking the app', async () => {
      const request = new Request('http://localhost/performance-testing/ping', {
        method: 'POST',
      });
      const res = await app.fetch(request, workerEnv, ctx);
      expect(res.status).toBe(200);
      expect(await res.text()).toBe('pong');
    });
  });
});
