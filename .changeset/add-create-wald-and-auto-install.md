---
"@waldjs/cli": minor
---

`wald plant` now automatically installs dependencies (detecting npm/pnpm/yarn/bun via the invoking package manager) and prints the matching `dev` command, instead of always suggesting `pnpm install` regardless of how it was invoked.

Also adds the `create-wald` package, so `npm create wald@latest my-forest` works as a shorter alias for `npx @waldjs/cli plant my-forest`.
