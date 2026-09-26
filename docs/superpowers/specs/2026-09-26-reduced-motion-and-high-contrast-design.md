# Reduced Motion & High Contrast Support — Design

## Motivation

Part 1 of a 3-part effort to raise the marketing site's accessibility/semantics
bar and drop Dutch-only CSS naming, requested after a manual accessibility
review found the site's Lighthouse accessibility score (94/100) and its two
concrete WCAG contrast failures (already fixed in PR #67). This sub-project
covers the two remaining, explicitly requested media-query features:
`prefers-reduced-motion` (for vestibular disorders and photosensitive
epilepsy) and `prefers-contrast: more` (for low-vision users), without
losing the site's current forest-dark visual identity.

## Current state (verified against source, not assumed)

**Reduced motion is already well-covered on the JS side:**
- `marketing/src/assets/js/animations.js`: both top-level IIFEs check
  `window.matchMedia('(prefers-reduced-motion: reduce)').matches` and
  `return` immediately, skipping every GSAP/ScrollTrigger entrance and
  scroll-reveal animation.
- `marketing/src/assets/js/forest.js`: computes `reducedMotion` once (line 8)
  and gates the day/night GSAP transition (line 422) and the main `rAF`
  render loop (line 482) on it.
- `marketing/src/assets/js/site.js`: the day/night GSAP crossfade (line 98)
  and the cursor-following firefly (`cursorvlieg`, line 229) both check the
  same media query and bail out.

**What's NOT covered — pure CSS:**
- `html { scroll-behavior: smooth }` (`01-base.css`) — unconditional.
- Every hover/focus `transition` in the codebase (`.btn`, `.btn.ghost`,
  `.lang-switch button`, `.log-kaart`, `nav`'s background-color fade,
  `#mobielmenu`'s opacity fade, etc.) — unconditional.
- No `@media (prefers-reduced-motion: reduce)` block exists anywhere in
  `marketing/src/styles/partials/`.

**High contrast: no support at all.** No `@media (prefers-contrast: ...)`
block exists. The two weakest, most contrast-sensitive tokens in
`00-tokens.css` are:
- `--rand: rgba(255, 255, 255, 0.12)` — the border color used for cards
  (`.bench`), tables, and other subtle dividers. Very low opacity, borders
  are barely visible today even at normal contrast.
- `--wit-zacht: rgba(255, 255, 255, 0.72)` — the muted/secondary text color
  used throughout (`.oms`, `.metric`, disclaimers, nav links, etc.). Already
  passes WCAG AA against the dark green background (~7.3:1, confirmed by
  hand-calculation in a prior session pass), but can go stronger for users
  who've explicitly asked their OS for more contrast.
- `.staaf.wald .label b { color: #FF6676 }` (`13-benchmarks.css`) — the
  benchmark chart's red "WaldJS" bar label. A hardcoded hex value, not a
  token, fixed in a prior PR to just clear 4.5:1 (~4.93:1) against the dark
  card background — the minimum passing bar, not a strong margin.

## Approach

### 1. Reduced motion — one blanket kill-switch rule

Add to `01-base.css` (the file that already owns the unconditional
`scroll-behavior: smooth` rule this interacts with):

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

This is the standard, widely-used pattern: it forces every CSS `transition`
and `animation` in the stylesheet to an imperceptible duration (rather than
disabling them outright, which can break JS that waits on a
`transitionend`/`animationend` event — none of this codebase's JS does that,
but the near-zero-duration approach costs nothing and is the safer default)
and forces smooth scrolling off. It requires touching only one file and
doesn't need to enumerate every individual transition/animation rule across
the ~29 CSS partials — new components added later are automatically covered
without remembering to add reduced-motion handling each time.

The already-guarded JS (GSAP, three.js, firefly) is untouched — this rule is
purely for the CSS-only motion that JS doesn't already skip.

### 2. High contrast — targeted token overrides

Add to `00-tokens.css` (which already owns every token this touches):

```css
@media (prefers-contrast: more) {
  :root {
    --rand: rgba(255, 255, 255, 0.4);
    --wit-zacht: rgba(255, 255, 255, 0.92);
  }
}
```

And in `13-benchmarks.css`, next to the existing `.staaf.wald .label b`
rule, a scoped override for the one hardcoded (non-token) weak color:

```css
@media (prefers-contrast: more) {
  .staaf.wald .label b {
    color: var(--wit)
  }
}
```

Because nearly every border, card background, and secondary-text color in
the codebase already routes through `--rand`/`--wit-zacht`, redefining just
these two custom properties under the media query propagates the contrast
boost everywhere those tokens are used — cards, tables, nav links,
disclaimers, the roadmap note, etc. — without editing each individual rule
or duplicating selectors. This matches the "targeted boost, not a new
theme" approach: colors, gradients, and the forest visual identity are
untouched; only the two specific values users have said (via their OS
setting) are too weak for them get stronger.

## Testing

- Extend `marketing/src/smoke.test.ts` (or a new small test file if that one
  is getting crowded — call the judgment at implementation time) with an
  assertion that the built `site.css` contains both new `@media` blocks
  (`prefers-reduced-motion: reduce` and `prefers-contrast: more`), so a
  future refactor can't silently drop them.
- Manual verification: `pnpm build`, then grep the built CSS for the two
  media queries and confirm the override values are present (same pattern
  used for prior CSS-only fixes this session — no browser needed, since
  this is deterministic CSS with no JS-timing component).

## Non-goals

- No change to the already-correct JS-side reduced-motion handling in
  `forest.js`/`animations.js`/`site.js`.
- No full alternate high-contrast theme (explicitly ruled out — targeted
  token boost only, per user's choice).
- No changes to semantic HTML or Dutch→English class renaming — those are
  separate sub-projects (2 and 3) that come after this one.
