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

**The two consumers do NOT both bake `base` in the same way — this is the one place `build.ts` and `grow.ts` genuinely differ, and it matters:**

- **`build.ts`** (static output, no live HTML transform pass afterward): both `injectComponentStyles(...)` call sites (static and dynamic route loops) pass `config.base` directly, so the link is base-prefixed the only time it can be.
- **`grow.ts`**: the route-matching `if (url === '/assets/wald-components.css')` becomes `if (url === componentStylesHref(config.base))`, computed once in `run()` — this part *does* bake `config.base` in directly, because it has to match the exact URL the browser will request. But `handleRequest` does **not** pass `base` to `injectComponentStyles` — that link stays root-relative, because `vite.transformIndexHtml()` (called immediately after, on every request) already base-prefixes any root-relative `href`/`src` in the page exactly once, the same way it already does for the Vite HMR client script and everything else. Baking `config.base` into the link there *too* was tried and reverted after the PR's final holistic review caught it live: it produced a double-prefixed href (`/my-forest/my-forest/assets/wald-components.css`) that 404s in a real browser, since Vite prefixes unconditionally without checking whether a URL is already prefixed.

This closes the bug at its root for the route-matching half — there's no longer a second hardcoded copy that can drift out of sync — while respecting that the HTML-injection half of the fix has to defer to Vite's own base-handling in dev mode rather than duplicating it.

## What "exercises the real HTTP route" means here

The issue asks for a test that exercises grow's actual HTTP route, not just `handleRequest`. Rather than spinning up a live `http.Server` and making a real request (a heavier integration style nothing else in this test suite uses), the fix **extracts the exact logic the real route runs** — `componentStylesHref(base)` — into its own exported, directly-testable function, and the real route becomes a one-line call to it. Testing `componentStylesHref` directly *is* testing the real route's logic, not a parallel reimplementation of it — there's only one implementation now, and both the route and the test call it. This matches the codebase's existing testing philosophy (`handleRequest`, `matchRoute`, `scanRoutes` are all extracted top-level functions tested directly rather than through a live server).

## Canopy + scoped-CSS regression test

One new test in `build.test.ts`, modeled directly on the existing canopy tests there (`'replaces canopy placeholder data-src...'`): a component with both a `<style>` block and a `<script>` block, used with `canopy:load`. Since a component's own `<style>` scoping happens inside its own `transformWithMap()` call — the same call that produces the markup `renderComponent` embeds inside the `<wald-canopy>` wrapper — the scope attribute is already present in that markup before `applyCanopyAssets` (which only rewrites the `data-src` URL and appends the runtime `<script>`) ever runs. No production code changes needed for this part — it's a regression test confirming behavior that's already correct, per the design's own "no special handling needed" reasoning (verified during #25's final review by tracing `canopy/src/index.ts` and `renderComponent`).

## Out of scope

- A broader audit of whether `wald grow`'s other static-asset routes (`/assets/*` passthrough, `public/`) are base-aware. The issue is scoped to `wald-components.css` specifically; other routes either already flow through Vite's own base-aware middleware (they don't literally start with `/assets/` when base-prefixed, so they never hit the raw-HTTP shortcut branches at all) or are a separate, larger concern.
- Any change to `canopy-build.ts`'s own behavior — `joinUrl` is only being exported, not modified.
- **Discovered but not fixed here:** `wald grow`'s own page routing (`matchRoute`, driven by the raw incoming `req.url`) doesn't strip `config.base` at all — requesting `/my-forest/` 404s while `/` works, verified live with a real dev server under `base: '/my-forest/'`. This is a separate, pre-existing gap in `wald grow`'s base support generally (not specific to component styles, and not something this fix's scope — the `wald-components.css` link/route — touches), worth its own follow-up issue.

## Testing

- `component-styles.test.ts`: `componentStylesHref` under root and non-root base; `injectComponentStyles` builds the link from it (root base behavior unchanged from before).
- `grow.test.ts`: a `fakeVite.transformIndexHtml` stub that mimics Vite's real "prefix any root-relative href/src with base, unconditionally" behavior, confirming `handleRequest`'s output ends up correctly *single*-prefixed after the full pipeline — not just checking `handleRequest`'s own injection step in isolation, which is exactly the gap that let the double-prefix regression through code review the first time.
- `build.test.ts`: a static build under a non-root `base` produces a base-prefixed `<link href>` in the rendered HTML (the physical `dist/assets/wald-components.css` file location itself is unaffected by `base` — same as every other build asset, `base` only changes how it's *referenced*); plus the new canopy+`<style>` regression test.
