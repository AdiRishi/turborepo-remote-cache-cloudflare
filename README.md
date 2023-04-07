# Turborepo Remote Cache (For Cloudflare Workers!) [![CI](https://github.com/AdiRishi/turborepo-remote-cache-cloudflare/actions/workflows/ci.yml/badge.svg)](https://github.com/AdiRishi/turborepo-remote-cache-cloudflare/actions/workflows/ci.yml)

An open source implementation of the [Turborepo custom remote cache server](https://turbo.build/repo/docs/core-concepts/remote-caching).
This implementation is **built from the ground up for [Cloudflare Workers](https://developers.cloudflare.com/workers/)**

## Quick start

The easiest way to deploy this repository is using the link below

[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/AdiRishi/turborepo-remote-cache-cloudflare)

If you want to clone the repository and deploy it via the CLI, use the following steps

```sh
# 1. Clone the repository
git clone https://github.com/AdiRishi/turborepo-remote-cache-cloudflare.git custom-cache

# 2. Install packages
yarn install

# 3. Create the R2 bucket for storage
wrangler r2 bucket create turborepo-cache

# 4. Publish the project
wrangler publish

# 5. Set a Bearer auth token
echo "SECRET" | wrangler secret put TURBO_TOKEN
```

## Configuration

### Github actions requirements

In order to successfully run the [deploy](.github/workflows//deploy.yml) Github action you will need the following secrets

- `CF_API_TOKEN`
- `CF_ACCOUNT_ID`

_Note: These will be automatically set for you if you use the "Deploy with Workers" button._

### Automatic deletion of old cache files

This project sets up a [cron trigger](https://developers.cloudflare.com/workers/platform/triggers/cron-triggers/) for Cloudflare workers which will automatically delete old cache files within the bound R2 bucket.

You can disable this behavior by removing the `[triggers]` configuration in [wrangler.toml](./wrangler.toml)

You can change how long objects will be retained via the `BUCKET_OBJECT_EXPIRATION_HOURS` option in [wrangler.toml](./wrangler.toml) or via [workers environment variables](https://developers.cloudflare.com/workers/platform/environment-variables/)

## Setting up remote caching in your Turborepo project

This section will describe **my recommended** way of setting up remote caching in turborepo. There are many ways to go about this. You can read can read more about this topic at the [official turborepo docs](https://turbo.build/repo/docs/core-concepts/remote-caching).

1. Create `.turbo/config.json` at the root of your project with the following content

```json
{
  "teamId": "team_myteam",
  "apiUrl": "<the workers.dev url for your deployed worker>"
}
```

**Note**: The teamId must begin with `team`

2. Modify the `turbo.json` file at your project root to include [signature validation](https://turbo.build/repo/docs/core-concepts/remote-caching#artifact-integrity-and-authenticity-verification)

```json
{
  "remoteCache": { "signature": true }
}
```

3. Install the `dotenv-cli` npm package

```sh
yarn install --dev dotenv-cli
```

4. Create a `.env` file at your project root with the following content

```dotenv
# The turbo token must be a valid Bearer auth token
TURBO_TOKEN=SECRET
TURBO_REMOTE_CACHE_SIGNATURE_KEY=SECRET
```

Keep the following in mind

- Replace `SECRET` with your chosen values.
- Remember to add the `.env` file to `.gitignore`
- If you are building your project in some remote CI tool (like Github Actions) you need to make these environment variables available to your build script

5. Modify your turbo commands to load the `.env` file prior to execution

Instead of running a command like `turbo run build` directly, we simply run `dotenv -- turbo run build`. This will load everything in our `.env` file into the processes environment variables.

I would recommend modifying your scripts in `package.json` to use dotenv-cli so you don't have to remember this each time. E.g.

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

And that's it 🎉🎉

Whenever you run a turbo command you will see `Remote cache enabled` in it's log output

```
yarn lint
yarn run v1.22.19
$ dotenv -- turbo run lint
• Packages in scope: turborepo-project, webapp, docs
• Running lint in 3 packages
• Remote caching enabled

...output

 Tasks:    3 successful, 3 total
Cached:    3 cached, 3 total
  Time:    1.174s >>> FULL TURBO

✨  Done in 3.54s.
```
