import { ListFilterOptions, Metadata, StorageInterface, WritableValue } from './interface';
import { S3mini } from 's3mini';

const METADATA_CREATED_AT_HEADER = 'x-amz-meta-createdat';
const METADATA_CUSTOM_HEADER = 'x-amz-meta-custom';

export class S3Storage implements StorageInterface {
  private s3Client: S3mini;

  constructor(s3Client: S3mini) {
    this.s3Client = s3Client;
  }

  async listWithMetadata(options?: ListFilterOptions) {
    const result = await this.listObjects(options);

    return {
      keys: result.objects.map((obj) => ({
        key: obj.Key,
        // Use LastModified as createdAt - acceptable for cache expiry since objects aren't modified
        metadata: this.createMetadataFromDate(obj.LastModified),
      })),
      cursor: result.cursor,
      truncated: result.truncated,
    };
  }

  async list(options?: ListFilterOptions) {
    const result = await this.listObjects(options);

    return {
      keys: result.objects.map((obj) => obj.Key),
      cursor: result.cursor,
      truncated: result.truncated,
    };
  }

  private async listObjects(options?: ListFilterOptions) {
    const result = await this.s3Client.listObjectsPaged(
      undefined, // delimiter
      options?.prefix,
      options?.limit,
      options?.cursor
    );

    return {
      objects: result?.objects ?? [],
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
    const hasCustomMetadata = metadata && Object.keys(metadata).length > 0;
    const additionalHeaders: Record<string, string> = {
      [METADATA_CREATED_AT_HEADER]: new Date().toISOString(),
      ...(hasCustomMetadata && { [METADATA_CUSTOM_HEADER]: JSON.stringify(metadata) }),
    };

    await this.s3Client.putAnyObject(
      key,
      data,
      'application/octet-stream',
      undefined,
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
    const createdAt = createdAtStr ? new Date(createdAtStr) : new Date();

    return this.createMetadataFromDate(createdAt, this.parseCustomMetadata(customMetadataStr));
  }

  private parseCustomMetadata(json: string | null): Record<string, string> {
    if (!json) return {};
    try {
      return JSON.parse(json) as Record<string, string>;
    } catch {
      return {};
    }
  }

  private createMetadataFromDate(
    date: Date,
    customMetadata: Record<string, string> = {}
  ): Metadata {
    return {
      staticMetadata: { createdAt: date },
      customMetadata,
    };
  }
}
