import {
  ListFilterOptions,
  ListResult,
  ListResultWithMetadata,
  Metadata,
  StorageInterface,
  WritableValue,
} from './interface';

import { AwsClient } from 'aws4fetch';

type S3StorageOptions = {
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  bucket: string;
  endpoint?: string; // Optional custom endpoint, e.g. for tests or S3-compatible stores
  maxRetries?: number;
};

/**
 * Amazon S3 implementation of the StorageInterface using aws4fetch for SigV4 signing.
 */
export class S3Storage implements StorageInterface {
  private aws: AwsClient;
  private region: string;
  private bucket: string;
  private endpoint?: string;
  private maxRetries: number;

  constructor(options: S3StorageOptions) {
    this.aws = new AwsClient({
      accessKeyId: options.accessKeyId,
      secretAccessKey: options.secretAccessKey,
      service: 's3',
      region: options.region,
      // We handle retries ourselves
      retries: 0,
    });
    this.region = options.region;
    this.bucket = options.bucket;
    this.endpoint = options.endpoint?.replace(/\/$/, '');
    this.maxRetries = options.maxRetries ?? 3;
  }

  async listWithMetadata(options?: ListFilterOptions): Promise<ListResultWithMetadata> {
    const { keys, cursor, truncated, lastModifiedByKey } = await this.listInternal(options);

    // Fetch custom metadata via HEAD for each key (S3 ListObjectsV2 does not return it)
    const keyMetas = await Promise.all(
      keys.map(async (key) => {
        try {
          const res = await this.requestWithRetry('HEAD', this.objectUrl(key));
          if (res.status === 404) {
            return { key, metadata: undefined as Metadata | undefined };
          }
          const createdAt = lastModifiedByKey.get(key) ?? this.parseLastModifiedHeader(res.headers);
          const customMetadata = this.extractCustomMetadata(res.headers);
          return {
            key,
            metadata: createdAt
              ? { staticMetadata: { createdAt }, customMetadata }
              : undefined,
          };
        } catch {
          return { key, metadata: undefined as Metadata | undefined };
        }
      })
    );

    return { keys: keyMetas, cursor, truncated };
  }

  async list(options?: ListFilterOptions): Promise<ListResult> {
    const { keys, cursor, truncated } = await this.listInternal(options);
    return { keys, cursor, truncated };
  }

  async readWithMetadata(
    key: string
  ): Promise<{ data: ReadableStream | undefined; metadata: Metadata | undefined }> {
    const res = await this.requestWithRetry('GET', this.objectUrl(key));
    if (res.status === 404) return { data: undefined, metadata: undefined };
    if (!res.ok) throw new Error(`S3 GET failed with status ${res.status}`);

    const createdAt = this.parseLastModifiedHeader(res.headers);
    const customMetadata = this.extractCustomMetadata(res.headers);

    return {
      data: res.body ?? undefined,
      metadata: createdAt ? { staticMetadata: { createdAt }, customMetadata } : undefined,
    };
  }

  async read(key: string): Promise<ReadableStream | undefined> {
    const res = await this.requestWithRetry('GET', this.objectUrl(key));
    if (res.status === 404) return undefined;
    if (!res.ok) throw new Error(`S3 GET failed with status ${res.status}`);
    return res.body ?? undefined;
  }

  async write(key: string, data: WritableValue, metadata?: Record<string, string>): Promise<void> {
    const headers = new Headers({ 'Content-Type': 'application/octet-stream' });
    if (metadata) {
      for (const [metaKey, metaValue] of Object.entries(metadata)) {
        // S3 stores custom metadata as lowercase header names; write as lower for consistency
        headers.set('x-amz-meta-' + metaKey.toLowerCase(), metaValue);
      }
    }
    const res = await this.requestWithRetry('PUT', this.objectUrl(key), { body: data, headers });
    if (!res.ok) throw new Error(`S3 PUT failed with status ${res.status}`);
  }

  async delete(key: string | string[]): Promise<void> {
    if (Array.isArray(key)) {
      await Promise.allSettled(key.map((k) => this.requestWithRetry('DELETE', this.objectUrl(k))));
      return;
    }
    const res = await this.requestWithRetry('DELETE', this.objectUrl(key));
    if (!(res.ok || res.status === 404)) {
      throw new Error(`S3 DELETE failed with status ${res.status}`);
    }
  }

  // ------------------
  // Internal helpers
  // ------------------

  private async listInternal(options?: ListFilterOptions): Promise<{
    keys: string[];
    cursor?: string;
    truncated: boolean;
    lastModifiedByKey: Map<string, Date>;
  }> {
    const qs = new URLSearchParams();
    qs.set('list-type', '2');
    if (options?.limit) qs.set('max-keys', String(options.limit));
    if (options?.prefix) qs.set('prefix', options.prefix);
    if (options?.cursor) qs.set('continuation-token', options.cursor);

    const url = this.bucketBaseUrl() + '/?' + qs.toString();
    const res = await this.requestWithRetry('GET', url);
    if (!res.ok) throw new Error(`S3 ListObjectsV2 failed with status ${res.status}`);
    const xml = await res.text();
    const parsed = this.parseListObjectsV2(xml);
    return parsed;
  }

  private objectUrl(key: string): string {
    const encoded = key
      .split('/')
      .map((s) => encodeURIComponent(s))
      .join('/');
    if (this.endpoint) return `${this.endpoint}/${this.bucket}/${encoded}`;
    return `https://${this.bucket}.s3.${this.region}.amazonaws.com/${encoded}`;
  }

  private bucketBaseUrl(): string {
    if (this.endpoint) return `${this.endpoint}/${this.bucket}`;
    return `https://${this.bucket}.s3.${this.region}.amazonaws.com`;
  }

  private async requestWithRetry(
    method: string,
    url: string,
    init?: { headers?: Headers; body?: BodyInit | null }
  ): Promise<Response> {
    let attempt = 0;
    let lastError: unknown;
    while (attempt <= this.maxRetries) {
      try {
        const res = await this.aws.fetch(url, { method, headers: init?.headers, body: init?.body });
        if (res.status >= 500 || res.status === 429) {
          throw new Error(`Retryable status: ${res.status}`);
        }
        return res;
      } catch (err) {
        lastError = err;
        if (attempt === this.maxRetries) break;
        await this.backoff(attempt);
        attempt += 1;
      }
    }
    throw lastError instanceof Error ? lastError : new Error(String(lastError));
  }

  private async backoff(attempt: number): Promise<void> {
    const delayMs = Math.min(1000 * Math.pow(2, attempt), 4000);
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }

  private parseLastModifiedHeader(headers: Headers): Date | undefined {
    const lastModified = headers.get('Last-Modified') || headers.get('last-modified');
    return lastModified ? new Date(lastModified) : undefined;
  }

  private extractCustomMetadata(headers: Headers): Record<string, string> {
    const meta: Record<string, string> = {};
    headers.forEach((value, key) => {
      if (key.toLowerCase().startsWith('x-amz-meta-')) {
        const metaKey = key.substring('x-amz-meta-'.length);
        meta[metaKey] = value;
      }
    });
    // Normalize commonly used key casing for cross-backend compatibility
    if (meta['artifacttag'] && !meta['artifactTag']) {
      meta['artifactTag'] = meta['artifacttag'];
      delete meta['artifacttag'];
    }
    return meta;
  }

  private parseListObjectsV2(xml: string): {
    keys: string[];
    cursor?: string;
    truncated: boolean;
    lastModifiedByKey: Map<string, Date>;
  } {
    // Use DOMParser when available; fallback to a simple regex-based parser
    try {
      const doc = new DOMParser().parseFromString(xml, 'application/xml');
      const contents = Array.from(doc.getElementsByTagName('Contents'));
      const keys: string[] = [];
      const lastModifiedByKey = new Map<string, Date>();
      for (const c of contents) {
        const key = c.getElementsByTagName('Key')[0]?.textContent ?? '';
        if (!key) continue;
        keys.push(key);
        const lm = c.getElementsByTagName('LastModified')[0]?.textContent ?? undefined;
        if (lm) lastModifiedByKey.set(key, new Date(lm));
      }
      const isTruncated =
        (doc.getElementsByTagName('IsTruncated')[0]?.textContent ?? 'false') === 'true';
      const nextToken = doc.getElementsByTagName('NextContinuationToken')[0]?.textContent ?? undefined;
      return { keys, cursor: nextToken, truncated: isTruncated, lastModifiedByKey };
    } catch {
      // Extremely naive fallback
      const keyMatches = Array.from(xml.matchAll(/<Key>(.*?)<\/Key>/g)).map((m) => m[1]);
      const lmMatches = Array.from(xml.matchAll(/<LastModified>(.*?)<\/LastModified>/g)).map(
        (m) => m[1]
      );
      const lastModifiedByKey = new Map<string, Date>();
      keyMatches.forEach((k, i) => {
        const lm = lmMatches[i];
        if (lm) lastModifiedByKey.set(k, new Date(lm));
      });
      const isTruncated = /<IsTruncated>true<\/IsTruncated>/.test(xml);
      const nextTokenMatch = xml.match(/<NextContinuationToken>(.*?)<\/NextContinuationToken>/);
      const nextToken = nextTokenMatch ? nextTokenMatch[1] : undefined;
      return { keys: keyMatches, cursor: nextToken, truncated: isTruncated, lastModifiedByKey };
    }
  }
}

