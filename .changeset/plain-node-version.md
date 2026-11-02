---
'@turborepo-remote-cache/api': minor
---

Fix the first build after the Deploy to Cloudflare button. Workers Builds could not install Node.js from `.nvmrc`, which named the `lts/krypton` alias. `.nvmrc` now names Node.js 26, the current LTS.
