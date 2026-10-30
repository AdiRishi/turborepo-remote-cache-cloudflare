---
'@turborepo-remote-cache/api': minor
---

Serve a usage dashboard at the server's root, in place of the redirect to the documentation. It shows the time the caches saved, hit rates, where tasks came from, storage, clients, and teams, over a range from the last 24 hours to the last 90 days, and compares each figure with the period before. `GET /stats` returns the same numbers as JSON. Both are public.

The server records stats in a database through Nitro's database layer, after each response. Cloudflare builds bind a D1 database as `STATS_DB`, which Wrangler creates on the next deploy. Node.js and Deno builds use a SQLite file in `.data/`. Without a database, the cache works as before and the dashboard reports that stats are off.

If you deploy from CI, give the Cloudflare API token permission to edit D1. Vercel and Netlify builds now run `turbo run build`, so the dashboard builds before the server.
