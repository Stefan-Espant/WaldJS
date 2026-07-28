# @waldjs/cli

## 0.3.0

### Minor Changes

- a64abf7: `wald plant` (and `create-wald`) now scaffold a fully styled starter instead of unstyled HTML: a dark green gradient background, glossy red 3D buttons and cards, Baloo 2 typography, a navbar/footer, and a styled blog list — matching WaldJS's own brand. `Card` gained an optional `icon` prop; `Counter`'s behavior is unchanged, only restyled.

## 0.2.0

### Minor Changes

- 68defc0: `wald plant` now automatically installs dependencies (detecting npm/pnpm/yarn/bun via the invoking package manager) and prints the matching `dev` command, instead of always suggesting `pnpm install` regardless of how it was invoked.

  Also adds the `create-wald` package, so `npm create wald@latest my-forest` works as a shorter alias for `npx @waldjs/cli plant my-forest`.

## 0.1.1

### Patch Changes

- 2cab7f4: Fix two bugs found via a real `npm install @waldjs/cli` smoke test:

  - The CLI crashed on every command outside the monorepo because `bin/wald.js` unconditionally scanned a `src/` directory that only exists in the workspace, not in a published install.
  - Dynamic `[param].wald` routes failed to build whenever the project had more than one page, because Rollup renames the SSR chunk (e.g. `[slug].js` → `_slug_.js`) and the build step guessed the old filename instead of reading it from the actual bundle output.
