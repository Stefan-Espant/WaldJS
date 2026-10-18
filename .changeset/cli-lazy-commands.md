---
"@waldjs/cli": patch
---

Faster CLI startup: commands are loaded on demand and TypeScript (needed only by `wald check` and `wald build --check`) is no longer imported by every command, saving ~300 ms per `wald build`.
