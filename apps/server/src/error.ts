import type { components } from '@turborepo-remote-cache/spec';

import { defineErrorHandler } from 'nitro';
import { isEvent } from 'nitro/h3';

const ERROR_CODES: Record<number, string> = {
  400: 'bad_request',
  401: 'unauthorized',
  404: 'not_found',
  405: 'method_not_allowed',
  500: 'internal_server_error',
};

export default defineErrorHandler((error, event) => {
  const status = error.unhandled ? 500 : error.status;
  const body = {
    code: ERROR_CODES[status] ?? `http_${status}`,
    message: error.unhandled ? 'Internal server error' : error.message,
  } satisfies components['schemas']['Error'];

  // A returned Response skips the error headers (such as CORS) that middleware prepared.
  const headers = new Headers(isEvent(event) ? event.res.errHeaders : undefined);
  for (const [name, value] of new Headers(error.headers)) {
    headers.set(name, value);
  }
  return Response.json(body, { status, headers });
});
