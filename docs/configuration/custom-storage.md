---
layout: doc
---

# Custom Files SDK storage

R2, KV, and S3 cover the common self-hosting paths without code changes. For another provider, use the typed `storage.config.ts` escape hatch instead of adding every Files SDK adapter and dependency to the runtime provider registry.

## How custom storage works

1. Install the adapter's optional peer dependencies.
2. Edit the root `storage.config.ts` file to return that adapter from `defineStorageConfig(...)`.
3. Supply the adapter's settings through runtime environment variables or bindings.
4. Set `STORAGE_PROVIDER=custom`.
5. Build and test the selected Nitro target.

The custom factory is invoked only when `STORAGE_PROVIDER=custom`. Built-in R2, KV, and S3 selection therefore requires no edit to the default file. The module and any adapter it statically imports are still included at build time, so install only the custom provider dependencies that deployment needs.

Refer to the [Files SDK provider documentation](https://files-sdk.dev/docs/providers) for the selected package's constructor, peer dependencies, runtime support, and capabilities. Keep provider secrets out of `storage.config.ts`.

## Example: Azure Blob Storage

For example, install the Azure adapter's optional peer dependency:

```sh
pnpm add @azure/storage-blob
```

Then replace the default factory in `storage.config.ts`:

```ts
import { azure } from 'files-sdk/azure';

import { defineStorageConfig } from './src/storage/custom';

export default defineStorageConfig(({ getEnv }) => {
    const container = getEnv('AZURE_STORAGE_CONTAINER');
    const connectionString = getEnv('AZURE_STORAGE_CONNECTION_STRING');

    if (!container || !connectionString) {
        throw new Error('Azure storage is not configured');
    }

    return azure({ container, connectionString });
});
```

Supply `AZURE_STORAGE_CONTAINER` and the secret `AZURE_STORAGE_CONNECTION_STRING` at runtime, then set:

```dotenv
STORAGE_PROVIDER=custom
```

The callback receives three typed values:

- `getEnv(name)` reads and trims a string setting.
- `env` exposes the complete runtime environment, including platform bindings.
- `retentionHours` contains the resolved retention period.

The factory may return an adapter immediately or asynchronously.

## Signed caching requires metadata

Turborepo sends an artifact tag when signed caching is enabled and may send task duration or source hashes with any upload. A custom adapter must persist that metadata with the object and return it on reads.

- If the adapter supports metadata, all cache modes and artifact headers work.
- If it does not, plain cache operations can still work, but any metadata-bearing upload fails with a clear error instead of silently discarding contract data.
- The server does not create a second metadata object because sidecars add extra reads, writes, cleanup rules, and orphan states.

Check the [Files SDK capability matrix](https://files-sdk.dev/docs/capabilities) before choosing an adapter.

## Operational requirements

A custom integration owns more of the self-hosting contract. Verify that it:

- runs in the selected Nitro target;
- streams or safely bounds uploads for the provider;
- preserves object metadata if signed caching is enabled;
- supports listing and deletion needed by the `cache:delete-expired` task;
- returns `lastModified` values from listing if task-based retention is required; and
- documents any provider-specific artifact size or consistency limits.

The Files SDK wrapper applies `STORAGE_PREFIX`; the custom adapter should not add the same prefix itself. The project's tests and compatibility guarantees cover the first-class R2, KV, and S3 paths. A custom adapter remains the self-hoster's responsibility, even though the integration point is typed.
