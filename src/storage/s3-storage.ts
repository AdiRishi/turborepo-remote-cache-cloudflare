import {
  ListFilterOptions,
  ListResult,
  ListResultWithMetadata,
  Metadata,
  StorageInterface,
  WritableValue,
} from './interface';
import { S3mini } from 's3mini';

const DEFAULT_S3_REGION = 'us-east-1';
const RESERVED_METADATA_HEADER = 'x-amz-meta-turbo-custom-metadata';
const NOOP_DELIMITER = '__turbo_remote_cache_noop_delimiter__';

type S3ListObject = {
  Key?: string;
  LastModified?: string | Date;
};

type S3PagedListResult = {
  objects: S3ListObject[] | null;
  nextContinuationToken?: string;
};

type S3Client = {
  listObjectsPaged: (
    delimiter?: string,
    prefix?: string,
    maxKeys?: number,
    nextContinuationToken?: string
  ) => Promise<S3PagedListResult | undefined | null>;
  getObjectResponse: (key: string) => Promise<Response | null>;
  putObject: (
    key: string,
    data: WritableValue,
    fileType?: string,
    ssecHeaders?: undefined,
    additionalHeaders?: Record<`x-amz-${string}`, string>
  ) => Promise<Response>;
  deleteObject: (key: string) => Promise<boolean>;
  deleteObjects: (keys: string[]) => Promise<boolean[]>;
};

export type S3StorageConfig = {
  endpoint?: string;
  region?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
};

export class S3Storage implements StorageInterface {
  private S3: S3Client;

  constructor(config: S3StorageConfig, s3Client?: S3Client) {
    if (!config.endpoint) {
      throw new Error('Incomplete S3 storage configuration: missing S3_ENDPOINT.');
    }
    if (!config.accessKeyId) {
      throw new Error('Incomplete S3 storage configuration: missing AWS_ACCESS_KEY_ID.');
    }
    if (!config.secretAccessKey) {
      throw new Error('Incomplete S3 storage configuration: missing AWS_SECRET_ACCESS_KEY.');
    }
    try {
      new URL(config.endpoint);
    } catch {
      throw new Error(
        `Incomplete S3 storage configuration: invalid S3_ENDPOINT "${config.endpoint}".`
      );
    }

    this.S3 =
      s3Client ??
      new S3mini({
        endpoint: config.endpoint,
        region: config.region ?? DEFAULT_S3_REGION,
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      });
  }

  async listWithMetadata(options?: ListFilterOptions): Promise<ListResultWithMetadata> {
    const result = await this.S3.listObjectsPaged(
      NOOP_DELIMITER,
      options?.prefix ?? '',
      options?.limit,
      options?.cursor
    );
    return {
      keys: this.getObjectsFromListResult(result).map((object) => ({
        key: object.Key!,
        metadata: {
          staticMetadata: {
            createdAt: this.getDateFromListObject(object),
          },
          customMetadata: {},
        },
      })),
      cursor: result?.nextContinuationToken,
      truncated: result?.nextContinuationToken !== undefined,
    };
  }

  async list(options?: ListFilterOptions): Promise<ListResult> {
    const result = await this.S3.listObjectsPaged(
      NOOP_DELIMITER,
      options?.prefix ?? '',
      options?.limit,
      options?.cursor
    );
    return {
      keys: this.getObjectsFromListResult(result).map((object) => object.Key!),
      cursor: result?.nextContinuationToken,
      truncated: result?.nextContinuationToken !== undefined,
    };
  }

  async readWithMetadata(
    key: string
  ): Promise<{ data: ReadableStream | undefined; metadata: Metadata | undefined }> {
    const response = await this.S3.getObjectResponse(key);
    if (!response?.body) {
      return { data: undefined, metadata: undefined };
    }

    return {
      data: response.body,
      metadata: {
        staticMetadata: {
          createdAt: this.getDateFromResponseHeaders(response.headers),
        },
        customMetadata: this.getCustomMetadataFromHeaders(response.headers),
      },
    };
  }

  async read(key: string): Promise<ReadableStream | undefined> {
    const response = await this.S3.getObjectResponse(key);
    return response?.body ?? undefined;
  }

  async write(key: string, data: WritableValue, metadata?: Record<string, string>): Promise<void> {
    const additionalHeaders: Record<`x-amz-${string}`, string> = {};
    if (metadata && Object.keys(metadata).length > 0) {
      additionalHeaders[RESERVED_METADATA_HEADER] = JSON.stringify(metadata);
    }
    await this.S3.putObject(key, data, 'application/octet-stream', undefined, additionalHeaders);
  }

  async delete(key: string | string[]): Promise<void> {
    if (Array.isArray(key)) {
      if (key.length === 0) return;
      if (key.length === 1) {
        await this.S3.deleteObject(key[0]);
        return;
      }
      await this.S3.deleteObjects(key);
      return;
    }
    await this.S3.deleteObject(key);
  }

  private getObjectsFromListResult(result: S3PagedListResult | undefined | null): S3ListObject[] {
    if (!result?.objects) return [];
    return result.objects.filter((object) => typeof object.Key === 'string');
  }

  private getDateFromListObject(object: S3ListObject): Date {
    const dateValue = object.LastModified;
    if (dateValue instanceof Date) return dateValue;
    const parsedDate = dateValue ? new Date(dateValue) : undefined;
    if (!parsedDate || Number.isNaN(parsedDate.getTime())) {
      return new Date();
    }
    return parsedDate;
  }

  private getDateFromResponseHeaders(headers: Headers): Date {
    const headerValue = headers.get('last-modified');
    const parsedDate = headerValue ? new Date(headerValue) : undefined;
    if (!parsedDate || Number.isNaN(parsedDate.getTime())) {
      return new Date();
    }
    return parsedDate;
  }

  private getCustomMetadataFromHeaders(headers: Headers): Record<string, string> {
    const serializedMetadata = headers.get(RESERVED_METADATA_HEADER);
    if (serializedMetadata) {
      try {
        const parsedMetadata = JSON.parse(serializedMetadata) as unknown;
        if (typeof parsedMetadata === 'object' && parsedMetadata !== null) {
          return Object.fromEntries(
            Object.entries(parsedMetadata).map(([metaKey, metaValue]) => [
              metaKey,
              String(metaValue),
            ])
          );
        }
      } catch {
        // Fallback to parsing generic x-amz-meta-* headers below.
      }
    }

    const customMetadata: Record<string, string> = {};
    headers.forEach((headerValue, headerKey) => {
      const normalizedHeader = headerKey.toLowerCase();
      if (!normalizedHeader.startsWith('x-amz-meta-')) return;
      if (normalizedHeader === RESERVED_METADATA_HEADER) return;

      const metadataKey = normalizedHeader.substring('x-amz-meta-'.length);
      if (!metadataKey) return;
      customMetadata[metadataKey] = headerValue;
    });
    return customMetadata;
  }
}
