# @waldjs/compiler

## 0.3.0

### Minor Changes

- a5e65ec: Add a built-in, idempotent formatter for `.wald` files. Use the exported `format()` compiler API or run `wald format`; `wald format --check` verifies formatting without writing and returns a failing exit status for CI.

## 0.2.0

### Minor Changes

- a90e3e9: Add a `<style>` block to any `.wald` file to write CSS scoped to that component's own markup — every element it renders gets a `data-wald-<hash>` attribute, and its selectors are rewritten to match only elements carrying that attribute. `wald grow` and `wald build` both bundle every component's scoped CSS into a single `/assets/wald-components.css`, linked automatically into any page that actually renders a styled component.
