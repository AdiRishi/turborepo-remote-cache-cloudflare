import type { FileInfo } from 'files-sdk';
import type { H3Event } from 'nitro';

import * as v from 'valibot';

import type { operations } from '../../openapi/turborepo';

import { parseInput } from './http';

const DEFAULT_TEAM_ID = 'team_default_team';

export const HEX_HASH = /^[a-f0-9]+$/iu;

const decimalDigits = v.pipe(v.string(), v.digits());

const TeamName = v.pipe(
  v.string(),
  // Control characters break key listings on S3-compatible stores, whose XML cannot carry them.
  v.regex(/^\P{Cc}*$/u, 'Team identifiers must not contain control characters'),
);

const TeamQuery = v.pipe(
  v.object({
    teamId: v.optional(TeamName),
    slug: v.optional(TeamName),
  }) satisfies v.GenericSchema<
    unknown,
    NonNullable<operations['downloadArtifact']['parameters']['query']>
  >,
  v.transform(({ teamId, slug }) => teamId ?? slug ?? DEFAULT_TEAM_ID),
);

const ArtifactParams = v.object({
  hash: v.pipe(v.string(), v.regex(HEX_HASH, 'The artifact hash must be hexadecimal')),
}) satisfies v.GenericSchema<unknown, operations['downloadArtifact']['parameters']['path']>;

export const ClientHeaders = v.object({
  'x-artifact-client-ci': v.optional(v.pipe(v.string(), v.maxLength(50))),
  'x-artifact-client-interactive': v.optional(v.picklist(['0', '1'])),
});

export const UploadHeaders = v.object({
  ...ClientHeaders.entries,
  'content-length': decimalDigits,
  'x-artifact-duration': v.optional(decimalDigits),
  'x-artifact-tag': v.optional(v.pipe(v.string(), v.maxLength(600))),
  'x-artifact-sha': v.optional(v.string()),
  'x-artifact-dirty-hash': v.optional(v.string()),
});

export const readTeam = (event: H3Event) =>
  parseInput(TeamQuery, Object.fromEntries(event.url.searchParams));

export const artifactKey = (team: string, hash: string) => `${team}/${hash}`;

export const readArtifact = (event: H3Event) => {
  const { hash } = parseInput(ArtifactParams, event.context.params);
  const team = readTeam(event);
  return { team, key: artifactKey(team, hash) };
};

const storedHeaders = [
  ['x-artifact-duration', 'artifactDuration'],
  ['x-artifact-tag', 'artifactTag'],
  ['x-artifact-sha', 'artifactSha'],
  ['x-artifact-dirty-hash', 'artifactDirtyHash'],
] as const;

type StoredHeader = (typeof storedHeaders)[number][0];

export const toStoredMetadata = (
  headers: Partial<Record<StoredHeader, string>>,
): Record<string, string> =>
  Object.fromEntries(
    storedHeaders.flatMap(([header, key]) => {
      const value = headers[header];
      return value === undefined ? [] : [[key, value]];
    }),
  );

export const artifactResponseHeaders = (info: FileInfo) => ({
  'content-type': 'application/octet-stream',
  'content-length': String(info.size),
  ...fromStoredMetadata(info.metadata),
});

export const fromStoredMetadata = (
  metadata: Record<string, string> = {},
): Partial<Record<StoredHeader, string>> => {
  // S3-compatible stores return user metadata keys in lowercase.
  const stored = new Map(
    Object.entries(metadata).map(([key, value]) => [key.toLowerCase(), value]),
  );
  return Object.fromEntries(
    storedHeaders.flatMap(([header, key]) => {
      const value = stored.get(key.toLowerCase());
      return value === undefined ? [] : [[header, value]];
    }),
  );
};
