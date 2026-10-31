---
'@turborepo-remote-cache/api': minor
---

Record a trace for each request on Cloudflare Workers, and turn on Issues, which groups failed requests and error logs. Traces include Cloudflare's spans for every R2, KV, and D1 call, and spans named by route, such as `GET /v8/artifacts/:hash`. The build now writes source maps, so Cloudflare shows stack traces at the lines in `apps/api/src`.

From December 1, 2026, Cloudflare bills traces with logs under Cloudflare Observability pricing. To keep only a share of requests, or to turn traces or Issues off, edit `observability` in `apps/api/wrangler.jsonc`. The new Logs and traces page in the documentation shows how.

On other platforms, the server publishes each request and stats query through Node.js tracing channels, which monitoring agents can read, and Vercel builds add them to Vercel's traces.
