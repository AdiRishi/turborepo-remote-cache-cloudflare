---
layout: doc
---

# ▲ Setting up remote caching in your Turborepo project

Here's my recommended approach for setting up remote caching in your Turborepo project. You can read more about this topic in the [official Turborepo documentation](https://turbo.build/repo/docs/core-concepts/remote-caching).

## Step 1: Update `turbo.json`

Modify the `turbo.json` file at your project root to include [signature validation](https://turbo.build/repo/docs/core-concepts/remote-caching#artifact-integrity-and-authenticity-verification)

```json
{
    "remoteCache": { "signature": true }
}
```

## Step 2: Install `dotenv-cli`

Install the `dotenv-cli` npm package:

```sh
# You may have to add -W if you are installing this on your workspace root
pnpm add -D dotenv-cli
```

## Step 3: Create a `.env` File

Create a `.env` file at your project root with the following content:

```
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

## Step 4: Modify Turbo Commands

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
