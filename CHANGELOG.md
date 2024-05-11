# turborepo-remote-cache-cf

## 3.2.0

### Minor Changes

- [#449](https://github.com/AdiRishi/turborepo-remote-cache-cloudflare/pull/449) [`b765ed4`](https://github.com/AdiRishi/turborepo-remote-cache-cloudflare/commit/b765ed4de8d3bdd2c55942ca722895d9b6f6506e) Thanks [@AdiRishi](https://github.com/AdiRishi)! - Use KV key expiry to cost effectively remove cache keys

## 3.1.0

### Minor Changes

- [#394](https://github.com/AdiRishi/turborepo-remote-cache-cloudflare/pull/394) [`2005a64`](https://github.com/AdiRishi/turborepo-remote-cache-cloudflare/commit/2005a64d7c661cafb1c3f651a9248a206db032c3) Thanks [@AdiRishi](https://github.com/AdiRishi)! - Update routes to conform to the new Turborepo OpenAPI spec.

  Overall this is not a breaking change as most additions are optional.

## 3.0.0

### Major Changes

- [#287](https://github.com/AdiRishi/turborepo-remote-cache-cloudflare/pull/287) [`7851729`](https://github.com/AdiRishi/turborepo-remote-cache-cloudflare/commit/78517294d281182c7f6e7e27b69d7f22ea5115cc) Thanks [@AdiRishi](https://github.com/AdiRishi)! - This project now has brand new web documentation powered by VitePress. You can visit these docs at https://adirishi.github.io/turborepo-remote-cache-cloudflare

- [#287](https://github.com/AdiRishi/turborepo-remote-cache-cloudflare/pull/287) [`7851729`](https://github.com/AdiRishi/turborepo-remote-cache-cloudflare/commit/78517294d281182c7f6e7e27b69d7f22ea5115cc) Thanks [@AdiRishi](https://github.com/AdiRishi)! - You can now store your build artifacts in either Cloudflare 🪣 R2 or 🔑 KV storage. Find out how in our [official documentation](https://adirishi.github.io/turborepo-remote-cache-cloudflare/configuration/kv-storage)

## 2.6.2

### Patch Changes

- 6455295: Use a default value for secrets.TURBO_TOKEN to prevent one-click deployment (fork) failures

## 2.6.1

### Patch Changes

- 273c29e: Fix incorrect usage of wranglerVersion in deploy.yml - this fixes the wrangler deploy github action

## 2.6.0

### Minor Changes

- 0a87179: Move release process to changesets cli
