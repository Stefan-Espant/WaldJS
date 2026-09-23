# Marketing Site — Sharper Positioning (USPs, not "just Astro") — Design

## Motivation

WaldJS's own comparison table (`Vergelijking.wald`, reused on `/vs/astro` and
`/vs/eleventy`) shows exactly one WaldJS-exclusive row: "Bos-terminologie"
(forest terminology) — branding, not substance. Structurally, WaldJS reads
as "Astro with a forest theme." The goal here isn't new features — it's
telling the story of what's genuinely already different, in a way that (a)
doesn't read as "yet another framework" fatigue-bait, and (b) doesn't
implicitly frame WaldJS as Astro-derivative by constantly gesturing at Astro.

## The four USPs (grounded in what's actually verifiable in this codebase)

1. **~85x faster builds** — `benchmarks/benchmark.html`'s own measured data:
   WaldJS 1.62s vs. Astro 138.92s for an identical 50-post blog site. A
   measured number, not a marketing claim.
2. **No framework lock-in for interactivity** — canopy islands
   (`canopy:load`/`canopy:idle`/`canopy:visible`) are plain JS/TS modules,
   no React/Vue/Svelte adapter required or supported. Reframed from a gap
   (per the existing comparison table) into a deliberate choice.
3. **One small format, nothing else to install** — `.wald` is frontmatter +
   template in a single file; `wald format` (built-in formatter) and
   `wald grow`'s readable dev-server error pages ship with the CLI, no
   separate Prettier config or plugin needed.
4. **(Supporting, softer) Consistent naming as a mental model** — roots
   (compiler) → trees (pages) → branches (components) → canopies
   (hydration) → plant/grow/build/preview (CLI lifecycle). Framed as an
   aid to learnability, not just branding.

Deliberately NOT claimed as USPs (shared with Astro, already honestly listed
in the comparison table): 0 KB JS by default, content collections,
file-based routing, `getStaticPaths()`, Vite integration.

## Tone requirements (from user discussion, not just content — this shapes *how* it's written, not just *what*)

- **Acknowledge framework fatigue directly, briefly, once** — an honest
  opening line ("yet another framework — we know") that immediately pivots
  to something concrete, rather than avoiding the topic or overselling with
  hype language.
- **Lead with low-commitment framing**: how little there is to learn/give
  up to try it (one file format, no tooling sprawl, easy to walk away from)
  — this targets "ugh, another thing to learn" fatigue specifically, not
  just "why is this better than Astro."
- **No comparison structure, no competitor mentions, on the new page** —
  `/waarom` tells WaldJS's own story on its own terms. A page that keeps
  gesturing at Astro *reinforces* "this is just Astro"; a page that doesn't
  need to mention Astro at all reads as having its own identity. Comparison
  stays scoped to `/vs/astro`/`/vs/eleventy`, which exist specifically for
  people already in comparison-shopping mode.

## Architecture

### 1. New page `/waarom` ("why WaldJS")

New `marketing/src/pages/waarom.wald`, using the existing `Layout` (title/
description/canonicalPath="/waarom"). Structure (bilingual nl/en spans
throughout, matching every other page's convention):

- Short opening acknowledging framework fatigue, pivoting immediately to
  the low-commitment framing (one format, nothing to install, easy to try).
- Three sections, one per primary USP (speed, no lock-in, one small
  format+built-in-tooling), each with a concrete number/fact, not vague
  claims.
- A closing CTA reusing the existing "get started" pattern from the
  homepage (`npm create wald@latest`).

No comparison table, no `<Vergelijking />` reuse, no named competitors.

### 2. Sharpen `/vs/astro`'s "Kies WaldJS als je..." bullets

`marketing/src/pages/vs/astro.wald` already has a "Wanneer kies je wat?"
split section (added in the content-expansion PR). Its current WaldJS-side
bullets are generic ("smaller format," "no adapters needed"). Replace with
the two sharper points from the USP list that are directly relevant to an
Astro-comparing visitor: the build-speed number (concrete, comparative,
exactly what this specific page's audience wants) and the no-lock-in framing
stated more assertively (a deliberate choice, not an apology). This page
keeps its comparison structure — only the bullet wording changes, not the
page's shape.

### 3. Cross-linking

- `/waarom` added to `Nav.wald` and `Footer.wald` (as an absolute path,
  consistent with the `/changelog`, `/vs/astro`, `/vs/eleventy` precedent
  already in both files).
- `/vs/astro` and `/vs/eleventy` each get one line linking to `/waarom` for
  visitors who want the non-comparison version of the story (e.g. after
  their "when to choose which" section).
- Homepage hero/tagline: explicitly untouched, per direct user instruction.

## Testing

Extend `marketing/src/smoke.test.ts` with:
- `dist/waarom/index.html` exists, has its own distinct `<title>`/canonical.
- `dist/waarom/index.html` does NOT mention "Astro" or "Eleventy" by name
  (a direct, automated check on the "no comparison framing" tone
  requirement — the one part of this design's tone guidance that's
  actually machine-checkable).
- `dist/sitemap.xml` includes `/waarom`.
- `/vs/astro`'s rebuilt page still passes the existing Task 4 smoke test
  (distinct title/canonical) — no regression from the bullet-copy change.

## Content-accuracy note (same caveat as the content-expansion PR)

The `/waarom` page and the sharpened `/vs/astro` bullets are marketing copy
— a first draft grounded in this session's verified facts (benchmark
numbers, canopy's actual constraints, what `wald format`/error pages
actually do), not independently fact-checked beyond that. Needs human
review for tone before merge, same as the comparison pages' copy already
does in the content-expansion PR.

## Non-goals

New technical features (explicitly out of scope per the user's own scoping
decision), homepage hero/tagline changes, a dedicated niche/audience pivot.
