# Marketing Site — Defer Render-Blocking Scripts — Design

## Motivation

The second of three SEO sub-projects (after "technical basics", PR #61).
Google's ranking factors include Core Web Vitals, and the marketing site's
`<head>` loads `three.js` (r128), `gsap.min.js`, and `ScrollTrigger.min.js` as
plain synchronous `<script src="...">` tags — each one blocks HTML parsing
until it's downloaded and executed, delaying First Contentful Paint.

## Scope

In scope: eliminating render-blocking script execution on the marketing
site's single page, without changing any visible behavior.

Out of scope: image optimization (the page has no `<img>`/`wald:image` usage
today — text and a 3D canvas background only, so there's no LCP image to
address), and lazy-loading `three.js` itself (considered, explicitly declined
in favor of the simpler, lower-risk `defer` approach — see below).

## Architecture

### Why the current order matters (and why plain `defer` alone isn't enough for the head scripts)

`marketing/src/pages/index.wald` currently loads, in this order:
1. `<head>`: `three.js`, `gsap.min.js`, `ScrollTrigger.min.js` — plain
   blocking scripts.
2. End of `<body>`: `site.js`, `forest.js`, `animations.js` — also plain
   blocking scripts, which is why this works today: by the time the parser
   reaches them, the `<head>` scripts have already run synchronously, so
   `THREE`/`gsap`/`ScrollTrigger` already exist as globals.

`forest.js` (the 3D canvas scene) guards itself with `if (!canvas || typeof
THREE === 'undefined') return;` — it degrades silently rather than throwing,
but if `THREE` isn't defined *by the time this line runs*, the 3D background
simply never initializes.

**The fix must defer all six scripts together, not just the three in
`<head>`.** `defer` scripts execute in document order, but only after the
entire document has finished parsing (right before `DOMContentLoaded`) — if
only the `<head>` scripts got `defer` and the `<body>`-end scripts stayed
plain/blocking, the body-end scripts would run *during* parsing (before the
deferred head scripts have had a chance to run at all), and `forest.js` would
silently fail its own guard, breaking the 3D background. Deferring all six
preserves their relative execution order exactly as it is today, just moved
to after parsing instead of interleaved with it.

### What stays as-is

- The inline `data-wald-no-hoist` language-detection script (sets
  `document.documentElement.lang` before first paint, to avoid a
  flash-of-wrong-language) — this is *intentionally* blocking and must stay
  that way; not part of this change.
- The `gtag` scripts — already `async`, no change needed.

### Why not lazy-load `three.js` instead

Considered and explicitly declined by the user in favor of the simpler `defer`
approach: lazy-loading `three.js` (e.g. after the `load` event or via
`requestIdleCallback`) would remove more script weight from the critical
path, but introduces a visible delay before the 3D forest background
appears — a real UX trade-off for a bigger win. `defer` gets the main
render-blocking benefit (the browser can parse and paint the actual HTML/CSS
without waiting on ~150KB+ of JS) with zero behavior change and no visible
delay, since deferred scripts still all run before `DOMContentLoaded`, same
as today's effective timing for the body-end scripts.

## Testing

Extend `marketing/src/smoke.test.ts` (existing "build once, assert on real
`dist/` output" pattern) with an assertion that all six script tags
(`three.min.js`, `gsap.min.js`, `ScrollTrigger.min.js`, `site.js`,
`forest.js`, `animations.js`) carry a `defer` attribute in the built
`dist/index.html`, and that the inline language-detection script does
*not* (to lock in that it deliberately stays blocking).

## Non-goals

Image optimization, lazy-loading, code-splitting, or any other performance
work beyond eliminating render-blocking script execution.
