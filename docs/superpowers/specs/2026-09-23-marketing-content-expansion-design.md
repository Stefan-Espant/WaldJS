# Marketing Site — Content Expansion (Comparison Pages + Changelog) — Design

## Motivation

The third of three SEO sub-projects (after "technical basics", PR #61, and
"defer render-blocking scripts", PR #62). The marketing site is a single
page today — no separate URLs for search engines to index beyond `/`. This
sub-project adds real, indexable pages: two comparison landing pages
(`/vs/astro`, `/vs/eleventy`) targeting concrete search intent, and a
`/changelog` section that turns the homepage's static, buried changelog list
into individually-indexable pages.

**Explicitly not in scope:** this is not issue [#26](https://github.com/Stefan-Espant/WaldJS/issues/26)
("Dedicated documentation site") — that's a separate, much larger initiative
(API reference, guides, etc.) tracked on its own. This sub-project is
marketing/content pages only.

## Architecture

### 1. Shared `Layout.wald` (foundational — everything else depends on this)

The site becomes genuinely multi-page for the first time. Today, all
`<head>` boilerplate (canonical, OG/Twitter meta, JSON-LD, favicon, font
preconnects, the `defer`red CDN scripts from PR #62, the inline
language-bootstrap script) lives only in `marketing/src/pages/index.wald`.
New pages need the same structure with page-specific `title`/`description`/
canonical URL.

New `marketing/src/layouts/Layout.wald`, accepting props:
```ts
type Props = {
  title: string
  description: string
  canonicalPath: string // e.g. '/', '/vs/astro', '/changelog'
  pond: unknown // children, per WaldJS's layout convention
}
```
Contains everything currently hardcoded in `index.wald`'s `<head>` plus the
`<Nav>`/`<Footer>` wrapper, with `title`/`description`/canonical built from
the props instead of hardcoded strings. The JSON-LD stays `SoftwareApplication`
on every page (it describes the product, not the specific page) with `url`
set to the page's own canonical.

`index.wald` becomes the first consumer of this layout; its existing
section components (`<Hero>`, `<Quickstart>`, etc.) become the layout's
children.

### 2. Comparison pages: `/vs/astro`, `/vs/eleventy`

New `marketing/src/pages/vs/astro.wald` and `marketing/src/pages/vs/eleventy.wald`,
both using `<Layout>`. Each page:
- A short hero (`<h1>WaldJS vs Astro</h1>` style, distinct per page)
- The existing comparison table (from `Vergelijking.wald`), reused —
  either by extracting it into its own component parameterized by which
  competitor column to emphasize, or duplicated with the relevant column
  highlighted (implementation detail for the plan to decide based on how
  much the table structure needs to flex per page)
- A written "When to choose WaldJS" / "When \<competitor\> might be the
  better fit" section — honest, concrete trade-offs, not one-sided marketing
  copy

**Content-accuracy note:** the written comparison sections are marketing
copy about competing tools — tone and factual fairness matter more than
typical internal docs. The implementer should draft reasonable first-pass
copy grounded in what the existing comparison table already asserts, but
this should be treated as a draft for the user to review/edit before the
PR is considered ready to merge, not final copy to ship unreviewed.

Nav/discovery: comparison pages are linked from the footer (secondary
discovery, matching how comparison/landing pages are typically surfaced —
not central primary-nav real estate) rather than the main `<Nav>`.

### 3. Changelog: homepage section → `content/changelog/` + `/changelog` pages

**Content migration:** the 8 existing entries in `Changelog.wald` (Roots,
Seed, Sapling, Branches, "Forest" [Vite pipeline, June], Canopy, Forest
Polish, "Forest" [deployment adapters, July]) move to
`marketing/content/changelog/*.md`, one file per entry, content preserved
verbatim (the existing `<span class="nl">`/`<span class="en">` bilingual
markup survives unchanged — Markdown passes raw HTML through, so no new
i18n mechanism is needed).

Each file's frontmatter:
```yaml
---
title: "Forest"
date: 2026-07-30       # assigned within the entry's stated month, for sort order —
                        # the source only ever gave month-level precision
dateLabel: "juli 2026"  # what's actually shown in the UI — no fabricated day precision
---
```
The two "Forest"-titled entries get distinct filenames (e.g.
`forest-vite-pipeline.md` for June, `forest-deployment-adapters.md` for
July) since filenames become slugs — `title` can legitimately repeat across
entries (both really were called "Forest" as milestone names), only the
slug needs to be unique.

**Routes:**
- `marketing/src/pages/changelog/index.wald` — lists all entries via
  `getCollection('changelog')`, sorted by `date` descending, each linking to
  its own detail page.
- `marketing/src/pages/changelog/[slug].wald` — one entry's full content via
  `getEntry('changelog', $$props.slug)` + `getStaticPaths()` returning all
  slugs from the collection.

**Homepage change:** `Changelog.wald` (the homepage section) is trimmed to
show only the 2-3 most recent entries (by `date`), with a "bekijk alle
updates" / "see all updates" link to `/changelog`. The full historical list
no longer lives on the homepage — `/changelog` is the single source of
truth.

Nav/discovery: `/changelog` is added to the main `<Nav>` (it already has a
`#changelog` anchor link today, which becomes a real page link to
`/changelog` instead of an in-page anchor).

## Testing

Extend `marketing/src/smoke.test.ts` (existing "build once, assert on real
`dist/` output" pattern) with:
- `dist/vs/astro/index.html` and `dist/vs/eleventy/index.html` exist, each
  with its own distinct `<title>` and `<link rel="canonical">`.
- `dist/changelog/index.html` exists and links to all 8 individual entry
  pages.
- Each `dist/changelog/<slug>/index.html` exists (8 total).
- The homepage's changelog section shows only the trimmed count, not all 8.
- `dist/sitemap.xml` includes all the new routes, including the 8 dynamic
  `/changelog/<slug>` pages.

**Correction, found while writing the implementation plan:** the sentence
that used to be here claimed PR #61's `build-sitemap.mjs` would pick up the
new dynamic changelog routes automatically with no changes needed. That's
wrong — that script explicitly filters OUT any route containing a `[param]`
segment (there was no way to resolve dynamic routes to real URLs from
`src/pages/` source files alone at the time it was written), which would
silently exclude all 8 `/changelog/<slug>` pages from the sitemap. The
implementation plan's Task 2 reworks `build-sitemap.mjs` to scan the
*built* `dist/` directory instead of `src/pages/` source — since `dist/`
only ever contains real, already-resolved pages, this picks up dynamic
routes for free without reimplementing route resolution, and is simpler
code than the source-scanning approach it replaces.

## Non-goals

A general-purpose blog system for arbitrary future post types, a CMS,
pagination on the changelog index (8-and-growing entries on one page is
fine for now), and anything covered by issue #26's documentation site.
