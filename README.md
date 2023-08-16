# Turborepo Remote Cache (For Cloudflare Workers!) [![CI](https://github.com/AdiRishi/turborepo-remote-cache-cloudflare/actions/workflows/ci.yml/badge.svg)](https://github.com/AdiRishi/turborepo-remote-cache-cloudflare/actions/workflows/ci.yml)

An open source implementation of the [Turborepo custom remote cache server](https://turbo.build/repo/docs/core-concepts/remote-caching) **purpose-built from the ground up for [Cloudflare Workers](https://developers.cloudflare.com/workers/)**

## Why should I use this?

If you're a Turborepo user, this project offers compelling advantages:

-   🚀 **Faster Builds**: Harness the power of remote caching to significantly speed up your builds
-   🌐 **Independence from Vercel**: Use Turborepo without tying your project to Vercel. This gives you flexibility in hosting decisions.
-   💰 **Cost Savings**: Say goodbye to surprise egress costs when downloading artifacts. This means fewer unexpected charges on your cloud bill.
-   🌍 **Global Deployment**: Code deploys instantly across the globe in over 300 countries, ensuring unmatched performance and reliability.
-   👛 **Affordable Start**: With Cloudflare Workers' [generous free tier](https://developers.cloudflare.com/workers/platform/pricing), you can make up to 100,000 requests every day at no cost. It's a cost-effective way to get started and scale your application.

## Quick start

### Deploy using Cloudflare's deploy button

To deploy this repository quickly, click the following link:

[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/AdiRishi/turborepo-remote-cache-cloudflare)

### Deploy Using the CLI

For a more hands-on deployment using the CLI, follow the steps below:

```sh
# 1. Clone the repository
git clone https://github.com/AdiRishi/turborepo-remote-cache-cloudflare.git custom-cache

# 2. Install packages
yarn install

# 3. Create the R2 bucket for storage
wrangler r2 bucket create turborepo-cache

# 4. Publish the project
wrangler deploy

# 5. Set a Bearer auth token
echo "SECRET" | wrangler secret put TURBO_TOKEN
```

## Configuration

### Github actions requirements

In order to successfully run the [deploy](.github/workflows//deploy.yml) Github action you will need the following secrets

-   `CLOUDFLARE_API_TOKEN`
-   `CLOUDFLARE_ACCOUNT_ID`

_Note: These will be automatically set for you if you use the "Deploy with Workers" button._

### Automatic deletion of old cache files

This project sets up a [cron trigger](https://developers.cloudflare.com/workers/platform/triggers/cron-triggers/) for Cloudflare workers, which automatically deletes old cache files within the bound R2 bucket. This behavior can be customized:

-   To disable the automatic deletion, remove the [triggers] configuration in [wrangler.toml](./wrangler.toml)
-   To change the retention period for objects, adjust the `BUCKET_OBJECT_EXPIRATION_HOURS` option in [wrangler.toml](./wrangler.toml) or set it via [workers environment variables](https://developers.cloudflare.com/workers/platform/environment-variables/)

## Setting up remote caching in your Turborepo project

Here's my recommended approach for setting up remote caching in your Turborepo project. You can read more about this topic in the [official Turborepo documentation](https://turbo.build/repo/docs/core-concepts/remote-caching).

### Step 1: Update `turbo.json`

Modify the `turbo.json` file at your project root to include [signature validation](https://turbo.build/repo/docs/core-concepts/remote-caching#artifact-integrity-and-authenticity-verification)

```json
{
    "remoteCache": { "signature": true }
}
```

### Step 2: Install `dotenv-cli`

Install the `dotenv-cli` npm package:

```sh
# You may have to add -W if you are installing this on your workspace root
yarn add --dev dotenv-cli
```

### Step 3: Create a `.env` File

Create a `.env` file at your project root with the following content:

```dotenv
TURBO_API=YOUR_API_URL
TURBO_TEAM=team_my_team_name
TURBO_TOKEN=SECRET # The turbo token must be a valid Bearer auth token
TURBO_REMOTE_CACHE_SIGNATURE_KEY=SECRET
```

Keep the following in mind

-   Replace `SECRET` and `YOUR_API_URL` with your chosen values.
-   The `TURBO_TEAM` value must begin with `team_`
-   Remember to add the `.env` file to `.gitignore`
-   If you are building your project in some remote CI tool (like Github Actions) you need to make these environment variables available to your build script

### Step 4: Modify Turbo Commands

Load the `.env` file prior to execution. Instead of running a command like `turbo run build` directly, use `dotenv -- turbo run build`. This loads everything in our `.env` file into the process's environment variables.

Here's how to modify your scripts in `package.json` to use dotenv-cli:

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
