---
layout: doc
---

# ⚡️ Getting Started

## One-click Deploy

To deploy this repository quickly, click the following link:

[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/AdiRishi/turborepo-remote-cache-cloudflare)

Clicking the button will open a new webpage with a guided deployment process build by Cloudflare. During this process, Cloudflare will fork this repository and use the wrangler github action to deploy this project to your Cloudflare account.

Here is a preview of the deployment process:

![Workers One Click Deployment](https://public-assets.turborepo-remote-cache.dev/images/cloudflare-one-click-demo.jpg)

## Deploy Using the CLI

For a more hands-on deployment using the CLI, follow the steps below:

```sh
# 1. Clone the repository
git clone https://github.com/AdiRishi/turborepo-remote-cache-cloudflare.git custom-cache

# 2. Install packages
pnpm install

# 3. Create the R2 bucket for storage
wrangler r2 bucket create turborepo-cache

# 4. Publish the project
wrangler deploy

# 5. Set a Bearer auth token
echo "SECRET" | wrangler secret put TURBO_TOKEN
```

## GitHub Actions Setup

If you went through the one-click deploy process, or decided to fork this repository, you will need to do some additional setup to get the GitHub actions working.

In order to successfully run the [deploy](https://github.com/AdiRishi/turborepo-remote-cache-cloudflare/blob/master/.github/workflows/deploy.yml) Github action you will need the following secrets

-   `CLOUDFLARE_API_TOKEN`
-   `CLOUDFLARE_ACCOUNT_ID`

_Note: These will be automatically set for you if you use the "Deploy with Workers" button._
