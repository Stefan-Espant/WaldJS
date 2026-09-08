# Base-aware component styles + canopy regression test

Implements issue [#41](https://github.com/Stefan-Espant/WaldJS/issues/41), a follow-up from #25's final review.

## Problem

`injectComponentStyles()` hardcodes the stylesheet link as `/assets/wald-components.css`. Under a non-root `config.base` (e.g. `/my-forest/` for a GitHub Pages project page), the link 404s in `wald build` output, and — worse — `wald grow`'s raw HTTP route only matches the literal unprefixed path, so the base-prefixed request the browser actually makes 404s in dev too. Separately, no test pins down the design's claim that a component using both `<style>` and `canopy:*` keeps its scope attribute after the canopy wrapper is applied.

## Root cause

Two independent copies of the same path (`/assets/wald-components.css`) existed in the codebase — one in `injectComponentStyles`'s injected `<link>`, one in `grow.ts`'s route-matching `if`. Neither was base-aware, and because they were separate hardcoded literals rather than one shared computation, there was no structural guarantee they'd even stay in sync with each other, let alone with `config.base`.

## Fix — one shared, base-aware path function

Add to `packages/cli/src/component-styles.ts`:

```ts
import { joinUrl } from './canopy-build.js'

export function componentStylesHref(base: string): string {
  return joinUrl(base, 'assets/wald-components.css')
}
```

(`joinUrl` already exists in `canopy-build.ts`, doing exactly this for canopy's own runtime script — just needs to be exported instead of file-private.)

`injectComponentStyles(html, base)` and `needsComponentStyles` stay in the same file; `injectComponentStyles` now takes a `base` parameter (defaulting to `'/'`, so every existing call site and test that doesn't care about base keeps compiling and passing unchanged — `joinUrl('/', 'assets/wald-components.css')` produces the exact same `/assets/wald-components.css` string the hardcoded version always did) and builds its `<link>` from `componentStylesHref(base)` instead of a literal.

**Both consumers call the same function:**
- `grow.ts`: the route-matching `if (url === '/assets/wald-components.css')` becomes `if (url === componentStylesHref(config.base))`, computed once in `run()`. `handleRequest` gains a `base = '/'` parameter, threaded to `injectComponentStyles`.
- `build.ts`: both `injectComponentStyles(...)` call sites (static and dynamic route loops) pass `config.base`.

This closes the bug at its root — there's no longer a second hardcoded copy that can drift out of sync, in either file, ever again.

## What "exercises the real HTTP route" means here

The issue asks for a test that exercises grow's actual HTTP route, not just `handleRequest`. Rather than spinning up a live `http.Server` and making a real request (a heavier integration style nothing else in this test suite uses), the fix **extracts the exact logic the real route runs** — `componentStylesHref(base)` — into its own exported, directly-testable function, and the real route becomes a one-line call to it. Testing `componentStylesHref` directly *is* testing the real route's logic, not a parallel reimplementation of it — there's only one implementation now, and both the route and the test call it. This matches the codebase's existing testing philosophy (`handleRequest`, `matchRoute`, `scanRoutes` are all extracted top-level functions tested directly rather than through a live server).

## Canopy + scoped-CSS regression test

One new test in `build.test.ts`, modeled directly on the existing canopy tests there (`'replaces canopy placeholder data-src...'`): a component with both a `<style>` block and a `<script>` block, used with `canopy:load`. Since a component's own `<style>` scoping happens inside its own `transformWithMap()` call — the same call that produces the markup `renderComponent` embeds inside the `<wald-canopy>` wrapper — the scope attribute is already present in that markup before `applyCanopyAssets` (which only rewrites the `data-src` URL and appends the runtime `<script>`) ever runs. No production code changes needed for this part — it's a regression test confirming behavior that's already correct, per the design's own "no special handling needed" reasoning (verified during #25's final review by tracing `canopy/src/index.ts` and `renderComponent`).

## Out of scope

- A broader audit of whether `wald grow`'s other static-asset routes (`/assets/*` passthrough, `public/`) are base-aware. The issue is scoped to `wald-components.css` specifically; other routes either already flow through Vite's own base-aware middleware (they don't literally start with `/assets/` when base-prefixed, so they never hit the raw-HTTP shortcut branches at all) or are a separate, larger concern.
- Any change to `canopy-build.ts`'s own behavior — `joinUrl` is only being exported, not modified.

## Testing

- `component-styles.test.ts`: `componentStylesHref` under root and non-root base; `injectComponentStyles` builds the link from it (root base behavior unchanged from before).
- `grow.test.ts`: `handleRequest` injects a base-prefixed link when a non-default `base` is passed.
- `build.test.ts`: a static build under a non-root `base` produces a base-prefixed `<link href>` in the rendered HTML (the physical `dist/assets/wald-components.css` file location itself is unaffected by `base` — same as every other build asset, `base` only changes how it's *referenced*); plus the new canopy+`<style>` regression test.
