# Marketing Content Expansion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract a shared page `Layout`, add two comparison landing pages (`/vs/astro`, `/vs/eleventy`), and migrate the homepage's buried changelog list into individually-indexable `/changelog` pages backed by a real content collection.

**Architecture:** `marketing/src/layouts/Layout.wald` becomes the single source of the `<head>`/`<Nav>`/`<Footer>` boilerplate, parameterized by `title`/`description`/`canonicalPath`, used by every page. `marketing/scripts/build-sitemap.mjs` (from the "technical SEO basics" sub-project) gets reworked to scan the *built* `dist/` directory instead of `src/pages/` source files, so it automatically picks up dynamically-generated routes (the changelog detail pages) without needing its own route-resolution logic. Changelog entries move to `marketing/content/changelog/*.md`, rendered via `wald:content`'s `getCollection`/`getEntry`.

**Spec:** `docs/superpowers/specs/2026-09-23-marketing-content-expansion-design.md`

**Tech Stack:** WaldJS (layouts, content collections, dynamic routes via `getStaticPaths()`), Vitest.

---

## Before you start

This plan assumes you're already in the isolated worktree at
`/Users/stefan/Desktop/semantique-agency/repositories/waldjs/.worktrees/marketing-content-expansion`
on branch `feat/marketing-content-expansion`, stacked on top of the
not-yet-merged `feat/marketing-perf-defer-scripts` (PR #62, itself stacked on
`feat/marketing-seo-technical-basics`, PR #61) — this branch already has both
prior sub-projects' changes (canonical/OG/JSON-LD/robots.txt/sitemap.xml, and
`defer` on the six scripts). If starting fresh:

```bash
git fetch origin main
git fetch origin feat/marketing-perf-defer-scripts
git worktree add .worktrees/marketing-content-expansion -b feat/marketing-content-expansion origin/feat/marketing-perf-defer-scripts
cd .worktrees/marketing-content-expansion
export NVM_DIR="$HOME/.nvm" && \. "$NVM_DIR/nvm.sh" && nvm use 22
pnpm install
pnpm build
```

Run all commands from `marketing/` inside this worktree unless noted. Use
`./node_modules/.bin/vitest` (not `../node_modules/.bin/vitest`).

**Important context:** this plan touches `marketing/scripts/build-sitemap.mjs`
(Task 2), which was built and reviewed in the "technical SEO basics"
sub-project with a *different* approach (scanning `src/pages/` source files).
Task 2 below replaces that approach entirely — read Task 2's rationale before
assuming the old behavior still applies.

---

### Task 1: Extract a shared `Layout.wald`

**Files:**
- Create: `marketing/src/layouts/Layout.wald`
- Modify: `marketing/src/pages/index.wald`

- [ ] **Step 1: Create the layout**

Create `marketing/src/layouts/Layout.wald`:

```wald
---
import Nav from '../components/Nav.wald'
import Footer from '../components/Footer.wald'
import CanopyPing from '../components/CanopyPing.wald'
const { title, description, canonicalPath, pond } = $$props
const canonicalUrl = 'https://waldjs.steefan.nl' + canonicalPath
const ogImage = 'https://waldjs.steefan.nl/assets/og-image.png'
---
<!DOCTYPE html>
<html lang="nl" data-lang="nl">
<head>
<meta charset="UTF-8">
<script data-wald-no-hoist>try{var t=localStorage.getItem('wald-taal');if(t==='nl'||t==='en'){document.documentElement.dataset.lang=t;document.documentElement.lang=t;}}catch(e){}</script>
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{title}</title>
<meta name="description" content={description}>
<meta property="og:title" content={title}>
<meta property="og:description" content={description}>
<meta property="og:type" content="website">
<meta property="og:site_name" content="WaldJS">
<link rel="canonical" href={canonicalUrl}>
<meta property="og:url" content={canonicalUrl}>
<meta property="og:image" content={ogImage}>
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content={ogImage}>
<meta name="theme-color" content="#023B2D">
<link rel="icon" type="image/svg+xml" href="/assets/favicon.svg">
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "name": "WaldJS",
  "description": "WaldJS is een content-first webframework voor razendsnelle, statische websites. Schrijf .wald-bestanden en WaldJS compileert ze tot een statische site.",
  "applicationCategory": "DeveloperApplication",
  "operatingSystem": "Cross-platform",
  "url": "https://waldjs.steefan.nl/",
  "author": {
    "@type": "Organization",
    "name": "WaldJS",
    "url": "https://github.com/Stefan-Espant/WaldJS"
  },
  "offers": {
    "@type": "Offer",
    "price": "0",
    "priceCurrency": "USD"
  }
}
</script>
<script async src="https://www.googletagmanager.com/gtag/js?id=G-SR1VDF9DJK"></script>
<script>
window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', 'G-SR1VDF9DJK');
</script>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="preconnect" href="https://use.typekit.net" crossorigin>
<script defer src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
<script defer src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js"></script>
<script defer src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/ScrollTrigger.min.js"></script>
<link rel="stylesheet" href="/assets/css/site.css">
</head>
<body>
<canvas id="bos3d" aria-hidden="true"></canvas>
<div id="scrim" aria-hidden="true"></div>
<div id="groeibalk" aria-hidden="true"></div>
<div id="groeiblad" aria-hidden="true"></div>
<div id="cursorvlieg" aria-hidden="true"></div>
<Nav />
{pond}
<Footer />
<CanopyPing canopy:load />
<script defer src="/assets/js/site.js"></script>
<script defer src="/assets/js/forest.js"></script>
<script defer src="/assets/js/animations.js"></script>
</body>
</html>
```

Note the JSON-LD's `url` field stays the fixed homepage root on every page
(not the per-page `canonicalUrl`) — deliberately: the `SoftwareApplication`
schema describes the *product*, not the specific page it's embedded on, so
one consistent entity URL across every page is more correct than varying it,
and it avoids depending on whether `{}` interpolation works inside a
`<script>` tag's JSON body (untested territory — the meta *attributes* above
it are confirmed to interpolate via the compiler's own transform of
component prop attributes, e.g. `content={description}` matching the pattern
`packages/compiler/src/transform/index.ts`'s `renderAttr` already uses
elsewhere in this codebase, but script tag *body* interpolation isn't
something any existing `.wald` file in this repo relies on — don't be the
first to assume it works without checking).

- [ ] **Step 2: Refactor `index.wald` to use the layout**

Replace the entire contents of `marketing/src/pages/index.wald` with:

```wald
---
import Layout from '../layouts/Layout.wald'
import Hero from '../components/Hero.wald'
import Quickstart from '../components/Quickstart.wald'
import Formaat from '../components/Formaat.wald'
import Playground from '../components/Playground.wald'
import Metafoor from '../components/Metafoor.wald'
import Features from '../components/Features.wald'
import Vergelijking from '../components/Vergelijking.wald'
import Benchmarks from '../components/Benchmarks.wald'
import Cli from '../components/Cli.wald'
import Structuur from '../components/Structuur.wald'
import Packages from '../components/Packages.wald'
import Roadmap from '../components/Roadmap.wald'
import Faq from '../components/Faq.wald'
import Changelog from '../components/Changelog.wald'
---
<Layout
  title="WaldJS — Plant je site. Laat hem groeien."
  description="WaldJS is een content-first webframework voor razendsnelle, statische websites. Schrijf .wald-bestanden en WaldJS compileert ze tot een statische site."
  canonicalPath="/"
>
  <Hero />
  <Quickstart />
  <Formaat />
  <Playground />
  <Metafoor />
  <Features />
  <Vergelijking />
  <Benchmarks />
  <Cli />
  <Structuur />
  <Packages />
  <Roadmap />
  <Faq />
  <Changelog />
</Layout>
```

- [ ] **Step 3: Rebuild and confirm nothing regressed**

Run: `cd marketing && pnpm build`
Expected: no errors.

Run: `cd marketing && ./node_modules/.bin/vitest run src/smoke.test.ts`
Expected: PASS — **all 8 existing tests, unmodified**. This is the
regression proof: every one of those tests already asserts on `dist/index.html`'s
content (doctype, section ids, canonical, og:image, JSON-LD, robots.txt/sitemap,
defer attributes, inline-script allowlist) — if the layout extraction
reproduced the exact same rendered output, none of them need to change. If
any fail, the layout doesn't yet produce byte-equivalent output — fix the
layout, don't weaken the tests.

- [ ] **Step 4: Commit**

```bash
git add marketing/src/layouts/Layout.wald marketing/src/pages/index.wald
git commit -m "marketing: extract shared Layout from index.wald"
```

---

### Task 2: Rework `build-sitemap.mjs` to scan the built `dist/` directory

**Files:**
- Modify: `marketing/scripts/build-sitemap.mjs`
- Modify: `marketing/scripts/build-sitemap.test.ts`

**Why this changes:** the existing sitemap generator (from the "technical
SEO basics" sub-project) scans `src/pages/` *source* files and explicitly
excludes any route containing a `[param]` segment, because at that time
there was no way to know what real URLs a dynamic route would produce.
Task 3 adds `changelog/[slug].wald`, a dynamic route resolved via
`getStaticPaths()` into 8 real pages — those pages deserve to be in the
sitemap (they're exactly the newly-indexable content this whole sub-project
exists to create), but the old source-scanning approach can't know that
without reimplementing route resolution. Scanning the *built* `dist/`
directory instead — which only ever contains real, already-resolved
pages — sidesteps the problem entirely and is simpler code, not just a
workaround.

- [ ] **Step 1: Write the failing test**

Replace the entire contents of `marketing/scripts/build-sitemap.test.ts` with:

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { execFileSync } from 'node:child_process'

describe('build-sitemap.mjs', () => {
  let root: string

  beforeAll(() => {
    root = mkdtempSync(join(tmpdir(), 'wald-sitemap-'))
    // Simulate a built dist/ directory — this script now runs AFTER wald
    // build, scanning real output, not src/pages/ source files.
    mkdirSync(join(root, 'dist/about'), { recursive: true })
    mkdirSync(join(root, 'dist/changelog/roots'), { recursive: true })
    mkdirSync(join(root, 'dist/changelog/forest-polish'), { recursive: true })
    writeFileSync(join(root, 'dist/index.html'), '<h1>home</h1>')
    writeFileSync(join(root, 'dist/about/index.html'), '<h1>about</h1>')
    writeFileSync(join(root, 'dist/changelog/roots/index.html'), '<h1>roots</h1>')
    writeFileSync(join(root, 'dist/changelog/forest-polish/index.html'), '<h1>forest polish</h1>')
    execFileSync(
      process.execPath,
      [join(__dirname, 'build-sitemap.mjs'), root, 'https://example.com'],
      { stdio: 'pipe' },
    )
  })

  afterAll(() => {
    rmSync(root, { recursive: true, force: true })
  })

  it('writes dist/sitemap.xml', () => {
    const xml = readFileSync(join(root, 'dist/sitemap.xml'), 'utf-8')
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true)
  })

  it('includes one <loc> per built page, including nested/dynamic-origin routes', () => {
    const xml = readFileSync(join(root, 'dist/sitemap.xml'), 'utf-8')
    expect(xml).toContain('<loc>https://example.com/</loc>')
    expect(xml).toContain('<loc>https://example.com/about</loc>')
    expect(xml).toContain('<loc>https://example.com/changelog/roots</loc>')
    expect(xml).toContain('<loc>https://example.com/changelog/forest-polish</loc>')
  })

  it('does not include a trailing slash on non-root routes', () => {
    const xml = readFileSync(join(root, 'dist/sitemap.xml'), 'utf-8')
    expect(xml).not.toContain('<loc>https://example.com/about/</loc>')
  })

  it('XML-escapes special characters in route URLs', () => {
    const specialRoot = mkdtempSync(join(tmpdir(), 'wald-sitemap-special-'))
    mkdirSync(join(specialRoot, 'dist/foo&bar'), { recursive: true })
    writeFileSync(join(specialRoot, 'dist/foo&bar/index.html'), '<h1>x</h1>')
    execFileSync(
      process.execPath,
      [join(__dirname, 'build-sitemap.mjs'), specialRoot, 'https://example.com'],
      { stdio: 'pipe' },
    )
    const xml = readFileSync(join(specialRoot, 'dist/sitemap.xml'), 'utf-8')
    expect(xml).toContain('<loc>https://example.com/foo&amp;bar</loc>')
    expect(xml).not.toContain('<loc>https://example.com/foo&bar</loc>')
    rmSync(specialRoot, { recursive: true, force: true })
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd marketing && ./node_modules/.bin/vitest run scripts/build-sitemap.test.ts`
Expected: FAIL — the old script scans `src/pages/`, which doesn't exist in
these fixtures (only `dist/` does), so it produces an empty or missing
sitemap, not matching the new assertions.

- [ ] **Step 3: Replace `build-sitemap.mjs`**

Replace the entire contents of `marketing/scripts/build-sitemap.mjs` with:

```js
#!/usr/bin/env node
// Generates dist/sitemap.xml by scanning the already-BUILT dist/ directory
// for real generated pages (any index.html), rather than src/pages/ source
// files. This must run after `wald build`, not before — that's already how
// it's wired into marketing/package.json's build script. Scanning the real
// output means dynamically-generated routes (e.g. changelog/[slug] resolved
// via getStaticPaths()) are included automatically, with no need to
// reimplement route resolution here.
import { readdirSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'

const root = process.argv[2] ?? process.cwd()
const baseUrl = (process.argv[3] ?? 'https://waldjs.steefan.nl').replace(/\/$/, '')
const distDir = join(root, 'dist')

function escapeXml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function walkDir(dir) {
  const files = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...walkDir(full))
    } else if (entry.name === 'index.html') {
      files.push(full)
    }
  }
  return files
}

function fileToRoute(file) {
  const rel = relative(distDir, file).replace(/\\/g, '/')
  const withoutIndex = rel.slice(0, -'index.html'.length) // '' for the root page, 'about/' for nested
  return '/' + withoutIndex
}

const routes = walkDir(distDir)
  .map(fileToRoute)
  .map((route) => route.replace(/\/$/, '') || '/')
  .sort()

const urls = routes
  .map((route) => `  <url><loc>${escapeXml(baseUrl + route)}</loc></url>`)
  .join('\n')

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`

writeFileSync(join(distDir, 'sitemap.xml'), xml)
console.log(`sitemap: ${routes.length} route${routes.length === 1 ? '' : 's'} -> dist/sitemap.xml`)
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd marketing && ./node_modules/.bin/vitest run scripts/build-sitemap.test.ts`
Expected: PASS (all 4 tests).

- [ ] **Step 5: Rebuild the real site and confirm the sitemap still contains the root route**

Run: `cd marketing && pnpm build`
Expected: no errors. `cat dist/sitemap.xml` should contain exactly one
`<loc>https://waldjs.steefan.nl/</loc>` — same as before this task, since no
new pages exist yet (Tasks 3-4 add them).

Run: `cd marketing && ./node_modules/.bin/vitest run src/smoke.test.ts`
Expected: PASS — the existing "produceert robots.txt en sitemap.xml"
assertion should still pass unmodified, since the root route is still
present, just discovered a different way now.

- [ ] **Step 6: Commit**

```bash
git add marketing/scripts/build-sitemap.mjs marketing/scripts/build-sitemap.test.ts
git commit -m "marketing: generate sitemap.xml from built dist/ output instead of src/pages/"
```

---

### Task 3: Changelog content collection + pages + homepage trim

**Files:**
- Create: `marketing/content/changelog/roots.md`
- Create: `marketing/content/changelog/seed.md`
- Create: `marketing/content/changelog/sapling.md`
- Create: `marketing/content/changelog/branches.md`
- Create: `marketing/content/changelog/forest-vite-pipeline.md`
- Create: `marketing/content/changelog/canopy.md`
- Create: `marketing/content/changelog/forest-polish.md`
- Create: `marketing/content/changelog/forest-deployment-adapters.md`
- Create: `marketing/src/pages/changelog/index.wald`
- Create: `marketing/src/pages/changelog/[slug].wald`
- Modify: `marketing/src/components/Changelog.wald`
- Modify: `marketing/src/components/Nav.wald`
- Modify: `marketing/src/smoke.test.ts`

- [ ] **Step 1: Create the 8 content files**

Each entry's content is preserved verbatim from the current
`marketing/src/components/Changelog.wald` (bilingual `<span class="nl">`/
`<span class="en">` markup included as-is — Markdown passes raw inline HTML
through unchanged). `date` is assigned within the entry's real stated month
(the source only ever had month-level precision) purely to get correct sort
order; `dateLabel` is what's actually shown, matching the original text
exactly.

Create `marketing/content/changelog/roots.md`:
```md
---
title: "Roots"
date: 2026-04-01
dateLabel: "april 2026"
---
- <span class="nl">De compiler: parser + transform van .wald naar JS-modules</span><span class="en">The compiler: parser + transform from .wald to JS modules</span>
```

Create `marketing/content/changelog/seed.md`:
```md
---
title: "Seed"
date: 2026-04-15
dateLabel: "april 2026"
---
- <span class="nl">CLI: plant, grow, build en preview</span><span class="en">CLI: plant, grow, build and preview</span>
```

Create `marketing/content/changelog/sapling.md`:
```md
---
title: "Sapling"
date: 2026-05-01
dateLabel: "mei 2026"
---
- <span class="nl">Content collections via <code style="font-family:var(--mono);font-size:.85em">wald:content</code></span><span class="en">Content collections via <code style="font-family:var(--mono);font-size:.85em">wald:content</code></span>
- <span class="nl">Dynamische routes met getStaticPaths()</span><span class="en">Dynamic routes with getStaticPaths()</span>
```

Create `marketing/content/changelog/branches.md`:
```md
---
title: "Branches"
date: 2026-05-15
dateLabel: "mei 2026"
---
- <span class="nl">Componenten — herbruikbare .wald-bestanden</span><span class="en">Components — reusable .wald files</span>
- <span class="nl">Layouts voor gedeelde paginastructuur</span><span class="en">Layouts for shared page structure</span>
```

Create `marketing/content/changelog/forest-vite-pipeline.md`:
```md
---
title: "Forest"
date: 2026-06-01
dateLabel: "juni 2026"
---
- <span class="nl"><code style="font-family:var(--mono);font-size:.85em">wald.config.ts</code> met outDir, base en Vite-passthrough</span><span class="en"><code style="font-family:var(--mono);font-size:.85em">wald.config.ts</code> with outDir, base and Vite passthrough</span>
- <span class="nl">Vite SSR build-pipeline + statische pre-render</span><span class="en">Vite SSR build pipeline + static pre-render</span>
- vite-plugin-wald
```

Create `marketing/content/changelog/canopy.md`:
```md
---
title: "Canopy"
date: 2026-07-01
dateLabel: "juli 2026"
---
- <span class="nl">Client-side hydration — interactieve eilandjes in je statische bos</span><span class="en">Client-side hydration — interactive islands in your static forest</span>
- <span class="nl">Canopy-directives: <code style="font-family:var(--mono);font-size:.85em">canopy:load</code>, <code style="font-family:var(--mono);font-size:.85em">canopy:idle</code> en <code style="font-family:var(--mono);font-size:.85em">canopy:visible</code></span><span class="en">Canopy directives: <code style="font-family:var(--mono);font-size:.85em">canopy:load</code>, <code style="font-family:var(--mono);font-size:.85em">canopy:idle</code> and <code style="font-family:var(--mono);font-size:.85em">canopy:visible</code></span>
- <span class="nl">Het <code style="font-family:var(--mono);font-size:.85em">&lt;wald-canopy&gt;</code>-element laadt islands als ES-modules — de rest blijft 0 KB JavaScript</span><span class="en">The <code style="font-family:var(--mono);font-size:.85em">&lt;wald-canopy&gt;</code> element loads islands as ES modules — the rest stays 0 KB JavaScript</span>
```

Create `marketing/content/changelog/forest-polish.md`:
```md
---
title: "Forest Polish"
date: 2026-07-15
dateLabel: "juli 2026"
---
- <span class="nl">Marketing-site opgefrist met een branded favicon en scherpere CTA-states</span><span class="en">Refreshed the marketing site with a branded favicon and sharper CTA states</span>
- <span class="nl">3D-depth toegevoegd aan knoppen, kaarten, terminals en footer</span><span class="en">Added 3D depth to buttons, cards, terminals and the footer</span>
- <span class="nl">Dev-server serveert nu ook <code style="font-family:var(--mono);font-size:.85em">src/assets</code> correct tijdens <code style="font-family:var(--mono);font-size:.85em">wald grow</code></span><span class="en">The dev server now correctly serves <code style="font-family:var(--mono);font-size:.85em">src/assets</code> during <code style="font-family:var(--mono);font-size:.85em">wald grow</code></span>
```

Create `marketing/content/changelog/forest-deployment-adapters.md`:
```md
---
title: "Forest"
date: 2026-07-30
dateLabel: "juli 2026"
---
- <span class="nl">Deployment-adapters voor static, Netlify, Cloudflare Pages en Vercel</span><span class="en">Deployment adapters for static, Netlify, Cloudflare Pages and Vercel</span>
- <span class="nl"><code style="font-family:var(--mono);font-size:.85em">adapter</code> in <code style="font-family:var(--mono);font-size:.85em">wald.config.ts</code> met host-specifieke output en post-build bestanden</span><span class="en"><code style="font-family:var(--mono);font-size:.85em">adapter</code> in <code style="font-family:var(--mono);font-size:.85em">wald.config.ts</code> with host-specific output and post-build files</span>
- <span class="nl">CLI-buildsummary toont nu ook welke adapter je bos gebruikt</span><span class="en">The CLI build summary now shows which adapter your forest uses</span>
```

- [ ] **Step 2: Create the changelog index page**

Create `marketing/src/pages/changelog/index.wald`:

```wald
---
import Layout from '../../layouts/Layout.wald'
import { getCollection } from 'wald:content'
const entries = await getCollection('changelog')
const sorted = entries.slice().sort((a, b) => new Date(b.data.date).getTime() - new Date(a.data.date).getTime())
---
<Layout
  title="Changelog — WaldJS"
  description="Elke release een jaarring: het volledige groeidagboek van WaldJS."
  canonicalPath="/changelog"
>
  <section id="changelog-overzicht">
    <div class="sectiekop">
      <span class="tag"><span class="nl">Groeidagboek</span><span class="en">Growth log</span></span>
      <h1>Changelog</h1>
    </div>
    <div class="changelog">
      {sorted.map(entry => `
        <div class="log-kaart">
          <div class="log-kop"><h3><a href="/changelog/${entry.slug}">${entry.data.title}</a></h3><span class="datum">${entry.data.dateLabel}</span></div>
        </div>
      `).join('')}
    </div>
  </section>
</Layout>
```

- [ ] **Step 3: Create the changelog detail page**

Create `marketing/src/pages/changelog/[slug].wald`:

```wald
---
import Layout from '../../layouts/Layout.wald'
import { getCollection, getEntry } from 'wald:content'

export async function getStaticPaths() {
  const entries = await getCollection('changelog')
  return entries.map(e => ({ params: { slug: e.slug } }))
}

const entry = await getEntry('changelog', $$props.slug)
---
<Layout
  title={`${entry.data.title} — WaldJS Changelog`}
  description={`WaldJS changelog-entry: ${entry.data.title}, ${entry.data.dateLabel}.`}
  canonicalPath={`/changelog/${$$props.slug}`}
>
  <section id="changelog-entry">
    <div class="sectiekop">
      <span class="tag"><span class="nl">Groeidagboek</span><span class="en">Growth log</span></span>
      <h1>{entry.data.title}</h1>
      <span class="datum">{entry.data.dateLabel}</span>
    </div>
    <div class="log-kaart">
      {entry.body}
    </div>
    <p><a href="/changelog">← <span class="nl">Terug naar alle updates</span><span class="en">Back to all updates</span></a></p>
  </section>
</Layout>
```

- [ ] **Step 4: Trim the homepage `Changelog.wald` component**

Replace the entire contents of `marketing/src/components/Changelog.wald` with:

```wald
---
import { getCollection } from 'wald:content'
const entries = await getCollection('changelog')
const recent = entries
  .slice()
  .sort((a, b) => new Date(b.data.date).getTime() - new Date(a.data.date).getTime())
  .slice(0, 3)
---
<section id="changelog">
  <div class="sectiekop">
    <span class="tag"><span class="nl">Groeidagboek</span><span class="en">Growth log</span></span>
    <h2>Changelog</h2>
    <p><span class="nl">Elke release een jaarring. Dit is er tot nu toe gegroeid.</span><span class="en">Every release a growth ring. Here's what has grown so far.</span></p>
    <p style="margin-top:.5rem">
      <a href="https://www.npmjs.com/package/@waldjs/cli" target="_blank" rel="noopener">
        <img src="https://img.shields.io/npm/v/@waldjs/cli.svg" alt="npm version" style="vertical-align:middle" />
      </a>
      <span class="nl" style="margin-left:.5rem;opacity:.7;font-size:.85rem">huidige npm-versie — de fasenamen hieronder zijn mijlpalen, geen versienummers</span>
      <span class="en" style="margin-left:.5rem;opacity:.7;font-size:.85rem">current npm version — the phase names below are milestones, not version numbers</span>
    </p>
  </div>
  <div class="changelog">
    {recent.map(entry => `
      <div class="log-kaart">
        <div class="log-kop"><h3>${entry.data.title}</h3><span class="datum">${entry.data.dateLabel}</span></div>
        ${entry.body}
      </div>
    `).join('')}
  </div>
  <p style="margin-top:1.5rem">
    <a class="btn ghost" href="/changelog"><span class="nl">Bekijk alle updates</span><span class="en">See all updates</span></a>
  </p>
</section>
```

- [ ] **Step 5: Point the Nav's changelog link at the real page**

In `marketing/src/components/Nav.wald`, change both occurrences of
`href="#changelog"` to `href="/changelog"` (there are two: one in the
desktop nav list, one in the mobile menu — both currently read
`<a href="#changelog">Changelog</a>` and
`<a href="#changelog" onclick="toggleMenu(false)">Changelog</a>` respectively;
keep the `onclick="toggleMenu(false)"` on the second one, just change the
`href`).

- [ ] **Step 6: Add smoke test coverage**

In `marketing/src/smoke.test.ts`, add a new `it` block inside the existing
`describe('marketing site build', ...)` (after the last existing `it`
block, before the closing `})`):

```ts
  it('genereert changelog-overzicht en 8 losse changelog-detailpagina\'s', () => {
    expect(existsSync(join(ROOT, 'dist/changelog/index.html'))).toBe(true)
    const overzicht = readFileSync(join(ROOT, 'dist/changelog/index.html'), 'utf-8')
    for (const slug of ['roots', 'seed', 'sapling', 'branches', 'forest-vite-pipeline', 'canopy', 'forest-polish', 'forest-deployment-adapters']) {
      expect(existsSync(join(ROOT, `dist/changelog/${slug}/index.html`)), `missing dist/changelog/${slug}/index.html`).toBe(true)
      expect(overzicht).toContain(`/changelog/${slug}`)
    }

    const sitemap = readFileSync(join(ROOT, 'dist/sitemap.xml'), 'utf-8')
    expect(sitemap).toContain('<loc>https://waldjs.steefan.nl/changelog</loc>')
    expect(sitemap).toContain('<loc>https://waldjs.steefan.nl/changelog/roots</loc>')
  })

  it('toont nog maar de 3 recentste changelog-entries op de homepage', () => {
    const html = readFileSync(join(ROOT, 'dist/index.html'), 'utf-8')
    const kaarten = html.match(/class="log-kaart"/g) ?? []
    expect(kaarten.length).toBe(3)
    expect(html).toContain('href="/changelog"')
  })
```

- [ ] **Step 7: Run the full smoke test suite**

Run: `cd marketing && pnpm build && ./node_modules/.bin/vitest run src/smoke.test.ts`
Expected: PASS — all tests, including the two new ones. This exercises
Task 2's reworked sitemap generator against real dynamic routes for the
first time — if the sitemap assertions fail, revisit Task 2's logic, don't
patch around it here.

- [ ] **Step 8: Commit**

```bash
git add marketing/content/changelog marketing/src/pages/changelog marketing/src/components/Changelog.wald marketing/src/components/Nav.wald marketing/src/smoke.test.ts
git commit -m "marketing: migrate changelog to content collection with individual pages"
```

---

### Task 4: Comparison pages (`/vs/astro`, `/vs/eleventy`)

**Files:**
- Create: `marketing/src/pages/vs/astro.wald`
- Create: `marketing/src/pages/vs/eleventy.wald`
- Modify: `marketing/src/components/Footer.wald`
- Modify: `marketing/src/smoke.test.ts`

**Content-accuracy note (repeated from the design doc):** the written
comparison paragraphs below are a first draft grounded in the existing
`Vergelijking.wald` table's own claims. Implement them as given, but flag in
your final report that this copy is a draft for human review before the PR
is considered mergeable — don't independently rewrite or "improve" the
marketing framing yourself beyond fixing genuine factual errors you notice.

- [ ] **Step 1: Create the Astro comparison page**

Create `marketing/src/pages/vs/astro.wald`:

```wald
---
import Layout from '../../layouts/Layout.wald'
import Vergelijking from '../../components/Vergelijking.wald'
---
<Layout
  title="WaldJS vs Astro — welke past bij jouw project?"
  description="Een eerlijke vergelijking tussen WaldJS en Astro: single-file componenten, content collections, partial hydration en wanneer je welke kiest."
  canonicalPath="/vs/astro"
>
  <section id="vs-astro-intro">
    <div class="sectiekop">
      <span class="tag"><span class="nl">Vergelijking</span><span class="en">Comparison</span></span>
      <h1>WaldJS vs Astro</h1>
      <p><span class="nl">Beide gebruiken single-file componenten, content collections en 0 KB JavaScript standaard. Het verschil zit 'm in scope en ecosysteem.</span><span class="en">Both use single-file components, content collections, and 0 KB JavaScript by default. The difference is in scope and ecosystem.</span></p>
    </div>
  </section>
  <Vergelijking />
  <section id="vs-astro-keuze">
    <div class="sectiekop">
      <h2><span class="nl">Wanneer kies je wat?</span><span class="en">When to choose which?</span></h2>
    </div>
    <div class="split">
      <div>
        <h3><span class="nl">Kies WaldJS als je...</span><span class="en">Choose WaldJS if you...</span></h3>
        <ul>
          <li><span class="nl">een kleiner, eenvoudiger formaat wilt zonder een groot integratie-ecosysteem nodig te hebben</span><span class="en">want a smaller, simpler format and don't need a large integration ecosystem</span></li>
          <li><span class="nl">canopy-islands als gewone JS/TS-modules voldoende vindt, zonder losse framework-adapters</span><span class="en">are fine with canopy islands as plain JS/TS modules, without separate framework adapters</span></li>
        </ul>
      </div>
      <div>
        <h3><span class="nl">Kies Astro als je...</span><span class="en">Choose Astro if you...</span></h3>
        <ul>
          <li><span class="nl">een volwassen ecosysteem met veel officiële integraties nodig hebt (React, Vue, Svelte als islands)</span><span class="en">need a mature ecosystem with many official integrations (React, Vue, Svelte as islands)</span></li>
          <li><span class="nl">een grotere community en meer bestaande plugins/templates wilt</span><span class="en">want a larger community and more existing plugins/templates</span></li>
        </ul>
      </div>
    </div>
  </section>
</Layout>
```

- [ ] **Step 2: Create the Eleventy comparison page**

Create `marketing/src/pages/vs/eleventy.wald`:

```wald
---
import Layout from '../../layouts/Layout.wald'
import Vergelijking from '../../components/Vergelijking.wald'
---
<Layout
  title="WaldJS vs Eleventy — welke past bij jouw project?"
  description="Een eerlijke vergelijking tussen WaldJS en Eleventy: single-file componenten, Vite-integratie, partial hydration en wanneer je welke kiest."
  canonicalPath="/vs/eleventy"
>
  <section id="vs-eleventy-intro">
    <div class="sectiekop">
      <span class="tag"><span class="nl">Vergelijking</span><span class="en">Comparison</span></span>
      <h1>WaldJS vs Eleventy</h1>
      <p><span class="nl">Eleventy is een extreem volwassen, templating-taal-onafhankelijke generator. WaldJS kiest bewust voor één formaat en Vite-integratie.</span><span class="en">Eleventy is an extremely mature, templating-language-agnostic generator. WaldJS deliberately picks one format and Vite integration.</span></p>
    </div>
  </section>
  <Vergelijking />
  <section id="vs-eleventy-keuze">
    <div class="sectiekop">
      <h2><span class="nl">Wanneer kies je wat?</span><span class="en">When to choose which?</span></h2>
    </div>
    <div class="split">
      <div>
        <h3><span class="nl">Kies WaldJS als je...</span><span class="en">Choose WaldJS if you...</span></h3>
        <ul>
          <li><span class="nl">Vite-gedreven dev-ervaring en TypeScript-first single-file componenten wilt</span><span class="en">want a Vite-powered dev experience and TypeScript-first single-file components</span></li>
          <li><span class="nl">ingebouwde partial hydration wilt zonder losse plugins te hoeven zoeken</span><span class="en">want built-in partial hydration without hunting for separate plugins</span></li>
        </ul>
      </div>
      <div>
        <h3><span class="nl">Kies Eleventy als je...</span><span class="en">Choose Eleventy if you...</span></h3>
        <ul>
          <li><span class="nl">maximale flexibiliteit in templating-talen wilt (Nunjucks, Liquid, en meer)</span><span class="en">want maximum flexibility in templating languages (Nunjucks, Liquid, and more)</span></li>
          <li><span class="nl">een extreem stabiele, al jarenlang bewezen tool met een groot plugin-ecosysteem zoekt</span><span class="en">want an extremely stable, long-proven tool with a large plugin ecosystem</span></li>
        </ul>
      </div>
    </div>
  </section>
</Layout>
```

- [ ] **Step 3: Link the comparison pages from the footer**

In `marketing/src/components/Footer.wald`, find the second `<ul>` (the one
containing the GitHub link, `#packages`, `#cli`, `#structuur`) and add two
new `<li>` entries at the end of that list:

```html
<li><a href="/vs/astro">WaldJS vs Astro</a></li>
<li><a href="/vs/eleventy">WaldJS vs Eleventy</a></li>
```

- [ ] **Step 4: Add smoke test coverage**

In `marketing/src/smoke.test.ts`, add a new `it` block:

```ts
  it('produceert vergelijkingspagina\'s met eigen titel en canonical', () => {
    for (const [slug, title] of [
      ['astro', 'WaldJS vs Astro'],
      ['eleventy', 'WaldJS vs Eleventy'],
    ] as const) {
      const path = join(ROOT, `dist/vs/${slug}/index.html`)
      expect(existsSync(path), `missing dist/vs/${slug}/index.html`).toBe(true)
      const html = readFileSync(path, 'utf-8')
      expect(html).toContain(`<title>${title}`)
      expect(html).toContain(`<link rel="canonical" href="https://waldjs.steefan.nl/vs/${slug}">`)
    }

    const sitemap = readFileSync(join(ROOT, 'dist/sitemap.xml'), 'utf-8')
    expect(sitemap).toContain('<loc>https://waldjs.steefan.nl/vs/astro</loc>')
    expect(sitemap).toContain('<loc>https://waldjs.steefan.nl/vs/eleventy</loc>')
  })
```

- [ ] **Step 5: Run the full smoke test suite**

Run: `cd marketing && pnpm build && ./node_modules/.bin/vitest run src/smoke.test.ts`
Expected: PASS — all tests.

- [ ] **Step 6: Commit**

```bash
git add marketing/src/pages/vs marketing/src/components/Footer.wald marketing/src/smoke.test.ts
git commit -m "marketing: add WaldJS vs Astro / vs Eleventy comparison pages"
```

---

### Task 5: Full verification pass

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

Run (from the repo root): `pnpm build && pnpm test`
Expected: PASS across every package.

- [ ] **Step 2: Manual checklist**

- [ ] `dist/sitemap.xml` contains all 11 real routes: `/`, `/vs/astro`,
      `/vs/eleventy`, `/changelog`, and all 8 `/changelog/<slug>` pages —
      count them (`grep -c '<loc>' dist/sitemap.xml` should print `11`).
- [ ] Open `dist/index.html`, `dist/changelog/index.html`, and one
      `dist/changelog/<slug>/index.html` and confirm each has a distinct
      `<title>` and canonical URL (not all three showing the homepage's).
- [ ] Confirm the homepage's trimmed changelog section still looks
      reasonable (3 cards, a working link to `/changelog`) — this is
      structural HTML, not a visual/CSS check, so eyeballing the built HTML
      output is enough; a full visual pass isn't required for this task.
- [ ] Re-read the comparison pages' written copy (Task 4) once more and
      flag in your final report that a human should review tone/accuracy
      before merge — don't silently treat this as "done" copy.

- [ ] **Step 3: Push and open a PR**

```bash
git push -u origin feat/marketing-content-expansion
```

Open a PR against `main`. Note in the description: (1) this is the third
and final of three SEO sub-projects (technical basics → performance →
content expansion), stacked on the not-yet-merged PR #61/#62 chain, (2) the
comparison pages' written copy is a first draft needing human review before
merge, (3) the sitemap generator's approach changed from source-scanning to
dist-scanning as part of this PR (Task 2) — worth calling out since it
touches code from an earlier, already-merged-or-in-review sub-project.
