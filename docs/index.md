---
# https://vitepress.dev/reference/default-theme-home-page
layout: home

hero:
    name: Turborepo Remote Cache
    text: Cloudflare-first, deploy anywhere.
    tagline: A straightforward self-hosted cache with Cloudflare defaults, portable Nitro builds, and flexible Files SDK storage.
    image: https://public-assets.turborepo-remote-cache.dev/cdn-cgi/image/width=320,quality=80,format=auto/images/logo.png
    actions:
        - theme: brand
          text: Deploy on Cloudflare
          link: /introduction/getting-started
        - theme: alt
          text: View on GitHub
          link: https://github.com/AdiRishi/turborepo-remote-cache-cloudflare

features:
    - icon: ☁️
      title: Cloudflare-first
      details: Clone, create an R2 bucket, and deploy with Wrangler. Cloudflare Workers remains the default and best-supported path.
    - icon: 🪣
      title: Flexible storage
      details: Select R2, KV, or S3 using environment configuration, with no application code changes.
    - icon: 🌍
      title: Deploy anywhere
      details: Nitro provides portable builds for Node and other supported deployment presets.
    - icon: 🧩
      title: Extensible by design
      details: Use a typed configuration escape hatch for another Files SDK adapter without growing the built-in provider registry.
---
