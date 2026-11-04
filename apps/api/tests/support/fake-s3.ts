import type { IncomingHttpHeaders, IncomingMessage, ServerResponse } from 'node:http';

import { createServer } from 'node:http';
import { buffer } from 'node:stream/consumers';

interface StoredObject {
  body: Buffer;
  metadata: IncomingHttpHeaders;
  lastModified: Date;
}

const metadataOf = (headers: IncomingHttpHeaders) =>
  Object.fromEntries(Object.entries(headers).filter(([name]) => name.startsWith('x-amz-meta-')));

/**
 * An S3 endpoint that keeps objects in memory and answers path-style object PUT, GET, and HEAD.
 * It records each request with the credential scope of its SigV4 signature.
 */
export const startFakeS3 = async () => {
  const objects = new Map<string, StoredObject>();
  const requests: { method: string; path: string; credential: string | undefined }[] = [];

  const handle = async (incoming: IncomingMessage, outgoing: ServerResponse) => {
    const path = new URL(incoming.url ?? '/', 'http://localhost').pathname;
    const method = incoming.method ?? 'GET';
    const credential = /Credential=(?<scope>[^,]+)/u.exec(incoming.headers.authorization ?? '')
      ?.groups?.scope;
    requests.push({ method, path, credential });

    if (method === 'PUT') {
      objects.set(path, {
        body: await buffer(incoming),
        metadata: metadataOf(incoming.headers),
        lastModified: new Date(),
      });
      outgoing.writeHead(200, { etag: '"etag"' }).end();
      return;
    }
    const object = objects.get(path);
    if (!object) {
      outgoing
        .writeHead(404, { 'content-type': 'application/xml' })
        .end(method === 'HEAD' ? undefined : '<Error><Code>NoSuchKey</Code></Error>');
      return;
    }
    outgoing.writeHead(200, {
      ...object.metadata,
      'content-length': object.body.byteLength,
      'content-type': 'application/octet-stream',
      'last-modified': object.lastModified.toUTCString(),
      etag: '"etag"',
    });
    outgoing.end(method === 'HEAD' ? undefined : object.body);
  };

  const server = createServer((incoming, outgoing) => {
    handle(incoming, outgoing).catch((error: unknown) => {
      outgoing.destroy(error instanceof Error ? error : undefined);
    });
  });

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  if (address === null || typeof address === 'string') {
    throw new Error('The fake S3 server is not listening on a TCP port');
  }

  return {
    url: `http://127.0.0.1:${address.port}`,
    objects,
    requests,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
          } else {
            resolve();
          }
        });
      }),
  };
};
