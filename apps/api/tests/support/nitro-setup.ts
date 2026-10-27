import { beforeAll } from 'vitest';

beforeAll(async () => {
  const { useNitroApp } = await import('nitro/app');
  useNitroApp();
});
