# create-wald

## 0.1.9

### Patch Changes

- Updated dependencies [d225d82]
- Updated dependencies [6869670]
  - @waldjs/cli@0.7.0

## 0.1.8

### Patch Changes

- Updated dependencies [a90e3e9]
  - @waldjs/cli@0.6.0

## 0.1.7

### Patch Changes

- Updated dependencies [cf624f2]
  - @waldjs/cli@0.5.0

## 0.1.6

### Patch Changes

- Updated dependencies [47d0ed8]
- Updated dependencies [7883e62]
- Updated dependencies [ac374e0]
- Updated dependencies [ece732d]
  - @waldjs/cli@0.4.0

## 0.1.5

### Patch Changes

- Updated dependencies [1ee3bed]
  - @waldjs/cli@0.3.2

## 0.1.4

### Patch Changes

- Updated dependencies [752e105]
  - @waldjs/cli@0.3.1

## 0.1.3

### Patch Changes

- Updated dependencies [a64abf7]
  - @waldjs/cli@0.3.0

## 0.1.2

### Patch Changes

- 01a22b6: Fix `npm create wald@latest` crashing with ENOENT on a fresh install. The bin script assumed `@waldjs/cli`'s `wald` binary would always be symlinked into `create-wald`'s own `node_modules/.bin/`, which holds for pnpm's isolated layout but not for npm's flat hoisting — `npx create-wald` failed for every npm user. Now resolves `@waldjs/cli` via Node's own module resolution instead of guessing a directory layout.

## 0.1.1

### Patch Changes

- Updated dependencies [68defc0]
  - @waldjs/cli@0.2.0
