import { Files } from 'files-sdk';
import { memory } from 'files-sdk/memory';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';

import { app } from '~/routes';
import { DEFAULT_TEAM_ID } from '~/routes/v8/artifacts';

import { createTestAppContext, withAuthorization, type TestAppContext } from '../../helpers/app';

const encodedLength = (value: string) => new TextEncoder().encode(value).byteLength;

const expectContractError = async (response: Response, status: number, code: string) => {
  expect(response.status).toBe(status);
  expect(response.headers.get('Content-Type')).toContain('application/json');
  expect(await response.json()).toEqual({
    code,
    message: expect.any(String),
  });
};

describe('v8 Artifacts API', () => {
  let artifactContent: string;
  let artifactDirtyHash: string;
  let artifactDuration: number;
  let artifactId: string;
  let artifactSha: string;
  let artifactTag: string;
  let context: TestAppContext;
  let missingArtifactId: string;
  let teamId: string;

  beforeEach(() => {
    context = createTestAppContext();
    artifactId = crypto.randomUUID().replaceAll('-', '');
    missingArtifactId = crypto.randomUUID().replaceAll('-', '');
    artifactTag = `tag-${crypto.randomUUID()}`;
    artifactSha = crypto.randomUUID().replaceAll('-', '');
    artifactDirtyHash = crypto.randomUUID().replaceAll('-', '');
    artifactDuration = 400;
    teamId = `team-${crypto.randomUUID()}`;
    artifactContent = '🎉😄😇';
  });

  afterEach(async () => {
    await context.waitForBackgroundWork();
  });

  const artifactUrl = (query?: string, hash?: string) => {
    const selectedHash = hash ?? artifactId;
    const selectedQuery = query === undefined ? `teamId=${teamId}` : query;
    return `http://localhost/v8/artifacts/${selectedHash}${selectedQuery ? `?${selectedQuery}` : ''}`;
  };

  const getArtifact = (query?: string, hash?: string) =>
    app.fetch(
      new Request(artifactUrl(query, hash), {
        headers: withAuthorization(),
      }),
      context.bindings,
    );

  const headArtifact = (query?: string, hash?: string) =>
    app.fetch(
      new Request(artifactUrl(query, hash), {
        headers: withAuthorization(),
        method: 'HEAD',
      }),
      context.bindings,
    );

  interface UploadOptions {
    body?: BodyInit;
    contentLength?: number | null;
    dirtyHash?: string;
    duration?: number;
    hash?: string;
    query?: string;
    sha?: string;
    tag?: string;
  }

  const putArtifact = (options: UploadOptions = {}) => {
    const contentLength =
      options.contentLength === undefined ? encodedLength(artifactContent) : options.contentLength;
    const headers = withAuthorization({
      'Content-Type': 'application/octet-stream',
      ...(contentLength === null ? {} : { 'Content-Length': String(contentLength) }),
      ...(options.duration === undefined
        ? {}
        : { 'x-artifact-duration': String(options.duration) }),
      ...(options.tag ? { 'x-artifact-tag': options.tag } : {}),
      ...(options.sha ? { 'x-artifact-sha': options.sha } : {}),
      ...(options.dirtyHash ? { 'x-artifact-dirty-hash': options.dirtyHash } : {}),
    });

    return app.fetch(
      new Request(artifactUrl(options.query ?? `teamId=${teamId}`, options.hash ?? artifactId), {
        body: options.body ?? artifactContent,
        headers,
        method: 'PUT',
      }),
      context.bindings,
    );
  };

  const queryArtifacts = (hashes: string[], query = `teamId=${teamId}`) =>
    app.fetch(
      new Request(`http://localhost/v8/artifacts${query ? `?${query}` : ''}`, {
        body: JSON.stringify({ hashes }),
        headers: withAuthorization({ 'Content-Type': 'application/json' }),
        method: 'POST',
      }),
      context.bindings,
    );

  const validEvent = () => ({
    duration: artifactDuration,
    event: 'HIT',
    hash: artifactId,
    sessionId: crypto.randomUUID(),
    source: 'REMOTE',
  });

  const eventRequest = (events: unknown, headers?: HeadersInit) => {
    const requestHeaders = withAuthorization(headers);
    requestHeaders.set('Content-Type', 'application/json');
    return app.fetch(
      new Request(`http://localhost/v8/artifacts/events?teamId=${teamId}`, {
        body: JSON.stringify(events),
        headers: requestHeaders,
        method: 'POST',
      }),
      context.bindings,
    );
  };

  describe('bearer authentication', () => {
    test.each([
      {
        operation: 'getArtifactStatus',
        request: () => new Request('http://localhost/v8/artifacts/status'),
      },
      {
        operation: 'artifactExists',
        request: () => new Request(artifactUrl(), { method: 'HEAD' }),
      },
      { operation: 'downloadArtifact', request: () => new Request(artifactUrl()) },
      {
        operation: 'uploadArtifact',
        request: () =>
          new Request(artifactUrl(), {
            body: artifactContent,
            headers: {
              'Content-Length': String(encodedLength(artifactContent)),
              'Content-Type': 'application/octet-stream',
            },
            method: 'PUT',
          }),
      },
      {
        operation: 'queryArtifacts',
        request: () =>
          new Request('http://localhost/v8/artifacts', {
            body: JSON.stringify({ hashes: [artifactId] }),
            headers: { 'Content-Type': 'application/json' },
            method: 'POST',
          }),
      },
      {
        operation: 'recordCacheEvents',
        request: () =>
          new Request('http://localhost/v8/artifacts/events', {
            body: JSON.stringify([validEvent()]),
            headers: { 'Content-Type': 'application/json' },
            method: 'POST',
          }),
      },
    ])('protects $operation with bearer authentication', async ({ request, operation }) => {
      const unauthenticatedRequest = request();
      const response = await app.fetch(unauthenticatedRequest, context.bindings);

      expect(response.status, operation).toBe(401);
      if (unauthenticatedRequest.method !== 'HEAD') {
        await expectContractError(response, 401, 'unauthorized');
      }
    });

    test('rejects an incorrect bearer token', async () => {
      const response = await app.fetch(
        new Request('http://localhost/v8/artifacts/status', {
          headers: { Authorization: 'Bearer incorrect-token' },
        }),
        context.bindings,
      );

      await expectContractError(response, 401, 'unauthorized');
    });

    test('does not let an unauthenticated request read a cached artifact', async () => {
      await context.files.upload(`${teamId}/${artifactId}`, artifactContent);
      expect((await getArtifact()).status).toBe(200);
      await context.waitForBackgroundWork();

      const response = await app.fetch(new Request(artifactUrl()), context.bindings);

      await expectContractError(response, 401, 'unauthorized');
    });
  });

  describe('getArtifactStatus', () => {
    test('reports that remote caching is enabled', async () => {
      const response = await app.fetch(
        new Request(`http://localhost/v8/artifacts/status?teamId=${teamId}`, {
          headers: withAuthorization(),
        }),
        context.bindings,
      );

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ status: 'enabled' });
    });
  });

  describe('downloadArtifact', () => {
    test('uses the legacy default team ID when no team is provided', async () => {
      expect((await getArtifact('')).status).toBe(404);

      await context.files.upload(`${DEFAULT_TEAM_ID}/${artifactId}`, artifactContent);

      expect((await getArtifact('')).status).toBe(200);
    });

    test('returns a contract error when the artifact does not exist', async () => {
      const response = await getArtifact(undefined, missingArtifactId);

      await expectContractError(response, 404, 'artifact_not_found');
    });

    test.each(['teamId', 'slug'])('accepts the %s team selector', async (selector) => {
      await context.files.upload(`${teamId}/${artifactId}`, artifactContent);

      expect((await getArtifact(`${selector}=${teamId}`)).status).toBe(200);
    });

    test('streams content with its length, metadata, and cache headers', async () => {
      expect(
        (
          await putArtifact({
            dirtyHash: artifactDirtyHash,
            duration: artifactDuration,
            sha: artifactSha,
            tag: artifactTag,
          })
        ).status,
      ).toBe(202);

      const response = await getArtifact();

      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toBe('application/octet-stream');
      expect(response.headers.get('Content-Length')).toBe(String(encodedLength(artifactContent)));
      expect(response.headers.get('x-artifact-duration')).toBe(String(artifactDuration));
      expect(response.headers.get('x-artifact-tag')).toBe(artifactTag);
      expect(response.headers.get('x-artifact-sha')).toBe(artifactSha);
      expect(response.headers.get('x-artifact-dirty-hash')).toBe(artifactDirtyHash);
      expect(response.headers.get('Cache-Control')).toBe('max-age=300');
      expect(new TextDecoder().decode(await response.arrayBuffer())).toBe(artifactContent);
    });

    test('downloads a zero-length artifact', async () => {
      expect((await putArtifact({ body: '', contentLength: 0 })).status).toBe(202);

      const response = await getArtifact();

      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Length')).toBe('0');
      expect((await response.arrayBuffer()).byteLength).toBe(0);
    });

    test('returns metadata stored by the legacy route implementation', async () => {
      await context.files.upload(`${teamId}/${artifactId}`, artifactContent, {
        metadata: {
          artifactDirtyHash,
          artifactDuration: String(artifactDuration),
          artifactSha,
          artifactTag,
        },
      });

      const response = await getArtifact();

      expect(response.headers.get('x-artifact-dirty-hash')).toBe(artifactDirtyHash);
      expect(response.headers.get('x-artifact-duration')).toBe(String(artifactDuration));
      expect(response.headers.get('x-artifact-sha')).toBe(artifactSha);
      expect(response.headers.get('x-artifact-tag')).toBe(artifactTag);
    });

    test('caches authorized artifact responses for subsequent reads', async () => {
      await context.files.upload(`${teamId}/${artifactId}`, artifactContent, {
        contentType: 'application/octet-stream',
      });

      const response = await getArtifact();
      expect(response.status).toBe(200);
      await response.arrayBuffer();
      await context.waitForBackgroundWork();

      await context.files.delete(`${teamId}/${artifactId}`);
      const cachedResponse = await getArtifact();

      expect(cachedResponse.status).toBe(200);
      expect(new TextDecoder().decode(await cachedResponse.arrayBuffer())).toBe(artifactContent);
    });
  });

  describe('uploadArtifact', () => {
    test('stores an artifact under the default team ID', async () => {
      const response = await putArtifact({ query: '' });

      expect(response.status).toBe(202);
      expect(await (await context.files.download(`${DEFAULT_TEAM_ID}/${artifactId}`)).text()).toBe(
        artifactContent,
      );
    });

    test.each(['teamId', 'slug'])('stores an artifact selected by %s', async (selector) => {
      const response = await putArtifact({ query: `${selector}=${teamId}` });

      expect(response.status).toBe(202);
      expect(await (await context.files.download(`${teamId}/${artifactId}`)).text()).toBe(
        artifactContent,
      );
    });

    test('fails signed caching explicitly when the adapter lacks metadata support', async () => {
      const adapter = memory();
      Object.defineProperty(adapter, 'supportsMetadata', { value: false });
      context = createTestAppContext();
      context.bindings.FILES = new Files({ adapter });

      const response = await putArtifact({ tag: artifactTag });

      await expectContractError(response, 400, 'unsupported_metadata');
    });

    test('rejects a request without the Turborepo artifact content type', async () => {
      const response = await app.fetch(
        new Request(artifactUrl(), {
          body: artifactContent,
          headers: withAuthorization({
            'Content-Length': String(encodedLength(artifactContent)),
          }),
          method: 'PUT',
        }),
        context.bindings,
      );

      await expectContractError(response, 400, 'bad_request');
    });

    test('requires Content-Length for every storage provider', async () => {
      const response = await putArtifact({ contentLength: null });

      await expectContractError(response, 400, 'bad_request');
    });

    test.each([
      ['a negative duration', -1],
      ['a fractional duration', 1.5],
    ])('rejects %s', async (_description, duration) => {
      const response = await putArtifact({ duration });

      await expectContractError(response, 400, 'bad_request');
    });

    test('rejects an artifact tag longer than the contract limit', async () => {
      const response = await putArtifact({ tag: 'x'.repeat(601) });

      await expectContractError(response, 400, 'bad_request');
    });

    test('streams the request body through native R2 and back to the client', async () => {
      Object.defineProperty(context.adapter, 'name', { value: 'r2-binding' });
      const bytes = new TextEncoder().encode(artifactContent);
      const splitAt = Math.floor(bytes.byteLength / 2);
      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(bytes.slice(0, splitAt));
          controller.enqueue(bytes.slice(splitAt));
          controller.close();
        },
      });

      const uploadResponse = await putArtifact({ body, contentLength: bytes.byteLength });
      const downloadResponse = await getArtifact();

      expect(uploadResponse.status).toBe(202);
      expect(downloadResponse.status).toBe(200);
      expect(downloadResponse.headers.get('Content-Length')).toBe(String(bytes.byteLength));
      expect(new Uint8Array(await downloadResponse.arrayBuffer())).toEqual(bytes);
    });
  });

  describe('artifactExists', () => {
    test('uses the default team ID when no team is provided', async () => {
      expect((await headArtifact('')).status).toBe(404);
      await context.files.upload(`${DEFAULT_TEAM_ID}/${artifactId}`, artifactContent);
      expect((await headArtifact('')).status).toBe(200);
    });

    test('returns 404 without a body when the artifact does not exist', async () => {
      const response = await headArtifact(undefined, missingArtifactId);

      expect(response.status).toBe(404);
      expect(await response.text()).toBe('');
    });

    test.each(['teamId', 'slug'])(
      'checks an artifact selected by %s without downloading a body',
      async (selector) => {
        expect(
          (
            await putArtifact({
              dirtyHash: artifactDirtyHash,
              duration: artifactDuration,
              query: `${selector}=${teamId}`,
              sha: artifactSha,
              tag: artifactTag,
            })
          ).status,
        ).toBe(202);

        const response = await headArtifact(`${selector}=${teamId}`);

        expect(response.status).toBe(200);
        expect(response.headers.get('Content-Length')).toBe(String(encodedLength(artifactContent)));
        expect(response.headers.get('x-artifact-duration')).toBe(String(artifactDuration));
        expect(response.headers.get('x-artifact-sha')).toBe(artifactSha);
        expect(response.headers.get('x-artifact-dirty-hash')).toBe(artifactDirtyHash);
        expect(await response.text()).toBe('');
      },
    );
  });

  describe('queryArtifacts', () => {
    test('returns information for stored artifacts and null for missing artifacts', async () => {
      expect(
        (
          await putArtifact({
            duration: artifactDuration,
            tag: artifactTag,
          })
        ).status,
      ).toBe(202);

      const response = await queryArtifacts([artifactId, missingArtifactId]);

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({
        [artifactId]: {
          size: encodedLength(artifactContent),
          tag: artifactTag,
          taskDurationMs: artifactDuration,
        },
        [missingArtifactId]: null,
      });
    });
  });

  describe('recordCacheEvents', () => {
    test('accepts a valid Turborepo event batch without a response body', async () => {
      const response = await eventRequest([validEvent()], {
        'x-artifact-client-ci': 'github-actions',
        'x-artifact-client-interactive': '0',
      });

      expect(response.status).toBe(200);
      expect(await response.text()).toBe('');
    });

    test.each([
      ['a non-UUID session ID', { sessionId: 'not-a-uuid' }],
      ['a negative duration', { duration: -1 }],
      ['a fractional duration', { duration: 1.5 }],
      ['an unknown source', { source: 'EDGE' }],
      ['an unknown event', { event: 'WRITE' }],
    ])('rejects an event with %s', async (_description, override) => {
      const response = await eventRequest([{ ...validEvent(), ...override }]);

      await expectContractError(response, 400, 'bad_request');
    });
  });

  describe('contract validation', () => {
    test.each([
      ['queryArtifacts', 'http://localhost/v8/artifacts'],
      ['recordCacheEvents', 'http://localhost/v8/artifacts/events'],
    ])('returns a contract error for malformed JSON sent to %s', async (_operation, url) => {
      const response = await app.fetch(
        new Request(url, {
          body: '{',
          headers: withAuthorization({ 'Content-Type': 'application/json' }),
          method: 'POST',
        }),
        context.bindings,
      );

      await expectContractError(response, 400, 'bad_request');
    });

    test.each(['GET', 'HEAD'])('rejects a non-hexadecimal artifact hash for %s', async (method) => {
      const response = await app.fetch(
        new Request(artifactUrl(undefined, 'not-a-hex-hash'), {
          headers: withAuthorization(),
          method,
        }),
        context.bindings,
      );

      expect(response.status).toBe(400);
      if (method !== 'HEAD') {
        await expectContractError(response, 400, 'bad_request');
      }
    });

    test('rejects a non-hexadecimal artifact hash for PUT', async () => {
      const response = await putArtifact({ hash: 'not-a-hex-hash' });

      await expectContractError(response, 400, 'bad_request');
    });

    test.each([
      ['an overlong CI name', { 'x-artifact-client-ci': 'x'.repeat(51) }],
      ['a fractional interactive value', { 'x-artifact-client-interactive': '0.5' }],
      ['an unknown interactive value', { 'x-artifact-client-interactive': '2' }],
    ])('rejects %s', async (_description, header) => {
      const response = await app.fetch(
        new Request(artifactUrl(), {
          headers: withAuthorization(header),
        }),
        context.bindings,
      );

      await expectContractError(response, 400, 'bad_request');
    });
  });
});
