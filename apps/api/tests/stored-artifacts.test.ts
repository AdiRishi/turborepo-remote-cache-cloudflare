import { describe, expect, test, vi } from 'vitest';

import { authorized, randomHash } from './support/client';
import { storage } from './support/memory-storage';

vi.mock('../src/custom-adapter', () => import('./support/memory-storage'));

describe('artifacts written before this version', () => {
  test('serves an R2 artifact from the previous server, which stored only the tag', async () => {
    const hash = randomHash();
    const body = new Uint8Array([1, 2, 3]);
    await storage.upload(`team_default_team/${hash}`, body, {
      metadata: { artifactTag: 'legacy' },
    });

    const response = await authorized(`/v8/artifacts/${hash}`);
    expect(response.status).toBe(200);
    expect(response.headers.get('x-artifact-tag')).toBe('legacy');
    expect(response.headers.has('x-artifact-duration')).toBe(false);
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(body);
  });

  test('reads metadata that an S3-compatible store returns with lowercased keys', async () => {
    const hash = randomHash();
    await storage.upload(`team_default_team/${hash}`, new Uint8Array(4), {
      metadata: { artifacttag: 'tag', artifactduration: '42', artifactsha: 'sha' },
    });

    const head = await authorized(`/v8/artifacts/${hash}`, { method: 'HEAD' });
    expect(head.headers.get('x-artifact-duration')).toBe('42');
    expect(head.headers.get('x-artifact-sha')).toBe('sha');

    const query = await authorized('/v8/artifacts', {
      method: 'POST',
      body: JSON.stringify({ hashes: [hash] }),
    });
    expect(await query.json()).toEqual({
      [hash]: { size: 4, taskDurationMs: 42, tag: 'tag', sha: 'sha' },
    });
  });
});
