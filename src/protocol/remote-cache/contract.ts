import type { Files } from 'files-sdk';

import type { WaitUntil } from '../../runtime/app-env';
import type { components, operations } from './generated';

export const DEFAULT_TEAM_ID = 'team_default_team';

export type RemoteCacheOperationId = keyof operations;

type OperationQuery<OperationId extends RemoteCacheOperationId> = NonNullable<
  operations[OperationId]['parameters']['query']
>;
type OperationHeaders<OperationId extends RemoteCacheOperationId> = NonNullable<
  operations[OperationId]['parameters']['header']
>;
type OperationPath<OperationId extends RemoteCacheOperationId> = NonNullable<
  operations[OperationId]['parameters']['path']
>;

export interface ArtifactMetadata {
  dirtyHash?: string;
  duration?: number;
  sha?: string;
  tag?: string;
}

export interface StoredArtifact {
  metadata: ArtifactMetadata;
  size: number;
}

export interface DownloadedArtifact extends StoredArtifact {
  body: operations['downloadArtifact']['responses'][200]['content']['application/octet-stream'];
}

export interface RemoteCacheHandlerContext {
  files: Files;
  request: Request;
  waitUntil: WaitUntil;
}

export interface RemoteCacheOperationInputs {
  artifactExists: {
    path: OperationPath<'artifactExists'>;
    query: OperationQuery<'artifactExists'>;
  };
  downloadArtifact: {
    headers: OperationHeaders<'downloadArtifact'>;
    path: OperationPath<'downloadArtifact'>;
    query: OperationQuery<'downloadArtifact'>;
  };
  getArtifactStatus: {
    query: OperationQuery<'getArtifactStatus'>;
  };
  queryArtifacts: {
    body: operations['queryArtifacts']['requestBody']['content']['application/json'];
    query: OperationQuery<'queryArtifacts'>;
  };
  recordCacheEvents: {
    body: operations['recordCacheEvents']['requestBody']['content']['application/json'];
    headers: OperationHeaders<'recordCacheEvents'>;
    query: OperationQuery<'recordCacheEvents'>;
  };
  uploadArtifact: {
    body: operations['uploadArtifact']['requestBody']['content']['application/octet-stream'];
    headers: OperationHeaders<'uploadArtifact'>;
    path: OperationPath<'uploadArtifact'>;
    query: OperationQuery<'uploadArtifact'>;
  };
}

export interface RemoteCacheOperationOutputs {
  artifactExists: StoredArtifact | null;
  downloadArtifact: DownloadedArtifact | null;
  getArtifactStatus: operations['getArtifactStatus']['responses'][200]['content']['application/json'];
  queryArtifacts: operations['queryArtifacts']['responses'][200]['content']['application/json'];
  recordCacheEvents: undefined;
  uploadArtifact: operations['uploadArtifact']['responses'][202]['content']['application/json'];
}

type MaybePromise<Value> = Promise<Value> | Value;

type RemoteCacheHandler<OperationId extends RemoteCacheOperationId> =
  OperationId extends keyof RemoteCacheOperationInputs & keyof RemoteCacheOperationOutputs
    ? (
        input: RemoteCacheOperationInputs[OperationId],
        context: RemoteCacheHandlerContext,
      ) => MaybePromise<RemoteCacheOperationOutputs[OperationId]>
    : never;

/**
 * Adding an operation to the pinned Turborepo contract makes this map require
 * a matching implementation before the project can typecheck.
 */
export type RemoteCacheHandlers = {
  [OperationId in RemoteCacheOperationId]: RemoteCacheHandler<OperationId>;
};

export type RemoteCacheErrorBody = components['schemas']['Error'];

export class RemoteCacheProtocolError extends Error {
  readonly code: string;
  readonly status: 400 | 404 | 500;

  constructor(status: 400 | 404 | 500, code: string, message: string) {
    super(message);
    this.name = 'RemoteCacheProtocolError';
    this.code = code;
    this.status = status;
  }
}
