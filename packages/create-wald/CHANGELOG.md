# create-wald

## 0.1.2

### Patch Changes

- 01a22b6: Fix `npm create wald@latest` crashing with ENOENT on a fresh install. The bin script assumed `@waldjs/cli`'s `wald` binary would always be symlinked into `create-wald`'s own `node_modules/.bin/`, which holds for pnpm's isolated layout but not for npm's flat hoisting — `npx create-wald` failed for every npm user. Now resolves `@waldjs/cli` via Node's own module resolution instead of guessing a directory layout.

## 0.1.1

### Patch Changes

- Updated dependencies [68defc0]
  - @waldjs/cli@0.2.0
