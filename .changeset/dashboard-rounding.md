---
'@turborepo-remote-cache/api': patch
---

The dashboard rounds durations, sizes, and ages into the right unit. 59.6 seconds now reads `1m 0s`, not `60s`. 999,950 bytes reads `1 MB`, not `1,000 KB`. A snapshot 59.5 minutes old reads "59 minutes ago", not "60 minutes ago".
