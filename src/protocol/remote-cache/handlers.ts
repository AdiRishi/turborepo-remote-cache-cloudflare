import { FilesError, type StoredFile } from 'files-sdk';

import { prepareUploadBody, UploadBodyLengthError } from '../../storage/upload-body';
import {
  DEFAULT_TEAM_ID,
  RemoteCacheProtocolError,
  type ArtifactMetadata,
  type RemoteCacheHandlers,
} from './contract';

const ARTIFACT_METADATA_KEYS = {
  dirtyHash: 'artifactdirtyhash',
  duration: 'artifactduration',
  sha: 'artifactsha',
  tag: 'artifacttag',
} as const;

const LEGACY_ARTIFACT_METADATA_KEYS = {
  dirtyHash: 'artifactDirtyHash',
  duration: 'artifactDuration',
  sha: 'artifactSha',
  tag: 'artifactTag',
} as const;

const selectTeam = (query: { slug?: string; teamId?: string }): string =>
  query.teamId ?? query.slug ?? DEFAULT_TEAM_ID;

const artifactKey = (team: string, hash: string): string => `${team}/${hash}`;

const metadataValue = (
  metadata: Record<string, string> | undefined,
  key: keyof typeof LEGACY_ARTIFACT_METADATA_KEYS,
): string | undefined =>
  metadata?.[ARTIFACT_METADATA_KEYS[key]] ?? metadata?.[LEGACY_ARTIFACT_METADATA_KEYS[key]];

const parseDuration = (value: string | undefined): number | undefined => {
  if (value === undefined || !/^\d+$/.test(value)) return undefined;
  const duration = Number(value);
  return Number.isFinite(duration) && Number.isInteger(duration) ? duration : undefined;
};

const artifactMetadata = (file: Pick<StoredFile, 'metadata'>): ArtifactMetadata => ({
  dirtyHash: metadataValue(file.metadata, 'dirtyHash'),
  duration: parseDuration(metadataValue(file.metadata, 'duration')),
  sha: metadataValue(file.metadata, 'sha'),
  tag: metadataValue(file.metadata, 'tag'),
});

const isNotFound = (error: unknown): boolean =>
  error instanceof FilesError && error.code === 'NotFound';

const getArtifactStatus: RemoteCacheHandlers['getArtifactStatus'] = () => ({
  status: 'enabled',
});

const artifactExists: RemoteCacheHandlers['artifactExists'] = async (input, context) => {
  try {
    const file = await context.files.head(artifactKey(selectTeam(input.query), input.path.hash));
    return {
      metadata: artifactMetadata(file),
      size: file.size,
    };
  } catch (error: unknown) {
    if (isNotFound(error)) return null;
    throw error;
  }
};

const downloadArtifact: RemoteCacheHandlers['downloadArtifact'] = async (input, context) => {
  try {
    const file = await context.files.download(
      artifactKey(selectTeam(input.query), input.path.hash),
      { as: 'stream' },
    );
    return {
      body: file.stream(),
      metadata: artifactMetadata(file),
      size: file.size,
    };
  } catch (error: unknown) {
    if (isNotFound(error)) return null;
    throw error;
  }
};

const uploadArtifact: RemoteCacheHandlers['uploadArtifact'] = async (input, context) => {
  const team = selectTeam(input.query);
  const metadataValues = {
    dirtyHash: input.headers['x-artifact-dirty-hash'],
    duration: input.headers['x-artifact-duration'],
    sha: input.headers['x-artifact-sha'],
    tag: input.headers['x-artifact-tag'],
  };
  const needsMetadata = Object.values(metadataValues).some((value) => value !== undefined);

  if (needsMetadata && !context.files.capabilities.metadata) {
    throw new RemoteCacheProtocolError(
      400,
      'unsupported_metadata',
      'The configured storage adapter does not support artifact metadata',
    );
  }

  const metadata = needsMetadata
    ? {
        ...(metadataValues.dirtyHash === undefined
          ? {}
          : { [ARTIFACT_METADATA_KEYS.dirtyHash]: metadataValues.dirtyHash }),
        ...(metadataValues.duration === undefined
          ? {}
          : { [ARTIFACT_METADATA_KEYS.duration]: String(metadataValues.duration) }),
        ...(metadataValues.sha === undefined
          ? {}
          : { [ARTIFACT_METADATA_KEYS.sha]: metadataValues.sha }),
        ...(metadataValues.tag === undefined
          ? {}
          : { [ARTIFACT_METADATA_KEYS.tag]: metadataValues.tag }),
      }
    : undefined;
  let body;
  try {
    body = await prepareUploadBody(
      input.body,
      input.headers['Content-Length'],
      context.files.adapter.name,
    );
  } catch (error: unknown) {
    if (error instanceof UploadBodyLengthError) {
      throw new RemoteCacheProtocolError(400, 'bad_request', error.message);
    }
    throw error;
  }
  const upload = context.files.upload(artifactKey(team, input.path.hash), body.body, {
    contentType: 'application/octet-stream',
    metadata,
  });
  await (body.completion ? Promise.all([upload, body.completion]) : upload);

  const uploadUrl = new URL(context.request.url);
  uploadUrl.search = '';
  uploadUrl.searchParams.set('teamId', team);
  return { urls: [uploadUrl.toString()] };
};

const queryArtifacts: RemoteCacheHandlers['queryArtifacts'] = async (input, context) => {
  const team = selectTeam(input.query);
  const keys = input.body.hashes.map((hash) => artifactKey(team, hash));
  if (keys.length === 0) return {};

  const result = await context.files.head(keys);
  const filesByKey = new Map(result.files.map((file) => [file.key, file]));
  const errorsByKey = new Map(result.errors?.map(({ error, key }) => [key, error]) ?? []);

  return Object.fromEntries(
    input.body.hashes.map((hash) => {
      const key = artifactKey(team, hash);
      const file = filesByKey.get(key);
      if (file) {
        const metadata = artifactMetadata(file);
        return [
          hash,
          {
            size: file.size,
            ...(metadata.tag === undefined ? {} : { tag: metadata.tag }),
            taskDurationMs: metadata.duration ?? 0,
          },
        ];
      }

      const error = errorsByKey.get(key);
      if (!error || isNotFound(error)) return [hash, null];
      return [hash, { error: { message: error.message } }];
    }),
  );
};

const recordCacheEvents: RemoteCacheHandlers['recordCacheEvents'] = () => undefined;

export const remoteCacheHandlers = {
  artifactExists,
  downloadArtifact,
  getArtifactStatus,
  queryArtifacts,
  recordCacheEvents,
  uploadArtifact,
} satisfies RemoteCacheHandlers;
