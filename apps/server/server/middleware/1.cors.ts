import type { CorsOptions } from 'nitro/h3';

import { defineHandler } from 'nitro';
import { appendCorsHeaders, appendCorsPreflightHeaders, noContent } from 'nitro/h3';

const options = {
  origin: '*',
  methods: ['GET', 'HEAD', 'POST', 'PUT', 'OPTIONS'],
  allowHeaders: [
    'Authorization',
    'Content-Type',
    'User-Agent',
    'x-artifact-client-ci',
    'x-artifact-client-interactive',
    'x-artifact-dirty-hash',
    'x-artifact-duration',
    'x-artifact-sha',
    'x-artifact-tag',
  ],
  exposeHeaders: [
    'Content-Length',
    'x-artifact-dirty-hash',
    'x-artifact-duration',
    'x-artifact-sha',
    'x-artifact-tag',
  ],
  maxAge: '86400',
} satisfies CorsOptions;

export default defineHandler((event) => {
  if (!event.url.pathname.startsWith('/v8/')) {
    return undefined;
  }
  // `turbo` sends preflights without an Origin header, which h3's handleCors does not treat as a preflight.
  if (event.req.method === 'OPTIONS') {
    appendCorsPreflightHeaders(event, options);
    return noContent();
  }
  appendCorsHeaders(event, options);
  return undefined;
});
