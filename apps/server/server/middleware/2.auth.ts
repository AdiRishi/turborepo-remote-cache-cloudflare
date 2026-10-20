import { defineHandler, HTTPError } from 'nitro';
import { createHash, timingSafeEqual } from 'node:crypto';

import { readToken } from '../utils/config';
import { eventEnv } from '../utils/env';

const PROTECTED_PREFIXES = ['/v8/', '/internal/'];

const sha256 = (value: string) => createHash('sha256').update(value).digest();

export default defineHandler((event) => {
  if (!PROTECTED_PREFIXES.some((prefix) => event.url.pathname.startsWith(prefix))) {
    return;
  }
  const expected = readToken(eventEnv(event));
  const token = /^Bearer\s+(?<token>\S+)$/iu.exec(event.req.headers.get('authorization') ?? '')
    ?.groups?.token;
  // Hashing gives both sides the same length, which timingSafeEqual requires.
  if (token === undefined || !timingSafeEqual(sha256(token), sha256(expected))) {
    throw new HTTPError({ status: 401, message: 'Missing or invalid bearer token' });
  }
});
