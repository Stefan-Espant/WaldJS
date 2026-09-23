# Marketing Site — Technical SEO Basics — Design

## Motivation

The marketing site (`marketing/`, deployed at `https://waldjs.steefan.nl`) has only
minimal SEO groundwork: a title, description, and a few Open Graph tags. It has
no canonical URL, no `og:image`/`twitter:image`, no structured data, no
`robots.txt`, and no `sitemap.xml`. This is the first of three sub-projects to
improve the site's SEO (the other two — Core Web Vitals/performance, and
expanding beyond a single page — are separate, later efforts). This one covers
the technical fundamentals: the things search engines and link-preview crawlers
expect to find regardless of how much content the site eventually has.

## Scope

In scope: canonical URL, expanded Open Graph/Twitter Card meta, a JSON-LD
structured-data block, `robots.txt`, a build-time-generated `sitemap.xml`, and
a new OG-image asset.

Explicitly out of scope (deferred to later sub-projects, or intentionally
dropped):
- **`hreflang` tags** — the site's nl/en toggle is client-side (`<span
  class="nl">`/`<span class="en">` pairs switched via CSS/JS driven by
  `localStorage`), not separate URLs per language. `hreflang` exists to point
  search engines at *separate URLs* for each language variant; there are none
  here, so it doesn't apply. The existing `lang="nl"` on `<html>` (matching
  what's actually server-rendered) is already correct and needs no change.
- **Core Web Vitals / render-blocking scripts** (three.js, GSAP loaded via
  `<script>` tags in `<head>`) — a separate sub-project.
- **Additional pages/content** — a separate sub-project; this one's sitemap
  generation is built to not need revisiting when that lands (see below).

## Architecture

### 1. Expanded `<head>` meta in `marketing/src/pages/index.wald`

Additive changes to the existing `<head>` block:
- `<link rel="canonical" href="https://waldjs.steefan.nl/">`
- `<meta property="og:url" content="https://waldjs.steefan.nl/">`
- `<meta property="og:image" content="https://waldjs.steefan.nl/assets/og-image.png">`
  plus `og:image:width` (1200) / `og:image:height` (630)
- `<meta name="twitter:card" content="summary_large_image">` (replacing the
  current `summary`) and a matching `<meta name="twitter:image" ...>`
- No `twitter:site`/`twitter:creator` — the project has no X/Twitter account
  (only GitHub), so these would be inaccurate to include.

### 2. JSON-LD structured data

One `<script type="application/ld+json">` block added to `<head>`, containing
a `SoftwareApplication` node (name, description, `applicationCategory:
"DeveloperApplication"`, `url`, `operatingSystem: "Cross-platform"`, an
`author`/`Organization` reference pointing at the GitHub repo) — the schema
type search engines use for rich results on developer tools/frameworks
(matching how comparable tools like Astro/Vite mark themselves up).

### 3. `robots.txt`

New static file, `marketing/public/robots.txt`:
```
User-agent: *
Allow: /

Sitemap: https://waldjs.steefan.nl/sitemap.xml
```

### 4. `sitemap.xml` — generated at build time, not hand-written

A new script, `marketing/scripts/build-sitemap.mjs`, following the same
pattern as the existing `marketing/scripts/build-css.js`: it scans
`src/pages/**/*.wald` and derives each file's route with the same rule
`@waldjs/cli`'s real router uses (`packages/cli/src/router/index.ts`'s
`fileToRoute`): strip `.wald`, drop a trailing `index` segment. `@waldjs/cli`
doesn't export its router module from its public API (only `config`,
`adapters`, `image` are exported), so this script re-implements just the
file→route mapping rather than reaching into `@waldjs/cli`'s internals via a
deep, unsupported import. Marketing has no dynamic `[param]`-style routes
today, so the reimplementation only needs the simple case — if that changes,
revisit whether to export the router module instead of maintaining two
copies of the pattern logic. Writes `dist/sitemap.xml` with one `<url><loc>`
entry per route, each prefixed with `https://waldjs.steefan.nl`.

**Why generated, not a static file:** the site is one page today, but the
next sub-project adds more. A hand-written `sitemap.xml` is exactly the kind
of file that silently goes stale (nobody remembers to update it when a page
is added) — generating it from the same `src/pages/` directory WaldJS itself
routes from means it can never drift from what's actually built. This also
matches the "shared source of truth" principle already used for the marketing
site's CSS (`rebuilding-marketing-css` project skill).

`marketing/package.json`'s `build` script (`wald build && node
scripts/build-css.js dist`) gains a third step: `&& node
scripts/build-sitemap.mjs`.

### 5. OG-image asset

New `marketing/src/assets/og-image.svg` (1200×630), matching the existing
favicon's visual style (logo, brand colors, tagline). This is a source asset
the user converts to PNG once (via any SVG→PNG tool) and places at
`marketing/src/assets/og-image.png`, referenced by the meta tags above and
copied to `dist/assets/` the same way other `src/assets/*` files already are
during `wald build`.

## Testing

Extend the existing `marketing/src/smoke.test.ts` (which already runs a real
`wald build` in a `beforeAll` and asserts on `dist/` output) with:
- `dist/robots.txt` exists and contains the `Sitemap:` line.
- `dist/sitemap.xml` exists, is valid XML, and contains a `<loc>` entry for
  `https://waldjs.steefan.nl/`.
- `dist/index.html` contains the canonical link, `og:image`, and the JSON-LD
  `<script type="application/ld+json">` block with valid, parseable JSON.

This matches the existing test file's black-box style (build once, assert on
real output) rather than unit-testing `build-sitemap.mjs` in isolation.

## Error handling

`build-sitemap.mjs` runs after `wald build` has already succeeded (route
files are guaranteed to exist by that point) — no special error handling
needed beyond letting a genuine filesystem error surface and fail the build,
same as `build-css.js` today.

## Non-goals

Dynamic/per-page OG images, a CMS-driven sitemap, `hreflang`, and anything
covered by the other two SEO sub-projects (performance, content expansion).
