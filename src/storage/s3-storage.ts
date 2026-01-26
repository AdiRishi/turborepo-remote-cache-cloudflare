import { StorageInterface, ListFilterOptions, Metadata, WritableValue } from './interface';

/**
 * S3 client interface - matches s3mini's API
 */
export interface S3Client {
  putAnyObject(
    key: string,
    data: string | ArrayBuffer | ReadableStream | Blob | File,
    contentType?: string,
    ssecHeaders?: {
      'x-amz-server-side-encryption-customer-algorithm': string;
      'x-amz-server-side-encryption-customer-key': string;
      'x-amz-server-side-encryption-customer-key-md5': string;
    },
    // eslint-disable-next-line @typescript-eslint/consistent-indexed-object-style
    additionalHeaders?: { [k: `x-amz-${string}`]: string }
  ): Promise<Response | { ok: boolean; status: number; headers: Map<string, string> }>;
  getObjectResponse(key: string): Promise<Response | null>;
  listObjectsPaged(
    delimiter?: string,
    prefix?: string,
    maxKeys?: number,
    continuationToken?: string
  ): Promise<
    | {
        objects: { Key: string; LastModified: Date }[] | null;
        nextContinuationToken?: string;
      }
    | null
    | undefined
  >;
  deleteObject(key: string): Promise<boolean>;
  deleteObjects(keys: string[]): Promise<boolean[]>;
}

const METADATA_CREATED_AT_HEADER = 'x-amz-meta-createdat';
const METADATA_CUSTOM_HEADER = 'x-amz-meta-custom';

export class S3Storage implements StorageInterface {
  private s3Client: S3Client;

  constructor(s3Client: S3Client) {
    this.s3Client = s3Client;
  }

  async listWithMetadata(options?: ListFilterOptions) {
    const result = await this.s3Client.listObjectsPaged(
      undefined, // delimiter
      options?.prefix,
      options?.limit,
      options?.cursor
    );

    const objects = result?.objects ?? [];

    return {
      keys: objects.map((obj) => ({
        key: obj.Key,
        metadata: {
          staticMetadata: {
            // Use LastModified as createdAt - acceptable for cache expiry since objects aren't modified
            createdAt: obj.LastModified,
          },
          customMetadata: {},
        } as Metadata,
      })),
      cursor: result?.nextContinuationToken,
      truncated: !!result?.nextContinuationToken,
    };
  }

  async list(options?: ListFilterOptions) {
    const result = await this.s3Client.listObjectsPaged(
      undefined, // delimiter
      options?.prefix,
      options?.limit,
      options?.cursor
    );

    const objects = result?.objects ?? [];

    return {
      keys: objects.map((obj) => obj.Key),
      cursor: result?.nextContinuationToken,
      truncated: !!result?.nextContinuationToken,
    };
  }

  async readWithMetadata(key: string) {
    const response = await this.s3Client.getObjectResponse(key);
    if (!response?.ok) {
      return { data: undefined, metadata: undefined };
    }

    const metadata = this.extractMetadataFromHeaders(response.headers);
    return { data: response.body ?? undefined, metadata };
  }

  async read(key: string) {
    const response = await this.s3Client.getObjectResponse(key);
    if (!response?.ok) {
      return undefined;
    }
    return response.body ?? undefined;
  }

  async write(key: string, data: WritableValue, metadata?: Record<string, string>) {
    const additionalHeaders: Record<string, string> = {
      [METADATA_CREATED_AT_HEADER]: new Date().toISOString(),
    };

    if (metadata && Object.keys(metadata).length > 0) {
      additionalHeaders[METADATA_CUSTOM_HEADER] = JSON.stringify(metadata);
    }

    await this.s3Client.putAnyObject(
      key,
      data,
      'application/octet-stream',
      undefined, // ssecHeaders
      additionalHeaders
    );
  }

  async delete(key: string | string[]) {
    if (Array.isArray(key)) {
      if (key.length === 0) return;
      await this.s3Client.deleteObjects(key);
    } else {
      await this.s3Client.deleteObject(key);
    }
  }

  private extractMetadataFromHeaders(headers: Headers): Metadata {
    const createdAtStr = headers.get(METADATA_CREATED_AT_HEADER);
    const customMetadataStr = headers.get(METADATA_CUSTOM_HEADER);

    let customMetadata: Record<string, string> = {};
    if (customMetadataStr) {
      try {
        customMetadata = JSON.parse(customMetadataStr) as Record<string, string>;
      } catch {
        // Ignore invalid JSON
      }
    }

    return {
      staticMetadata: {
        createdAt: createdAtStr ? new Date(createdAtStr) : new Date(),
      },
      customMetadata,
    };
  }
}
