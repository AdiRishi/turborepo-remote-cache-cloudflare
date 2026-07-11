# Remote Cache

This context covers the concepts used to store and serve Turborepo build artifacts from a self-hosted remote cache.

## Language

**Artifact**:
A content-addressed build output stored by the remote cache and retrieved by its Turborepo hash.

**Artifact tag**:
An integrity signature supplied with an artifact by a Turborepo client and returned unchanged when that artifact is retrieved.
_Avoid_: Storage metadata, checksum

**Signed caching**:
A remote-caching mode in which the Turborepo client verifies an artifact tag before accepting a retrieved artifact.
_Avoid_: Authenticated caching

**Self-hoster**:
A person or organization that clones, configures, and deploys its own remote cache service.
_Avoid_: Customer, operator

**Self-hosting contract**:
The observable configuration, deployment, API, and stored-data behavior that a self-hoster relies on when operating or upgrading the remote cache.
_Avoid_: Internal API

**Storage provider**:
The external service that persists artifacts for a remote cache deployment.
_Avoid_: Storage adapter, backend

**Storage adapter**:
The integration layer that connects the remote cache's file operations to a storage provider.
_Avoid_: Storage provider, backend

**First-class storage provider**:
A storage provider that a self-hoster can select and configure without changing source code, and that this project supports, tests, and documents end to end. Cloudflare R2, Cloudflare KV, and Amazon S3 are first-class storage providers.
_Avoid_: Built-in provider, bundled provider

**Custom storage provider**:
Any other Files SDK-compatible storage provider integrated through the project's source configuration escape hatch and maintained by a self-hoster.
_Avoid_: Unsupported provider

**Deployment target**:
The runtime and hosting environment that executes a remote cache deployment.
_Avoid_: Storage provider, storage adapter

**Default deployment target**:
The deployment target prioritized by the project's configuration, testing, and getting-started experience. Cloudflare Workers is the default deployment target.
_Avoid_: Default provider, generic serverless

**Cloudflare-first**:
The project's positioning in which Cloudflare Workers provides the default self-hosting experience and takes priority when portable behavior conflicts, while other deployment targets remain supported through Nitro.
_Avoid_: Cloudflare-only, cloud-agnostic
