import type { components } from '@turborepo-remote-cache/spec';

import { defineHandler } from 'nitro';
import * as v from 'valibot';

import { artifactKey, fromStoredMetadata, HEX_HASH, readTeam } from '../../../utils/artifacts';
import { readJsonBody } from '../../../utils/http';
import { useStorage } from '../../../utils/storage';

const QueryRequest = v.object({
  hashes: v.array(v.string()),
}) satisfies v.GenericSchema<unknown, components['schemas']['ArtifactQueryRequest']>;

type ArtifactHit = components['schemas']['ArtifactInfo'] & { sha?: string; dirtyHash?: string };

export default defineHandler(async (event) => {
  const { hashes } = await readJsonBody(event, QueryRequest);
  const team = readTeam(event);
  const lookups = hashes.filter((hash) => HEX_HASH.test(hash));
  const { results, errors = [] } = await useStorage(event).head(
    lookups.map((hash) => artifactKey(team, hash)),
  );
  const failure = errors.find(({ error }) => error.code !== 'NotFound');
  if (failure) {
    throw failure.error;
  }

  const hits = new Map(
    results.map((info): [string, ArtifactHit] => {
      const stored = fromStoredMetadata(info.metadata);
      return [
        info.key,
        {
          size: info.size,
          taskDurationMs: Number(stored['x-artifact-duration'] ?? 0),
          tag: stored['x-artifact-tag'],
          sha: stored['x-artifact-sha'],
          dirtyHash: stored['x-artifact-dirty-hash'],
        },
      ];
    }),
  );
  return Object.fromEntries(
    hashes.map((hash) => [hash, hits.get(artifactKey(team, hash)) ?? null]),
  ) satisfies components['schemas']['ArtifactQueryResponse'];
});
