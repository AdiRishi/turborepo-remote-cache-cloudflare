import { serverFetch } from 'nitro';
import * as v from 'valibot';

/** Set `CONTRACT_BASE_URL` to run the contract tests against a running server instead of in-process. */
const baseUrl = process.env.CONTRACT_BASE_URL;

export const TOKEN = 'test-token';

type Send = (path: string, init?: RequestInit) => Promise<Response>;

export const send: Send = (path, init) =>
  baseUrl === undefined ? serverFetch(path, init) : fetch(new URL(path, baseUrl), init);

/** Requests that carry the bearer token, sent through `transport`. */
export const clientFor = (transport: Send) => {
  const authorized = (path: string, init: RequestInit = {}) => {
    const headers = new Headers(init.headers);
    headers.set('authorization', `Bearer ${TOKEN}`);
    return transport(path, { ...init, headers });
  };

  const uploadArtifact = ({
    hash,
    body,
    headers = {},
    search = '',
  }: {
    hash: string;
    body: Uint8Array;
    headers?: Record<string, string>;
    search?: string;
  }) =>
    authorized(`/v8/artifacts/${hash}${search}`, {
      method: 'PUT',
      body,
      headers: {
        'content-type': 'application/octet-stream',
        'content-length': String(body.byteLength),
        ...headers,
      },
    });

  return { authorized, uploadArtifact };
};

export const { authorized, uploadArtifact } = clientFor(send);

export const randomHash = () => crypto.randomUUID().replaceAll('-', '');

const ErrorBody = v.strictObject({ code: v.string(), message: v.string() });

/** Parses a spec error body, `{ code, message }` and nothing else. */
export const readError = async (response: Response) => v.parse(ErrorBody, await response.json());

const UploadBody = v.strictObject({ urls: v.tuple([v.pipe(v.string(), v.url())]) });

export const readUploadUrl = async (response: Response) =>
  new URL(v.parse(UploadBody, await response.json()).urls[0]);
