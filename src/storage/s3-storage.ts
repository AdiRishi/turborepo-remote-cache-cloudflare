import { StorageInterface, ListFilterOptions, Metadata, WritableValue } from './interface';
import { AwsClient } from 'aws4fetch';

export class S3Storage implements StorageInterface {
  private s3Client: AwsClient;
  private bucketName: string;
  private region: string;

  constructor(
    accessKeyId: string,
    secretAccessKey: string,
    bucketName: string,
    region = 'us-east-1'
  ) {
    this.s3Client = new AwsClient({
      accessKeyId,
      secretAccessKey,
      region,
    });
    this.bucketName = bucketName;
    this.region = region;
  }

  async listWithMetadata(options?: ListFilterOptions) {
    const params = new URLSearchParams();
    if (options?.limit) {
      params.set('max-keys', options.limit.toString());
    }
    if (options?.cursor) {
      params.set('continuation-token', options.cursor);
    }
    if (options?.prefix) {
      params.set('prefix', options.prefix);
    }

    const url = `https://${this.bucketName}.s3.${this.region}.amazonaws.com/?list-type=2&${params.toString()}`;
    const response = await this.s3Client.fetch(url, { method: 'GET' });

    if (!response.ok) {
      throw new Error(`S3 list failed: ${response.status} ${response.statusText}`);
    }

    const xmlText = await response.text();
    const result = this.parseListObjectsV2Response(xmlText);

    return {
      keys: result.contents.map((object) => ({
        key: object.key,
        metadata: this.transformMetadata(object),
      })),
      cursor: result.nextContinuationToken,
      truncated: result.isTruncated,
    };
  }

  async list(options?: ListFilterOptions) {
    const result = await this.listWithMetadata(options);
    return {
      keys: result.keys.map((item) => item.key),
      cursor: result.cursor,
      truncated: result.truncated,
    };
  }

  async readWithMetadata(key: string) {
    const url = `https://${this.bucketName}.s3.${this.region}.amazonaws.com/${encodeURIComponent(key)}`;
    const response = await this.s3Client.fetch(url, { method: 'GET' });

    if (response.status === 404) {
      return { data: undefined, metadata: undefined };
    }

    if (!response.ok) {
      throw new Error(`S3 read failed: ${response.status} ${response.statusText}`);
    }

    const metadata = this.extractMetadataFromHeaders(response.headers);
    return { data: response.body ?? undefined, metadata };
  }

  async read(key: string) {
    const result = await this.readWithMetadata(key);
    return result.data;
  }

  async write(key: string, data: WritableValue, metadata?: Record<string, string>) {
    const url = `https://${this.bucketName}.s3.${this.region}.amazonaws.com/${encodeURIComponent(key)}`;

    const headers: Record<string, string> = {};
    if (metadata) {
      Object.entries(metadata).forEach(([k, v]) => {
        headers[`x-amz-meta-${k}`] = v;
      });
    }

    const response = await this.s3Client.fetch(url, {
      method: 'PUT',
      body: data,
      headers,
    });

    if (!response.ok) {
      throw new Error(`S3 write failed: ${response.status} ${response.statusText}`);
    }
  }

  async delete(key: string | string[]) {
    const keys = Array.isArray(key) ? key : [key];

    if (keys.length === 1) {
      // Single object delete
      const url = `https://${this.bucketName}.s3.${this.region}.amazonaws.com/${encodeURIComponent(keys[0])}`;
      const response = await this.s3Client.fetch(url, { method: 'DELETE' });

      if (!response.ok && response.status !== 404) {
        throw new Error(`S3 delete failed: ${response.status} ${response.statusText}`);
      }
    } else {
      // Multi-object delete
      const deleteObjects = keys.map((k) => ({ Key: k }));
      const xmlBody = this.buildDeleteObjectsXml(deleteObjects);

      const url = `https://${this.bucketName}.s3.${this.region}.amazonaws.com/?delete`;
      const response = await this.s3Client.fetch(url, {
        method: 'POST',
        body: xmlBody,
        headers: { 'Content-Type': 'application/xml' },
      });

      if (!response.ok) {
        throw new Error(`S3 multi-delete failed: ${response.status} ${response.statusText}`);
      }
    }
  }

  private transformMetadata(s3Object: S3Object): Metadata {
    return {
      staticMetadata: {
        createdAt: new Date(s3Object.lastModified),
      },
      customMetadata: s3Object.userMetadata ?? {},
    };
  }

  private extractMetadataFromHeaders(headers: Headers): Metadata {
    const customMetadata: Record<string, string> = {};

    // Extract custom metadata from x-amz-meta-* headers
    headers.forEach((value, key) => {
      if (key.startsWith('x-amz-meta-')) {
        const metaKey = key.replace('x-amz-meta-', '');
        customMetadata[metaKey] = value;
      }
    });

    return {
      staticMetadata: {
        createdAt: new Date(headers.get('last-modified') ?? Date.now()),
      },
      customMetadata,
    };
  }

  private parseListObjectsV2Response(xmlText: string): ListObjectsV2Result {
    const contents: S3Object[] = [];
    let isTruncated = false;
    let nextContinuationToken: string | undefined;

    // Simple regex-based XML parsing for S3 ListObjectsV2 response
    const contentsMatches = xmlText.match(/<Contents>([\s\S]*?)<\/Contents>/g);
    if (contentsMatches) {
      for (const contentMatch of contentsMatches) {
        const keyMatch = /<Key>([^<]*)<\/Key>/.exec(contentMatch);
        const lastModifiedMatch = /<LastModified>([^<]*)<\/LastModified>/.exec(contentMatch);

        if (keyMatch && lastModifiedMatch) {
          contents.push({
            key: keyMatch[1],
            lastModified: lastModifiedMatch[1],
            userMetadata: {}, // S3 ListObjectsV2 doesn't return metadata, would need separate HEAD request
          });
        }
      }
    }

    const isTruncatedMatch = /<IsTruncated>([^<]*)<\/IsTruncated>/.exec(xmlText);
    if (isTruncatedMatch) {
      isTruncated = isTruncatedMatch[1] === 'true';
    }

    const nextContinuationTokenMatch =
      /<NextContinuationToken>([^<]*)<\/NextContinuationToken>/.exec(xmlText);
    if (nextContinuationTokenMatch) {
      nextContinuationToken = nextContinuationTokenMatch[1];
    }

    return {
      contents,
      isTruncated,
      nextContinuationToken,
    };
  }

  private buildDeleteObjectsXml(deleteObjects: { Key: string }[]): string {
    const objectsXml = deleteObjects
      .map((obj) => `  <Object><Key>${obj.Key}</Key></Object>`)
      .join('\n');
    return `<?xml version="1.0" encoding="UTF-8"?>
<Delete>
${objectsXml}
</Delete>`;
  }
}

interface S3Object {
  key: string;
  lastModified: string;
  userMetadata: Record<string, string>;
}

interface ListObjectsV2Result {
  contents: S3Object[];
  isTruncated: boolean;
  nextContinuationToken?: string;
}
