# @turborepo-remote-cache/files-sdk-kv

A [Files SDK](https://files-sdk.dev) adapter that stores files in a Cloudflare Workers KV namespace. It targets `files-sdk` 3.1.1.

```ts
import { kv } from '@turborepo-remote-cache/files-sdk-kv';
import { Files } from 'files-sdk';

const files = new Files({ adapter: kv({ binding: env.KV, expirationTtl: 60 * 60 * 24 }) });

await files.upload('reports/q3.pdf', body, { metadata: { owner: 'finance' } });
const file = await files.download('reports/q3.pdf', { as: 'stream' });
```

## Options

`kv(options)` returns an `Adapter<KVNamespace>`, and `files.raw` is the binding. The options type is exported as `KvAdapterOptions`. `files-sdk` is a peer dependency pinned to 3.1.1, and `KVNamespace` is the type from `@cloudflare/workers-types`.

| Option          | Type          | Description                                                                                                                                                                    |
| --------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `binding`       | `KVNamespace` | The Workers KV namespace binding.                                                                                                                                              |
| `expirationTtl` | `number`      | Seconds until KV expires a key, applied to every `upload` and `copy`. Must be an integer of at least 60. `kv()` throws a `FilesError` with code `Invalid` for any other value. |

## Storage format

Each file is one KV entry. The value is the file's bytes. The KV metadata is a JSON object with the file's info, so `head` and `list` answer without reading the value:

```json
{
    "size": 1234,
    "contentType": "application/pdf",
    "lastModified": 1760000000000,
    "metadata": { "owner": "finance" }
}
```

`lastModified` is the write time in milliseconds since the epoch. `metadata` holds the user metadata and is absent when the upload passed none. KV has no ETags, so `FileInfo.etag` is never set.

KV has no metadata-only read. `head` and `exists` call `get` for the value as a stream, take the metadata, and cancel the stream without reading it. KV bills each as one read. `list` is not used for them, because it lags writes more than `get` does and costs more per operation.

## Capabilities

| Capability                               | Value   | Reason                                                                                        |
| ---------------------------------------- | ------- | --------------------------------------------------------------------------------------------- |
| `metadata`                               | `true`  | User metadata is stored in the KV metadata.                                                   |
| `serverSideCopy`                         | `false` | `copy` reads the source value and writes it to the destination.                               |
| `rangeRead`                              | `false` | KV reads whole values.                                                                        |
| `delimiter`                              | `false` | KV lists keys flat, with no common prefixes.                                                  |
| `cacheControl`                           | `false` | KV stores no HTTP headers.                                                                    |
| `publicUrl`, `signedUrl`, `signedUpload` | `false` | KV has no URLs. `url()` and `signedUploadUrl()` throw a `FilesError` with code `Unsupported`. |
| `uploadProgress`, `resumable`            | `false` | KV writes a value in one call. The `Files` wrapper reports upload progress itself.            |
| `conditional`                            | none    | KV has no compare-and-set primitive.                                                          |

The `Files` wrapper refuses `range`, `delimiter`, and `cacheControl` with `Unsupported` before the adapter runs.

## Errors

- `download` and `head` of a missing key throw `NotFound`. `copy` throws `NotFound` for a missing source.
- `exists` returns `false` for a missing key.
- `delete` of a missing key does nothing.
- A write that breaks a KV limit throws `Invalid` before anything is written.
- Other KV failures reach the caller as `Provider` errors through the `Files` wrapper.

## Limits

| Limit    | Value               | Behavior                                                                                                                                                               |
| -------- | ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Key      | 512 bytes, UTF-8    | Every operation on a longer key throws `Invalid`.                                                                                                                      |
| Value    | 25 MiB              | `upload` throws `Invalid`. KV needs the size before the write, so a `ReadableStream` body is buffered in memory. The adapter cancels the stream once it passes 25 MiB. |
| Metadata | 1024 bytes, as JSON | Counts the whole stored object above, not only the user metadata. `upload` and `copy` throw `Invalid` when it is larger.                                               |
| List     | 1000 keys per page  | A larger `limit` is capped at 1000. `list` returns a `cursor` only when more pages exist.                                                                              |

KV is eventually consistent. A write is visible at once in the location that made it, but it can take 60 seconds or more to reach reads and listings in other locations.

## Entries the adapter did not write

A namespace can hold entries from other code, with no KV metadata or with metadata in another shape. The adapter treats every key as a file. When an entry's metadata is not the object above, it reports `contentType: 'application/octet-stream'`, with no `lastModified` and no `metadata`.

The size of such an entry is known only from its value:

- `head` reads the value, which KV caps at 25 MiB, and reports its byte length.
- `download` reads the value, reports its byte length, and serves those bytes. This applies to `as: 'stream'` too, so the reported size always matches the body.
- `list` cannot read values, so it reports `size: 0`. Use `head` when the real size matters.

`delete` removes the entry. `copy` writes the destination in this adapter's format, so `list` then reports its real size.

To read the original metadata of such an entry, use the binding through `files.raw`.

## Development

```bash
pnpm --filter @turborepo-remote-cache/files-sdk-kv test
pnpm --filter @turborepo-remote-cache/files-sdk-kv typecheck
```

Tests run inside workerd through `@cloudflare/vitest-plugin`, against a Miniflare KV namespace.
