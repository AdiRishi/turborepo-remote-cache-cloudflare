<div align="center">

# Turborepo Remote Cache (For Cloudflare Workers!)

</div>

<div align="center">

[![CI](https://github.com/AdiRishi/turborepo-remote-cache-cloudflare/actions/workflows/ci.yml/badge.svg)](https://github.com/AdiRishi/turborepo-remote-cache-cloudflare/actions/workflows/ci.yml) [![Coverage Status](https://coveralls.io/repos/github/AdiRishi/turborepo-remote-cache-cloudflare/badge.svg)](https://coveralls.io/github/AdiRishi/turborepo-remote-cache-cloudflare) ![GitHub License](https://img.shields.io/github/license/AdiRishi/turborepo-remote-cache-cloudflare) [![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](.github/CONTRIBUTING.md)

<a href="https://adirishi.github.io/turborepo-remote-cache-cloudflare" target="_blank">
  <img src="https://img.shields.io/badge/Visit-Developer%20Docs-%230572BE?style=for-the-badge&logo=readthedocs&logoColor=white" alt="Visit Developer Docs">
</a>

</div>

## 🚀 Introduction

This project offers an open source implementation of the [Turborepo custom remote cache server](https://turbo.build/repo/docs/core-concepts/remote-caching) **purpose-built from the ground up for [Cloudflare Workers](https://developers.cloudflare.com/workers/)**

📚 _For detailed documentation, please refer to our [official website](https://cloudflare.turborepo-remote-cache.dev/)._

## 🤔 Why should I use this?

If you're a Turborepo user, this project offers compelling advantages:

-   🚀 **Faster Builds**: Harness the power of remote caching to significantly speed up your builds
-   🌐 **Independence from Vercel**: Use Turborepo without tying your project to Vercel. This gives you flexibility in hosting decisions.
-   💰 **Cost Savings**: Say goodbye to surprise egress costs when downloading artifacts. This means fewer unexpected charges on your cloud bill.
-   🌍 **Global Deployment**: Code deploys instantly across the globe in over 300 countries, ensuring unmatched performance and reliability.
-   👛 **Affordable Start**: With Cloudflare Workers' [generous free tier](https://developers.cloudflare.com/workers/platform/pricing), you can make up to 100,000 requests every day at no cost. It's a cost-effective way to get started and scale your application.

## ⚡️ Quick start

### Deploy Using the CLI

The fastest and easiest way to deploy this project is with [wrangler](https://developers.cloudflare.com/workers/wrangler/) (cloudflare's CLI tool for managing workers).

This project already comes with wrangler installed and configured, so all you need to do is clone this repository and run `pnpm run deploy`.

```sh
# 1. Clone the repository
git clone https://github.com/AdiRishi/turborepo-remote-cache-cloudflare.git

# 2. Install packages
pnpm install

# 3. Create the R2 bucket for storage
pnpm wrangler r2 bucket create turborepo-cache

# 4. Publish the project
pnpm run deploy

# 5. Set a Bearer auth token
echo "SECRET" | pnpm wrangler secret put TURBO_TOKEN
```

### Deploy using Cloudflare's deploy button

This project also supports one-click deploy via Cloudflare's deploy button. Use this option only if you already have a Cloudflare account and have used R2 buckets before.

[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/AdiRishi/turborepo-remote-cache-cloudflare)

## ⚙️ Configuration

### Github actions requirements

In order to successfully run the [deploy](.github/workflows//deploy.yml) Github action you will need the following secrets

-   `CLOUDFLARE_API_TOKEN`
-   `CLOUDFLARE_ACCOUNT_ID`
-   `TURBO_TOKEN`

For those who have forked this repository, feel free to delete the [release.yml](https://github.com/AdiRishi/turborepo-remote-cache-cloudflare/blob/master/.github/workflows/release.yml) workflow file. This is only used to automatically publish new releases of this repository to GitHub releases.

### Automatic deletion of old cache files

This project sets up a [cron trigger](https://developers.cloudflare.com/workers/platform/triggers/cron-triggers/) for Cloudflare workers, which automatically deletes old cache files within the bound R2 bucket. This behavior can be customized:

-   To disable the automatic deletion, remove the [triggers] configuration in [wrangler.toml](./wrangler.toml)
-   To change the retention period for objects, adjust the `BUCKET_OBJECT_EXPIRATION_HOURS` option in [wrangler.toml](./wrangler.toml) or set it via [workers environment variables](https://developers.cloudflare.com/workers/platform/environment-variables/)

## ▲ Setting up remote caching in your Turborepo project

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
pnpm add -D dotenv-cli
```

### Step 3: Create a `.env` File

Create a `.env` file at your project root with the following content:

```dotenv
TURBO_API=YOUR_API_URL # Remember to remove the trailing slash
TURBO_TEAM=team_my_team_name
TURBO_TOKEN=SECRET # The turbo token must be a valid Bearer auth token
TURBO_REMOTE_CACHE_SIGNATURE_KEY=SECRET
```

Keep the following in mind

-   Replace `SECRET` and `YOUR_API_URL` with your chosen values.
-   Turborepo requires that the `TURBO_API` value must not end with a trailing slash
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
pnpm lint

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

---

<div align="center">

Made with ❤️

</div>
