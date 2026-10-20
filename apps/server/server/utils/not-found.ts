import { defineHandler, HTTPError } from 'nitro';

export default defineHandler((event) => {
  throw new HTTPError({
    status: 404,
    message: `No route matches ${event.req.method} ${event.url.pathname}`,
  });
});
