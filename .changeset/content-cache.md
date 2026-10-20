---
"@waldjs/content": minor
---

Faster content collections: parsed entries and directory listings are cached and reused until the file or folder changes (checked via modification time and size), so `getStaticPaths()` plus one `getEntry()` per page no longer re-reads and re-parses every file. On a 1,000-post site this cuts page rendering in `wald build` from ~1.2 s to ~0.16 s. `wald grow` still picks up every edit. Each call now also returns its own copy of an entry, so one page mutating `entry.data` can no longer affect another.
