---
layout: doc
---

# Set up Turborepo

After deploying the cache, configure each Turborepo repository that should use it. See [Turborepo's remote caching documentation](https://turborepo.dev/docs/core-concepts/remote-caching) for the underlying client behavior.

## 1. Enable signed caching

Add artifact signature validation to the repository's `turbo.json`:

```json
{
    "remoteCache": {
        "signature": true
    }
}
```

Signed caching prevents a client from accepting an artifact whose tag does not match its contents. R2, KV, and S3 all support the metadata needed to persist that tag.

::: warning Custom storage metadata
A custom Files SDK adapter must persist and return metadata to support signed caching and optional artifact metadata such as task duration or source hashes. If it cannot, plain cache operations remain available, but metadata-bearing uploads are rejected. The server does not create metadata sidecar objects.
:::

## 2. Install `dotenv-cli`

Install `dotenv-cli` in the Turborepo repository that will use the cache:

```sh
# Add -W when installing at a pnpm workspace root if required.
pnpm add -D dotenv-cli
```

## 3. Configure client environment variables

Create a `.env` file at the Turborepo repository root:

```dotenv
TURBO_API=https://YOUR_CACHE_DOMAIN
TURBO_TEAM=team_my_team_name
TURBO_TOKEN=YOUR_SECRET
TURBO_REMOTE_CACHE_SIGNATURE_KEY=YOUR_SIGNATURE_SECRET
```

- Do not add a trailing slash to `TURBO_API`.
- `TURBO_TEAM` must begin with `team_`.
- `TURBO_TOKEN` must match the server's bearer token.
- Keep the cache token and signature key secret, add `.env` to `.gitignore`, and provide the same values securely to CI.

`TURBO_TOKEN` authenticates requests to the remote cache. `TURBO_REMOTE_CACHE_SIGNATURE_KEY` signs and verifies artifacts in the Turborepo client; it does not need to match `TURBO_TOKEN`.

## 4. Load the environment for Turbo commands

Use `dotenv --` before each Turbo command. For example:

```json
{
    "scripts": {
        "build": "dotenv -- turbo run build",
        "dev": "dotenv -- turbo run dev",
        "lint": "dotenv -- turbo run lint",
        "test": "dotenv -- turbo run test"
    }
}
```

The next run should report `Remote caching enabled`. Run a cacheable task twice to confirm that the second invocation restores its output from the remote cache.
