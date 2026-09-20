# Scoped component CSS

Implements issue [#25](https://github.com/Stefan-Espant/WaldJS/issues/25).

## Problem

All styling in a WaldJS project lives in one global stylesheet (`src/assets/css/global.css`). There's no way to write CSS local to a single `.wald` component — unlike Vue SFCs or Astro components — so any component-specific rule risks leaking onto (or colliding with) unrelated markup elsewhere on the page.

## Goal

Support a `<style>` block inside a `.wald` file that the compiler automatically scopes to that component's own markup, without a build-time CSS-in-JS runtime and without adding a new dependency to the compiler.

## Approach

**Selector scoping — hand-rolled tokenizer, no new dependency.** Considered pulling in `postcss` + `postcss-selector-parser` for full CSS-grammar correctness, but the compiler currently hand-rolls its own HTML/template scanner (`parser/scanner.ts`) with zero parsing dependencies — a small, well-tested tokenizer for the bounded subset of CSS this needs (rule lists, comma-separated selectors, combinators, pseudo-classes/elements, `@media`/`@supports` nesting, opaque passthrough for `@keyframes`/`@font-face`/`@page`) keeps that consistency and stays fully within our own test suite.

**Scope key — hash of the file path**, not the style content. The same component always gets the same scope id regardless of edits to its CSS, so there's no churn/cache-invalidation concern. Computed via `node:crypto`'s `sha256(fileId).slice(0, 8)` — a Node built-in, not a new dependency.

**No bleed to children.** A component's scope attribute is only added to elements written in its *own* template — not to `pond`/slotted children passed in from a parent, and not to a child component's own markup (which is rendered by the child's own compiled module, carrying the child's own scope hash). This means Canopy islands need no special handling: hydration doesn't touch server-rendered markup, so the scope attribute already in the SSR output survives untouched.

**Output — one bundled CSS file, not inline `<style>`.** A page that uses styled components links a real stylesheet (`/assets/wald-components.css`) rather than getting the CSS inlined into every response.

## Compiler changes (`@waldjs/compiler`)

- `parser/scanner.ts`: recognize a top-level `<style>` block the same way `<script>` is recognized today (`isScriptTag`/`scanScript` → new `isStyleTag`/`scanStyle`). Its content is lifted out to `WaldDocument.styles: string | null` instead of staying in the template node list, so it's never rendered inline. A second `<style>` block in the same file is a compile error (`WaldError`) — one block per component, like a Vue SFC.
- New `scope-css.ts`: `scopeCss(css: string, hash: string): string`. Walks the stylesheet rule by rule:
  - Plain rules: for each comma-separated selector, append `[data-wald-<hash>]` to the last compound segment, inserted before any pseudo-class/element (`.card:hover` → `.card[data-wald-<hash>]:hover`; `.card .title` → `.card .title[data-wald-<hash>]`; `.card > .title` → `.card > .title[data-wald-<hash>]`).
  - `@media`/`@supports`/`@layer`: recurse into the block's body; the condition itself is untouched.
  - `@keyframes`/`@font-face`/`@page`/`@import`/`@charset`: passed through verbatim — their selectors (`from`/`to`/percentages, or none) aren't element selectors and must not be scoped.
- `transformWithMap(ast, fileId)` gains the `fileId` parameter (already available at every call site via `compile(source, id)`). When `ast.styles` is non-null:
  - computes the scope hash and calls `scopeCss`
  - adds `data-wald-<hash>` to every `ElementNode` this component's own `renderElement` emits
  - returns the scoped CSS as a new `styles: string | null` field on `TransformResult`, alongside the existing `code`/`lineMap`
- `compile`/`compileWithMap` pass the field through. This is additive — `checker.ts`, which already destructures `{ code, lineMap }` from `compileWithMap`, is unaffected.

## CLI changes (`@waldjs/cli`)

- New `style-scan.ts`, mirroring the existing `canopy-scan.ts` pattern: `collectComponentStyles(srcDir): string` walks every `.wald` file under `src/` (reusing the existing `walkWaldFiles` traversal), compiles each, and concatenates the non-null `styles` results into one bundle string.
- Per-page link injection reuses the exact pattern `injectPrefetchRuntime`/`needsPrefetchRuntime` already use for `wald:prefetch`: a component's scope attribute (`data-wald-[0-9a-f]{8}`) is detectable directly in a page's rendered HTML, so `needsComponentStyles(html)` tests for that pattern and `injectComponentStyles(html)` inserts `<link rel="stylesheet" href="/assets/wald-components.css">` before `</head>` only when the page actually used a styled component.
- **`wald build`**: `collectComponentStyles()` runs once; if the result is non-empty it's written to `dist/assets/wald-components.css`. A project with no `<style>` blocks gets no new file and no new bytes anywhere in its output — fully additive.
- **`wald grow`**: a new branch in the raw HTTP handler intercepts `GET /assets/wald-components.css` (checked before the existing generic `/assets/*` → `sirv(srcDir)` passthrough, since this path doesn't correspond to a real file under `src/assets`) and responds with `collectComponentStyles()` computed fresh for that request — the same "recompute every request" tradeoff `scanRoutes()` already makes for simplicity. An edit to a component's `<style>` block already triggers a full browser reload via the existing `.wald` → full-reload HMR path, so the browser's next fetch of that URL naturally picks up the change; no separate cache-invalidation logic needed.

## Out of scope

- A `:deep()`/`::slotted`-style escape hatch for intentionally targeting child/slotted markup from a parent's scoped styles.
- A `:global(...)` escape hatch for intentionally unscoped rules inside a component's `<style>` block.
- Adding an example `<style>` block to the `wald plant` scaffold starter template.

All three are reasonable follow-ups but aren't required by #25's acceptance criteria.

## Testing

- `scanner.test.ts`: `<style>` block extraction, and the compile error on a second block.
- `scope-css.test.ts` (new): simple/compound/comma-separated selectors, combinators, pseudo-classes/elements, `@media` nesting, `@keyframes`/`@font-face` passthrough.
- `transform/index.test.ts`: scope attribute applied to a component's own elements (and only those) when a style block is present; `styles` is `null` when absent.
- `style-scan.test.ts` (new): bundles styles from multiple components, skips components with no style block.
- `build.test.ts` / `grow.test.ts`: bundle file written and linked only on pages using styled components; unstyled projects produce no new file and no `<link>`.
