# @waldjs/compiler

## 0.5.0

### Minor Changes

- b0c0f4b: `wald check` now types dynamic route params as strings: in `src/pages/blog/[slug].wald`, `$$props.slug` is a `string` instead of `unknown`, so the documented `getEntry(collection, $$props.slug)` pattern type-checks without casts. The compiler gains a `routeParams` transform option for this; files with their own `type Props` are unchanged.

### Patch Changes

- 4f85c7d: Fix multi-line imports in `.wald` frontmatter: an import spanning several lines (e.g. `import {\n  a,\n} from './x'`, or with `from` on its own line) is now hoisted as a whole statement instead of compiling to invalid JS.

## 0.4.1

### Patch Changes

- efcee5d: Improve npm package metadata: clearer descriptions, keywords, and `homepage` / `bugs` links, so the packages are easier to find on npm.
- Updated dependencies [efcee5d]
  - @waldjs/runtime@0.1.1

## 0.4.0

### Minor Changes

- 1cf2d6c: Add `Wald.generator`: every compiled `.wald` module now has a built-in `Wald` object whose `generator` is `"WaldJS v<cli version>"`, and the `wald plant` starter layout emits `<meta name="generator" content={Wald.generator} />`. `wald --version` now reports the real CLI version instead of a hardcoded `0.1.0`.

## 0.3.0

### Minor Changes

- a5e65ec: Add a built-in, idempotent formatter for `.wald` files. Use the exported `format()` compiler API or run `wald format`; `wald format --check` verifies formatting without writing and returns a failing exit status for CI.

## 0.2.0

### Minor Changes

- a90e3e9: Add a `<style>` block to any `.wald` file to write CSS scoped to that component's own markup — every element it renders gets a `data-wald-<hash>` attribute, and its selectors are rewritten to match only elements carrying that attribute. `wald grow` and `wald build` both bundle every component's scoped CSS into a single `/assets/wald-components.css`, linked automatically into any page that actually renders a styled component.
