---
"@waldjs/cli": minor
---

`wald grow` no longer crashes when port 7233 is already taken (for example by another project's dev server): it moves on to the next free port and says so. Pass `--port <n>` to pick a port explicitly. Render errors in the terminal now show the actual message, file and code frame instead of `[object Object]`.
