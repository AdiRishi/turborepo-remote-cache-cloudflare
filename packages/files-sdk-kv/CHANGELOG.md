# @turborepo-remote-cache/files-sdk-kv

## 0.1.0

The first release of a [Files SDK](https://files-sdk.dev) adapter for Cloudflare Workers KV. Turborepo Remote Cache 5.0 stores its KV artifacts through it, and the adapter holds no Turborepo logic of its own.

```ts
import { kv } from '@turborepo-remote-cache/files-sdk-kv';
import { Files } from 'files-sdk';

const files = new Files({ adapter: kv({ binding: env.KV, expirationTtl: 60 * 60 * 24 }) });
```

- **Metadata lives in KV metadata.** `list` reports each file's size, type, and upload time without reading any values.
- **Expiry built in.** `expirationTtl` sets a KV TTL on every upload and copy.
- **Limits checked up front.** A key over 512 bytes, a value over 25 MiB, or metadata over 1024 bytes throws `Invalid` before anything is written.
- **Tested in workerd** against a Miniflare KV namespace.

Shipped in [#1067](https://github.com/AdiRishi/turborepo-remote-cache-cloudflare/pull/1067) by [@AdiRishi](https://github.com/AdiRishi).
