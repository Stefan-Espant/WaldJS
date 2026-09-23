# Marketing Site — Technical SEO Basics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add canonical URLs, expanded Open Graph/Twitter meta, JSON-LD structured data, `robots.txt`, and a build-time-generated `sitemap.xml` to the WaldJS marketing site.

**Architecture:** Additive `<head>` changes to `marketing/src/pages/index.wald`; a new build-time script (`marketing/scripts/build-sitemap.mjs`) that derives routes from `src/pages/` the same way `@waldjs/cli`'s router does, wired into `marketing/package.json`'s `build` script; a static `marketing/public/robots.txt` (copied to `dist/` as-is by `wald build`); a new `og-image.svg` source asset. All verified via `marketing/src/smoke.test.ts`'s existing "build once, assert on dist/ output" style.

**Spec:** `docs/superpowers/specs/2026-09-23-marketing-seo-technical-basics-design.md`

**Tech Stack:** Plain Node.js (esm scripts, no bundler needed — matches `build-css.js`'s existing style), Vitest.

---

## Before you start

This plan assumes you're already in the isolated worktree at
`/Users/stefan/Desktop/semantique-agency/repositories/waldjs/.worktrees/marketing-seo-basics`
on branch `feat/marketing-seo-technical-basics`. If starting fresh, from the
repo root:

```bash
git fetch origin main
git worktree add .worktrees/marketing-seo-basics -b feat/marketing-seo-technical-basics origin/main
cd .worktrees/marketing-seo-basics
export NVM_DIR="$HOME/.nvm" && \. "$NVM_DIR/nvm.sh" && nvm use 22
pnpm install
pnpm build
```

All tasks below run commands from `marketing/` inside this worktree unless a
step says otherwise. Node ≥22 must be active (`nvm use 22`) for `pnpm` to
work at all in this repo.

**Important context for whoever implements this:** `marketing/public/` does
not exist yet on disk — you're creating it. Do not confuse it with
`marketing/src/assets/`, which is a different directory with different
copy-through behavior (`src/assets/*` is referenced via `/assets/...` URLs
and copied to `dist/assets/`; `public/*` is copied to `dist/` as-is, at the
root — see the root `README.md`'s "Images" and "Project structure" sections
if you want the full explanation). `robots.txt` belongs in `public/`
(root-level file, `/robots.txt`); the OG image belongs in `src/assets/`
(referenced as `/assets/og-image.png`).

---

### Task 1: `robots.txt` + build-time `sitemap.xml` generation

**Files:**
- Create: `marketing/public/robots.txt`
- Create: `marketing/scripts/build-sitemap.mjs`
- Create: `marketing/scripts/build-sitemap.test.ts`
- Modify: `marketing/package.json`

- [ ] **Step 1: Create `robots.txt`**

Create `marketing/public/robots.txt`:

```
User-agent: *
Allow: /

Sitemap: https://waldjs.steefan.nl/sitemap.xml
```

- [ ] **Step 2: Write the failing test for the sitemap generator**

Create `marketing/scripts/build-sitemap.test.ts`:

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
    mkdirSync(join(root, 'src/pages/blog'), { recursive: true })
    writeFileSync(join(root, 'src/pages/index.wald'), '<h1>home</h1>')
    writeFileSync(join(root, 'src/pages/about.wald'), '<h1>about</h1>')
    writeFileSync(join(root, 'src/pages/blog/index.wald'), '<h1>blog</h1>')
    mkdirSync(join(root, 'dist'), { recursive: true })
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

  it('includes one <loc> per route, index files collapsed to their directory', () => {
    const xml = readFileSync(join(root, 'dist/sitemap.xml'), 'utf-8')
    expect(xml).toContain('<loc>https://example.com/</loc>')
    expect(xml).toContain('<loc>https://example.com/about</loc>')
    expect(xml).toContain('<loc>https://example.com/blog</loc>')
  })

  it('does not include a trailing slash on non-root routes', () => {
    const xml = readFileSync(join(root, 'dist/sitemap.xml'), 'utf-8')
    expect(xml).not.toContain('<loc>https://example.com/about/</loc>')
  })
})
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `cd marketing && ../node_modules/.bin/vitest run scripts/build-sitemap.test.ts`
Expected: FAIL — `build-sitemap.mjs` doesn't exist yet, `execFileSync` throws
`ENOENT`.

- [ ] **Step 4: Implement `build-sitemap.mjs`**

Create `marketing/scripts/build-sitemap.mjs`:

```js
#!/usr/bin/env node
// Generates dist/sitemap.xml from src/pages/**/*.wald, the same way
// wald build routes pages — see packages/cli/src/router/index.ts's
// fileToRoute() for the canonical version of this logic. Re-implemented
// here (not imported) because @waldjs/cli doesn't export its router module
// from its public API (only config/adapters/image are exported) — importing
// an internal path would be a fragile, unsupported dependency. Marketing has
// no dynamic [param]-style routes today, so this only needs the simple case;
// revisit sharing the real implementation if that changes.
import { readdirSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, relative } from 'node:path'

const root = process.argv[2] ?? process.cwd()
const baseUrl = (process.argv[3] ?? 'https://waldjs.steefan.nl').replace(/\/$/, '')
const pagesDir = join(root, 'src/pages')
const distDir = join(root, 'dist')

function walkDir(dir) {
  const files = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...walkDir(full))
    } else if (entry.name.endsWith('.wald')) {
      files.push(full)
    }
  }
  return files
}

function fileToRoute(file) {
  const rel = relative(pagesDir, file).replace(/\\/g, '/')
  const withoutExt = rel.slice(0, -'.wald'.length)
  const segments = withoutExt.split('/')
  if (segments[segments.length - 1] === 'index') segments.pop()
  return '/' + segments.join('/')
}

const routes = walkDir(pagesDir)
  .map(fileToRoute)
  .filter((route) => !route.includes(':')) // skip dynamic [param] routes — no known URLs to list
  .sort()

const urls = routes
  .map((route) => `  <url><loc>${baseUrl}${route === '/' ? '/' : route}</loc></url>`)
  .join('\n')

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`

mkdirSync(distDir, { recursive: true })
writeFileSync(join(distDir, 'sitemap.xml'), xml)
console.log(`sitemap: ${routes.length} route${routes.length === 1 ? '' : 's'} -> dist/sitemap.xml`)
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd marketing && ../node_modules/.bin/vitest run scripts/build-sitemap.test.ts`
Expected: PASS (all 3 tests).

- [ ] **Step 6: Wire it into the real build**

In `marketing/package.json`, change:

```json
    "build": "wald build && node scripts/build-css.js dist",
```

to:

```json
    "build": "wald build && node scripts/build-css.js dist && node scripts/build-sitemap.mjs . https://waldjs.steefan.nl",
```

- [ ] **Step 7: Run the real build and confirm both new files land in `dist/`**

Run: `cd marketing && pnpm build`
Expected: no errors. Then confirm:
```bash
cat dist/robots.txt
cat dist/sitemap.xml
```
`dist/robots.txt` should match Step 1's content exactly (copied verbatim by
`wald build`'s `public/` → `dist/` copy step). `dist/sitemap.xml` should
contain exactly one `<loc>https://waldjs.steefan.nl/</loc>` entry, since
`marketing/src/pages/` currently has only `index.wald`.

- [ ] **Step 8: Commit**

```bash
git add marketing/public/robots.txt marketing/scripts/build-sitemap.mjs marketing/scripts/build-sitemap.test.ts marketing/package.json
git commit -m "marketing: add robots.txt and build-time sitemap.xml generation"
```

---

### Task 2: Canonical URL, expanded social meta, and JSON-LD structured data

**Files:**
- Modify: `marketing/src/pages/index.wald`
- Modify: `marketing/src/smoke.test.ts`

- [ ] **Step 1: Read the current `<head>` block**

Open `marketing/src/pages/index.wald` and find the `<head>...</head>` block
(right after `<!DOCTYPE html>`). The current relevant lines look like this
(exact content may differ slightly — match against what's actually there,
this is what it looked like when this plan was written):

```html
<title>WaldJS — Plant je site. Laat hem groeien.</title>
<meta name="description" content="WaldJS is een content-first webframework voor razendsnelle, statische websites. Schrijf .wald-bestanden en WaldJS compileert ze tot een statische site.">
<meta property="og:title" content="WaldJS — Plant je site. Laat hem groeien.">
<meta property="og:description" content="Een content-first webframework voor razendsnelle, statische websites. Deel frontmatter, deel HTML-template — 0 KB JavaScript standaard.">
<meta property="og:type" content="website">
<meta property="og:site_name" content="WaldJS">
<meta name="twitter:card" content="summary">
<meta name="theme-color" content="#023B2D">
<link rel="icon" type="image/svg+xml" href="/assets/favicon.svg">
```

- [ ] **Step 2: Add canonical + expanded social meta**

Replace the `<meta name="twitter:card" content="summary">` line with this
block (keeping everything else in the snippet above unchanged, just adding
around it):

```html
<link rel="canonical" href="https://waldjs.steefan.nl/">
<meta property="og:url" content="https://waldjs.steefan.nl/">
<meta property="og:image" content="https://waldjs.steefan.nl/assets/og-image.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="https://waldjs.steefan.nl/assets/og-image.png">
```

- [ ] **Step 3: Add the JSON-LD structured data block**

Add this immediately after the meta tags from Step 2 (still inside `<head>`,
before the `<link rel="preconnect" ...>` lines):

```html
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
```

- [ ] **Step 4: Rebuild and manually confirm the output**

Run: `cd marketing && pnpm build`
Expected: no errors.

```bash
grep -c 'rel="canonical"' dist/index.html
grep -c 'og:image' dist/index.html
grep -c 'application/ld+json' dist/index.html
python3 -c "
import re, json
html = open('dist/index.html').read()
m = re.search(r'<script type=\"application/ld\+json\">(.*?)</script>', html, re.S)
json.loads(m.group(1))
print('JSON-LD parses OK')
"
```
The `grep -c` counts should all be ≥1, and the Python check should print
`JSON-LD parses OK` without raising — this confirms the JSON-LD block is
syntactically valid JSON, not just present as text.

- [ ] **Step 5: Extend `smoke.test.ts` with SEO assertions**

In `marketing/src/smoke.test.ts`, add a new `it` block inside the existing
`describe('marketing site build', ...)` (after the last existing `it`
block, before the closing `})`):

```ts
  it('bevat canonical, og:image en geldige JSON-LD structured data', () => {
    const html = readFileSync(join(ROOT, 'dist/index.html'), 'utf-8')
    expect(html).toContain('<link rel="canonical" href="https://waldjs.steefan.nl/">')
    expect(html).toContain('property="og:image"')
    expect(html).toContain('name="twitter:image"')

    const match = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)
    expect(match).not.toBeNull()
    const data = JSON.parse(match![1])
    expect(data['@type']).toBe('SoftwareApplication')
    expect(data.url).toBe('https://waldjs.steefan.nl/')
  })

  it('produceert robots.txt en sitemap.xml met de juiste canonical host', () => {
    const robots = readFileSync(join(ROOT, 'dist/robots.txt'), 'utf-8')
    expect(robots).toContain('Sitemap: https://waldjs.steefan.nl/sitemap.xml')

    const sitemap = readFileSync(join(ROOT, 'dist/sitemap.xml'), 'utf-8')
    expect(sitemap).toContain('<loc>https://waldjs.steefan.nl/</loc>')
  })
```

- [ ] **Step 6: Run the full smoke test suite**

Run: `cd marketing && ../node_modules/.bin/vitest run src/smoke.test.ts`
Expected: PASS — all tests, including the two new ones (this re-runs the
real `wald build` via the file's existing `beforeAll`, so it also re-proves
Task 1's sitemap/robots.txt generation end-to-end together with these new
meta tags).

- [ ] **Step 7: Commit**

```bash
git add marketing/src/pages/index.wald marketing/src/smoke.test.ts
git commit -m "marketing: canonical URL, expanded social meta, and JSON-LD structured data"
```

---

### Task 3: OG-image source asset

**Files:**
- Create: `marketing/src/assets/og-image.svg`

- [ ] **Step 1: Create the OG-image SVG**

Create `marketing/src/assets/og-image.svg` (1200×630), matching the existing
favicon's visual language (`marketing/src/assets/favicon.svg`: dark green
`#023B2D` background, white tree-silhouette watermark at 30% opacity, "W" in
white + "JS" in red `#FF3347`, `Puffin Display Soft`/`Baloo 2` font stack):

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="#023B2D"/>
  <path
    fill="#FFF"
    opacity=".12"
    transform="translate(600 60) scale(9)"
    d="M32 8c-1.5 0-2.8 1-3.2 2.5-2.4 8.6-7.7 15-17.9 19.4-1.5.7-2.5 2.1-2.5 3.8 0 2.4 1.9 4.1 4.5 4.1.9 0 1.9-.2 2.8-.6l4.5-2-4.6 5.8c-.8.9-1.2 1.9-1.2 2.9 0 2.2 1.8 3.7 4 3.7.8 0 1.7-.2 2.8-.7l6.9-3.1-6.4 7.9c-.6.8-.6 1.9.2 2.6.3.2.8.4 1.2.4h14.9c1 0 1.9-.8 1.9-1.9 0-.4-.2-.8-.4-1.1l-6.4-7.9 6.9 3.1c1 .5 2 .7 2.8.7 2.2 0 4-1.5 4-3.7 0-1-.4-2-1.2-2.9l-4.6-5.8 4.5 2c.9.4 1.9.6 2.8.6 2.6 0 4.5-1.7 4.5-4.1 0-1.7-1-3.1-2.5-3.8-10.2-4.3-15.6-10.8-17.9-19.4C34.8 9 33.5 8 32 8Z"
  />
  <text
    x="600"
    y="330"
    text-anchor="middle"
    font-family="'Puffin Display Soft', 'Baloo 2', system-ui, sans-serif"
    font-size="96"
    font-weight="700"
    letter-spacing="-3"
  ><tspan fill="#FFF">Wald</tspan><tspan fill="#FF3347">JS</tspan></text>
  <text
    x="600"
    y="400"
    text-anchor="middle"
    fill="#FFF"
    opacity=".85"
    font-family="'Baloo 2', system-ui, sans-serif"
    font-size="34"
    font-weight="500"
  >Plant je site. Laat hem groeien.</text>
</svg>
```

- [ ] **Step 2: Visually sanity-check the SVG**

Open `marketing/src/assets/og-image.svg` directly in a browser (drag the file
in, or `open marketing/src/assets/og-image.svg` on macOS) and confirm: the
tree watermark is faint but visible behind the wordmark, "Wald" is white and
"JS" is red, the tagline is legible, nothing is clipped by the 1200×630
frame.

- [ ] **Step 3: Commit**

```bash
git add marketing/src/assets/og-image.svg
git commit -m "marketing: add OG-image source SVG (1200x630, matches favicon style)"
```

- [ ] **Step 4: Hand off the PNG conversion (not automatable in this plan)**

This step is for a human, not the implementing agent: convert
`marketing/src/assets/og-image.svg` to `marketing/src/assets/og-image.png`
(any SVG→PNG tool at 1200×630 — e.g. opening it in a browser and using a
screenshot/export tool, Figma import, or an online converter), then commit
the PNG:
```bash
git add marketing/src/assets/og-image.png
git commit -m "marketing: add converted OG-image PNG"
```
Until this PNG exists, `og:image`/`twitter:image` in the built HTML will
point at a URL that 404s — this doesn't break the build or the other SEO
work in Tasks 1-2, but link previews (Slack, Twitter/X, etc.) won't show an
image until the PNG is committed and deployed.

---

### Task 4: Full verification pass

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

Run (from the repo root): `pnpm build && pnpm test`
Expected: PASS across every package, including `@waldjs/marketing`'s
extended `smoke.test.ts` and the new `build-sitemap.test.ts`.

- [ ] **Step 2: Manual checklist**

- [ ] `dist/robots.txt` exists and its `Sitemap:` line resolves to a URL that
      itself exists (`dist/sitemap.xml`).
- [ ] `dist/sitemap.xml` is well-formed XML with the site's real URL(s).
- [ ] `dist/index.html`'s `<head>` has exactly one `<link rel="canonical">`,
      pointing at `https://waldjs.steefan.nl/` (not a trailing-slash-less or
      `www.`-prefixed variant).
- [ ] The JSON-LD block parses as valid JSON (already covered by an
      automated test, but worth eyeballing the rendered values once).
- [ ] If the OG-image PNG has been converted (Task 3, Step 4): open
      `dist/assets/og-image.png` and confirm it renders correctly at full
      size, not just as an SVG preview.

- [ ] **Step 3: Push and open a PR**

```bash
git push -u origin feat/marketing-seo-technical-basics
```

Open a PR against `main`. This is the first of three SEO sub-projects
(technical basics → performance/Core Web Vitals → more pages/content) — note
that in the PR description so reviewers have context for what's still to
come.
