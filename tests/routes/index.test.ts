import { describe, expect, test } from 'vitest';

import { app } from '~/routes';

import { createTestAppContext } from '../helpers/app';

describe('Homepage route', () => {
  test('returns the project landing page', async () => {
    const { bindings } = createTestAppContext();
    const response = await app.fetch(new Request('http://localhost/'), bindings);

    expect(response.status).toBe(200);
    expect(await response.text()).toContain('Turborepo Remote Cache');
  });
});
