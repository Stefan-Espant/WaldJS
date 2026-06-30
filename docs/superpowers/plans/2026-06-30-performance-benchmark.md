# Performance Benchmark Suite Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a reproducible benchmark suite that measures WaldJS build time and Lighthouse scores against Astro and Eleventy on identical content, runnable via `pnpm bench` from the monorepo root.

**Architecture:** A `benchmarks/` pnpm workspace package containing three standalone framework sub-directories (`wald/`, `astro/`, `eleventy/`) that each build the same 50-post blog site. A TypeScript orchestrator syncs content, times three builds per framework (median), runs Lighthouse on five pages per framework, writes `results/latest.json`, and prints a comparison table.

**Tech Stack:** Node.js 22 + tsx, Lighthouse v12, chrome-launcher, sirv, WaldJS (workspace:*), Astro v4, Eleventy v3, TypeScript.

**Prerequisite:** Run `pnpm build` in the monorepo root before first use so `@waldjs/cli` is compiled.

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `pnpm-workspace.yaml` | Modify | Add `benchmarks` entry |
| `package.json` (root) | Modify | Add `bench` script |
| `.gitignore` (root) | Modify | Ignore `benchmarks/results/` |
| `benchmarks/package.json` | Create | Workspace package with bench scripts and deps |
| `benchmarks/.gitignore` | Create | Ignore `wald/node_modules`, `astro/node_modules`, `eleventy/node_modules`, `*/dist/` |
| `benchmarks/scripts/generate-content.ts` | Create | Generates 50 Markdown posts in `content/blog/` |
| `benchmarks/content/blog/` | Generated | Source of truth for shared Markdown content |
| `benchmarks/wald/package.json` | Create | WaldJS variant package — uses `file:../../packages/cli` |
| `benchmarks/wald/wald.config.ts` | Create | Minimal WaldJS config |
| `benchmarks/wald/src/pages/index.wald` | Create | Homepage |
| `benchmarks/wald/src/pages/blog/index.wald` | Create | Blog listing |
| `benchmarks/wald/src/pages/blog/[slug].wald` | Create | Blog post detail + Counter island |
| `benchmarks/wald/src/components/Counter.wald` | Create | Canopy island component |
| `benchmarks/astro/package.json` | Create | Astro variant package |
| `benchmarks/astro/astro.config.mjs` | Create | `output: static`, `trailingSlash: never` |
| `benchmarks/astro/src/content/config.ts` | Create | Blog collection schema |
| `benchmarks/astro/src/pages/index.astro` | Create | Homepage |
| `benchmarks/astro/src/pages/blog/index.astro` | Create | Blog listing |
| `benchmarks/astro/src/pages/blog/[slug].astro` | Create | Blog post detail |
| `benchmarks/astro/src/components/Counter.astro` | Create | Vanilla JS counter |
| `benchmarks/eleventy/package.json` | Create | Eleventy variant package |
| `benchmarks/eleventy/.eleventy.js` | Create | Eleventy config (CommonJS) |
| `benchmarks/eleventy/src/_includes/base.njk` | Create | Base layout |
| `benchmarks/eleventy/src/_includes/post.njk` | Create | Blog post layout |
| `benchmarks/eleventy/src/index.njk` | Create | Homepage |
| `benchmarks/eleventy/src/blog-index.njk` | Create | Blog listing |
| `benchmarks/eleventy/src/blog/blog.11tydata.json` | Create | Directory data — layout + permalink template for synced posts |
| `benchmarks/scripts/bench.ts` | Create | Orchestrator — sync, build, Lighthouse, write JSON |
| `benchmarks/scripts/report.ts` | Create | Read `results/latest.json`, print terminal table |

---

## Task 1: Monorepo scaffolding

**Files:**
- Modify: `pnpm-workspace.yaml`
- Modify: `package.json` (root)
- Modify: `.gitignore` (root)
- Create: `benchmarks/package.json`
- Create: `benchmarks/.gitignore`

- [ ] **Step 1: Add `benchmarks` to pnpm workspace**

Edit `pnpm-workspace.yaml` — replace content with:

```yaml
packages:
  - 'packages/*'
  - 'examples/*'
  - 'benchmarks'
allowBuilds:
  esbuild: true
```

- [ ] **Step 2: Add `bench` to root `package.json`**

Edit `package.json` — add `"bench"` to scripts:

```json
{
  "name": "waldjs",
  "private": true,
  "scripts": {
    "build": "turbo build",
    "test": "turbo test",
    "dev": "turbo dev",
    "bench": "pnpm --filter @waldjs/benchmarks bench"
  },
  "packageManager": "pnpm@11.5.2",
  "devDependencies": {
    "turbo": "^2.0.0",
    "typescript": "^5.5.0"
  }
}
```

- [ ] **Step 3: Ignore benchmark results and framework node_modules in root `.gitignore`**

Add to `.gitignore`:

```
benchmarks/results/
benchmarks/wald/node_modules/
benchmarks/astro/node_modules/
benchmarks/eleventy/node_modules/
benchmarks/wald/dist/
benchmarks/astro/dist/
benchmarks/eleventy/dist/
```

- [ ] **Step 4: Create `benchmarks/package.json`**

```json
{
  "name": "@waldjs/benchmarks",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "generate": "tsx scripts/generate-content.ts",
    "bench": "tsx scripts/bench.ts && tsx scripts/report.ts",
    "report": "tsx scripts/report.ts"
  },
  "devDependencies": {
    "chrome-launcher": "^1.1.2",
    "lighthouse": "^12.0.0",
    "sirv": "^2.0.4",
    "tsx": "^4.19.0",
    "typescript": "^5.5.0"
  }
}
```

- [ ] **Step 5: Create `benchmarks/.gitignore`**

```
content/
results/
```

- [ ] **Step 6: Install workspace deps**

```bash
pnpm install
```

Expected: no errors. `benchmarks` appears in pnpm workspace.

- [ ] **Step 7: Commit**

```bash
git add pnpm-workspace.yaml package.json .gitignore benchmarks/package.json benchmarks/.gitignore
git commit -m "feat(benchmarks): scaffold benchmark workspace package"
```

---

## Task 2: Content generator

**Files:**
- Create: `benchmarks/scripts/generate-content.ts`

- [ ] **Step 1: Create `benchmarks/scripts/generate-content.ts`**

```typescript
import { writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const contentDir = join(__dirname, '../content/blog')
mkdirSync(contentDir, { recursive: true })

const para = [
  'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.',
  'Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.',
  'Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo.',
].join(' ')

for (let i = 1; i <= 50; i++) {
  const n = String(i).padStart(3, '0')
  const date = new Date(Date.UTC(2026, 0, i)).toISOString().split('T')[0]
  writeFileSync(
    join(contentDir, `post-${n}.md`),
    `---\ntitle: "Benchmark Post ${n}"\ndate: ${date}\nauthor: Benchmark\n---\n\n${para}\n\n${para}\n\n${para}\n`,
  )
}

console.log(`Generated 50 posts in ${contentDir}`)
```

- [ ] **Step 2: Run generator and verify**

```bash
cd benchmarks && pnpm generate
```

Expected output: `Generated 50 posts in .../benchmarks/content/blog`

```bash
ls benchmarks/content/blog | wc -l
```

Expected: `50`

- [ ] **Step 3: Commit**

```bash
git add benchmarks/scripts/generate-content.ts
git commit -m "feat(benchmarks): add content generator script (50 Markdown posts)"
```

---

## Task 3: WaldJS variant

**Files:**
- Create: `benchmarks/wald/package.json`
- Create: `benchmarks/wald/wald.config.ts`
- Create: `benchmarks/wald/src/pages/index.wald`
- Create: `benchmarks/wald/src/pages/blog/index.wald`
- Create: `benchmarks/wald/src/pages/blog/[slug].wald`
- Create: `benchmarks/wald/src/components/Counter.wald`

The WaldJS variant reads content from `{cwd}/content/blog/`. The orchestrator syncs posts to `benchmarks/wald/content/blog/` before building. Output: `benchmarks/wald/dist/` with `.html` files (no trailing-slash directories).

- [ ] **Step 1: Create `benchmarks/wald/package.json`**

```json
{
  "name": "@waldjs/benchmark-wald",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "build": "wald build"
  },
  "devDependencies": {
    "@waldjs/cli": "file:../../packages/cli"
  }
}
```

- [ ] **Step 2: Create `benchmarks/wald/wald.config.ts`**

```typescript
import { defineConfig } from '@waldjs/cli'

export default defineConfig({
  outDir: 'dist',
  base: '/',
})
```

- [ ] **Step 3: Create `benchmarks/wald/src/pages/index.wald`**

```html
---
const title = 'WaldJS Benchmark'
---
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>{title}</title></head>
<body>
<h1>{title}</h1>
<p>A benchmark site built with WaldJS.</p>
<nav><a href="/blog/">Blog</a></nav>
</body>
</html>
```

- [ ] **Step 4: Create `benchmarks/wald/src/pages/blog/index.wald`**

```html
---
import { getCollection } from 'wald:content'
const posts = await getCollection('blog')
---
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>Blog</title></head>
<body>
<h1>Blog</h1>
<ul>
  {posts.map(p => `<li><a href="/blog/${p.slug}">${p.data.title}</a></li>`).join('')}
</ul>
</body>
</html>
```

- [ ] **Step 5: Create `benchmarks/wald/src/components/Counter.wald`**

```html
---
const { initialCount = 0 } = $$props
---
<button class="counter" style="padding:8px 16px;font-size:1rem">{initialCount}</button>
<script>
export default function(root, props) {
  let n = props.initialCount ?? 0
  const btn = root.querySelector('.counter')
  btn.onclick = () => { btn.textContent = String(++n) }
}
</script>
```

- [ ] **Step 6: Create `benchmarks/wald/src/pages/blog/[slug].wald`**

```html
---
import { getCollection, getEntry } from 'wald:content'
import Counter from '../../components/Counter.wald'

export async function getStaticPaths() {
  const posts = await getCollection('blog')
  return posts.map(p => ({ params: { slug: p.slug } }))
}

const post = await getEntry('blog', $$props.slug)
---
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>{post.data.title}</title></head>
<body>
<h1>{post.data.title}</h1>
<div>{post.body}</div>
<Counter canopy:load initialCount={0} />
</body>
</html>
```

- [ ] **Step 7: Install WaldJS variant deps**

```bash
cd benchmarks/wald && pnpm install
```

Expected: `@waldjs/cli` installed via file reference. No errors.

- [ ] **Step 8: Sync content and verify WaldJS build**

```bash
mkdir -p benchmarks/wald/content/blog
cp benchmarks/content/blog/*.md benchmarks/wald/content/blog/
cd benchmarks/wald && pnpm build
```

Expected: `dist/` created with `index.html`, `blog/index.html`, `blog/post-001.html` … `blog/post-050.html`.

```bash
ls benchmarks/wald/dist/blog/*.html | wc -l
```

Expected: `51` (50 posts + index).

- [ ] **Step 9: Commit**

```bash
git add benchmarks/wald/
git commit -m "feat(benchmarks): add WaldJS variant site"
```

---

## Task 4: Astro variant

**Files:**
- Create: `benchmarks/astro/package.json`
- Create: `benchmarks/astro/astro.config.mjs`
- Create: `benchmarks/astro/src/content/config.ts`
- Create: `benchmarks/astro/src/pages/index.astro`
- Create: `benchmarks/astro/src/pages/blog/index.astro`
- Create: `benchmarks/astro/src/pages/blog/[slug].astro`
- Create: `benchmarks/astro/src/components/Counter.astro`

Astro reads content from `src/content/blog/`. Set `trailingSlash: 'never'` so post URLs match WaldJS output (no trailing slash, `.html` files).

- [ ] **Step 1: Create `benchmarks/astro/package.json`**

```json
{
  "name": "@waldjs/benchmark-astro",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "build": "astro build"
  },
  "dependencies": {
    "astro": "^4.0.0"
  }
}
```

- [ ] **Step 2: Create `benchmarks/astro/astro.config.mjs`**

```js
import { defineConfig } from 'astro/config'

export default defineConfig({
  output: 'static',
  trailingSlash: 'never',
})
```

- [ ] **Step 3: Create `benchmarks/astro/src/content/config.ts`**

```typescript
import { defineCollection, z } from 'astro:content'

const blog = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    date: z.string(),
    author: z.string(),
  }),
})

export const collections = { blog }
```

- [ ] **Step 4: Create `benchmarks/astro/src/pages/index.astro`**

```astro
---
---
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>Astro Benchmark</title></head>
<body>
<h1>Astro Benchmark</h1>
<p>A benchmark site built with Astro.</p>
<nav><a href="/blog">Blog</a></nav>
</body>
</html>
```

- [ ] **Step 5: Create `benchmarks/astro/src/pages/blog/index.astro`**

```astro
---
import { getCollection } from 'astro:content'
const posts = await getCollection('blog')
---
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>Blog</title></head>
<body>
<h1>Blog</h1>
<ul>
  {posts.map(p => (
    <li><a href={`/blog/${p.slug}`}>{p.data.title}</a></li>
  ))}
</ul>
</body>
</html>
```

- [ ] **Step 6: Create `benchmarks/astro/src/components/Counter.astro`**

```astro
---
const { initialCount = 0 } = Astro.props
---
<button class="counter" data-count={initialCount} style="padding:8px 16px;font-size:1rem">
  {initialCount}
</button>
<script>
  document.querySelectorAll<HTMLButtonElement>('.counter').forEach(btn => {
    let n = parseInt(btn.dataset.count ?? '0')
    btn.onclick = () => { btn.textContent = String(++n) }
  })
</script>
```

- [ ] **Step 7: Create `benchmarks/astro/src/pages/blog/[slug].astro`**

```astro
---
import { getCollection } from 'astro:content'
import Counter from '../../components/Counter.astro'

export async function getStaticPaths() {
  const posts = await getCollection('blog')
  return posts.map(p => ({ params: { slug: p.slug }, props: { post: p } }))
}

const { post } = Astro.props
const { Content } = await post.render()
---
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>{post.data.title}</title></head>
<body>
<h1>{post.data.title}</h1>
<Content />
<Counter initialCount={0} />
</body>
</html>
```

- [ ] **Step 8: Install Astro variant deps**

```bash
cd benchmarks/astro && pnpm install
```

Expected: `astro` installed. No errors.

- [ ] **Step 9: Sync content and verify Astro build**

```bash
mkdir -p benchmarks/astro/src/content/blog
cp benchmarks/content/blog/*.md benchmarks/astro/src/content/blog/
cd benchmarks/astro && pnpm build
```

Expected: `dist/` with `index.html`, `blog/index.html`, `blog/post-001.html` … `blog/post-050.html`.

```bash
ls benchmarks/astro/dist/blog/*.html | wc -l
```

Expected: `51`.

- [ ] **Step 10: Commit**

```bash
git add benchmarks/astro/
git commit -m "feat(benchmarks): add Astro variant site"
```

---

## Task 5: Eleventy variant

**Files:**
- Create: `benchmarks/eleventy/package.json`
- Create: `benchmarks/eleventy/.eleventy.js`
- Create: `benchmarks/eleventy/src/_includes/base.njk`
- Create: `benchmarks/eleventy/src/_includes/post.njk`
- Create: `benchmarks/eleventy/src/index.njk`
- Create: `benchmarks/eleventy/src/blog-index.njk`
- Create: `benchmarks/eleventy/src/blog/blog.11tydata.json`

The orchestrator syncs posts to `benchmarks/eleventy/src/blog/`. The `blog.11tydata.json` directory data file applies a layout and a permalink template (`/blog/{{ page.fileSlug }}.html`) to all Markdown files in that directory, producing `dist/blog/post-001.html` style output consistent with WaldJS and Astro.

- [ ] **Step 1: Create `benchmarks/eleventy/package.json`**

Note: NO `"type": "module"` — `.eleventy.js` uses CommonJS.

```json
{
  "name": "@waldjs/benchmark-eleventy",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "build": "eleventy"
  },
  "dependencies": {
    "@11ty/eleventy": "^3.0.0"
  }
}
```

- [ ] **Step 2: Create `benchmarks/eleventy/.eleventy.js`**

```js
module.exports = function (eleventyConfig) {
  eleventyConfig.addCollection('post', function (api) {
    return api.getFilteredByTag('post')
  })

  return {
    dir: {
      input: 'src',
      output: 'dist',
      includes: '_includes',
    },
    markdownTemplateEngine: 'njk',
    htmlTemplateEngine: 'njk',
  }
}
```

- [ ] **Step 3: Create `benchmarks/eleventy/src/_includes/base.njk`**

```html
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>{{ title }}</title></head>
<body>
{{ content | safe }}
</body>
</html>
```

- [ ] **Step 4: Create `benchmarks/eleventy/src/_includes/post.njk`**

```html
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>{{ title }}</title></head>
<body>
<h1>{{ title }}</h1>
{{ content | safe }}
<button class="counter" data-count="0" style="padding:8px 16px;font-size:1rem">0</button>
<script>
  document.querySelectorAll('.counter').forEach(function (btn) {
    var n = parseInt(btn.dataset.count || '0')
    btn.onclick = function () { btn.textContent = String(++n) }
  })
</script>
</body>
</html>
```

- [ ] **Step 5: Create `benchmarks/eleventy/src/index.njk`**

```njk
---
layout: base.njk
title: Eleventy Benchmark
permalink: /index.html
---
<h1>Eleventy Benchmark</h1>
<p>A benchmark site built with Eleventy.</p>
<nav><a href="/blog/">Blog</a></nav>
```

- [ ] **Step 6: Create `benchmarks/eleventy/src/blog-index.njk`**

```njk
---
layout: base.njk
title: Blog
permalink: /blog/index.html
eleventyExcludeFromCollections: true
---
<h1>Blog</h1>
<ul>
  {%- for post in collections.post %}
  <li><a href="{{ post.url }}">{{ post.data.title }}</a></li>
  {%- endfor %}
</ul>
```

- [ ] **Step 7: Create `benchmarks/eleventy/src/blog/blog.11tydata.json`**

This directory data file applies to all Markdown posts synced into `src/blog/` by the orchestrator.

```json
{
  "layout": "post.njk",
  "tags": "post",
  "permalink": "/blog/{{ page.fileSlug }}.html"
}
```

- [ ] **Step 8: Install Eleventy variant deps**

```bash
cd benchmarks/eleventy && pnpm install
```

Expected: `@11ty/eleventy` installed. No errors.

- [ ] **Step 9: Sync content and verify Eleventy build**

```bash
mkdir -p benchmarks/eleventy/src/blog
cp benchmarks/content/blog/*.md benchmarks/eleventy/src/blog/
cd benchmarks/eleventy && pnpm build
```

Expected: `dist/` with `index.html`, `blog/index.html`, `blog/post-001.html` … `blog/post-050.html`.

```bash
ls benchmarks/eleventy/dist/blog/*.html | wc -l
```

Expected: `51`.

- [ ] **Step 10: Commit**

```bash
git add benchmarks/eleventy/
git commit -m "feat(benchmarks): add Eleventy variant site"
```

---

## Task 6: Orchestrator script

**Files:**
- Create: `benchmarks/scripts/bench.ts`

The orchestrator:
1. Syncs content from `benchmarks/content/blog/` to each framework's content directory
2. Installs framework deps if `node_modules/` doesn't exist yet
3. Times three builds per framework (clears `dist/` before each), reports median
4. For each framework, starts a static server (sirv) on port 4321, runs Lighthouse on 5 pages using the Lighthouse Node API, stops the server
5. Writes `results/latest.json`

- [ ] **Step 1: Create `benchmarks/scripts/bench.ts`**

```typescript
import { execSync } from 'node:child_process'
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { createServer } from 'node:http'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as chromeLauncher from 'chrome-launcher'
import lighthouse from 'lighthouse'
import sirv from 'sirv'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

type Framework = 'wald' | 'astro' | 'eleventy'

const FRAMEWORKS: Framework[] = ['wald', 'astro', 'eleventy']

const CONTENT_DEST: Record<Framework, string> = {
  wald: 'content/blog',
  astro: 'src/content/blog',
  eleventy: 'src/blog',
}

const PAGES = ['/', '/blog/', '/blog/post-001', '/blog/post-025', '/blog/post-050']
const PORT = 4321
const BUILD_RUNS = 3

interface LighthouseScores {
  performance: number
  accessibility: number
  bestPractices: number
  seo: number
}

interface FrameworkResult {
  buildMs: number | 'BUILD_FAILED'
  lighthouse: LighthouseScores | 'LIGHTHOUSE_FAILED'
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)]
}

function avg(values: number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length
}

function syncContent(fw: Framework): void {
  const src = join(root, 'content/blog')
  const dest = join(root, fw, CONTENT_DEST[fw])
  mkdirSync(dest, { recursive: true })
  for (const file of readdirSync(src)) {
    copyFileSync(join(src, file), join(dest, file))
  }
}

function ensureInstalled(fw: Framework): void {
  const nodeModules = join(root, fw, 'node_modules')
  if (!existsSync(nodeModules)) {
    console.log(`  [${fw}] Installing dependencies...`)
    execSync('pnpm install', { cwd: join(root, fw), stdio: 'pipe' })
  }
}

function timeBuild(fw: Framework): number | 'BUILD_FAILED' {
  const times: number[] = []
  for (let i = 0; i < BUILD_RUNS; i++) {
    try {
      rmSync(join(root, fw, 'dist'), { recursive: true, force: true })
      const start = performance.now()
      execSync('pnpm build', { cwd: join(root, fw), stdio: 'pipe' })
      times.push(performance.now() - start)
      console.log(`  [${fw}] Run ${i + 1}/${BUILD_RUNS}: ${Math.round(times[i])}ms`)
    } catch (err) {
      console.error(`  [${fw}] Build run ${i + 1} failed:`, (err as Error).message.slice(0, 200))
      return 'BUILD_FAILED'
    }
  }
  return Math.round(median(times))
}

function startServer(distDir: string): Promise<ReturnType<typeof createServer>> {
  return new Promise((resolve) => {
    const handler = sirv(distDir)
    const server = createServer(handler)
    server.listen(PORT, () => resolve(server))
  })
}

async function runLighthouse(fw: Framework): Promise<LighthouseScores | 'LIGHTHOUSE_FAILED'> {
  const distDir = join(root, fw, 'dist')
  const server = await startServer(distDir)
  const chrome = await chromeLauncher.launch({
    chromeFlags: ['--headless', '--no-sandbox', '--disable-gpu'],
  })

  const scores: Record<string, number[]> = {
    performance: [],
    accessibility: [],
    bestPractices: [],
    seo: [],
  }

  for (const page of PAGES) {
    try {
      const result = await lighthouse(`http://localhost:${PORT}${page}`, {
        port: chrome.port,
        output: 'json',
        logLevel: 'error',
        onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
      })
      if (!result) continue
      const cats = result.lhr.categories
      scores.performance.push((cats['performance']?.score ?? 0) * 100)
      scores.accessibility.push((cats['accessibility']?.score ?? 0) * 100)
      scores.bestPractices.push((cats['best-practices']?.score ?? 0) * 100)
      scores.seo.push((cats['seo']?.score ?? 0) * 100)
    } catch {
      console.error(`  [${fw}] Lighthouse failed for ${page}`)
    }
  }

  await chrome.kill()
  await new Promise<void>((resolve) => server.close(() => resolve()))

  if (scores.performance.length === 0) return 'LIGHTHOUSE_FAILED'

  return {
    performance: Math.round(avg(scores.performance)),
    accessibility: Math.round(avg(scores.accessibility)),
    bestPractices: Math.round(avg(scores.bestPractices)),
    seo: Math.round(avg(scores.seo)),
  }
}

async function main(): Promise<void> {
  console.log('WaldJS Benchmark Suite\n')

  if (!existsSync(join(root, 'content/blog'))) {
    console.error('Run `pnpm generate` first to create shared content.')
    process.exit(1)
  }

  const results: Record<string, FrameworkResult> = {}

  for (const fw of FRAMEWORKS) {
    console.log(`\n[${fw}]`)
    syncContent(fw)
    ensureInstalled(fw)

    const buildMs = timeBuild(fw)
    console.log(`  Build median: ${buildMs === 'BUILD_FAILED' ? 'FAILED' : `${buildMs}ms`}`)

    let lighthouseResult: LighthouseScores | 'LIGHTHOUSE_FAILED' = 'LIGHTHOUSE_FAILED'
    if (buildMs !== 'BUILD_FAILED') {
      console.log(`  Lighthouse on ${PAGES.length} pages...`)
      lighthouseResult = await runLighthouse(fw)
      if (lighthouseResult !== 'LIGHTHOUSE_FAILED') {
        console.log(`  Perf: ${lighthouseResult.performance}  A11y: ${lighthouseResult.accessibility}  Best: ${lighthouseResult.bestPractices}  SEO: ${lighthouseResult.seo}`)
      }
    }

    results[fw] = { buildMs, lighthouse: lighthouseResult }
  }

  mkdirSync(join(root, 'results'), { recursive: true })
  const output = { timestamp: new Date().toISOString(), results }
  writeFileSync(join(root, 'results/latest.json'), JSON.stringify(output, null, 2))
  console.log('\nResults saved to results/latest.json')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
```

- [ ] **Step 2: Verify TypeScript parses without errors**

```bash
cd benchmarks && pnpm exec tsc --noEmit --module esnext --moduleResolution bundler --target es2022 scripts/bench.ts
```

Expected: no output (no errors).

- [ ] **Step 3: Commit**

```bash
git add benchmarks/scripts/bench.ts
git commit -m "feat(benchmarks): add orchestrator script"
```

---

## Task 7: Report formatter

**Files:**
- Create: `benchmarks/scripts/report.ts`

- [ ] **Step 1: Create `benchmarks/scripts/report.ts`**

```typescript
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const resultsFile = join(__dirname, '../results/latest.json')

interface LighthouseScores {
  performance: number
  accessibility: number
  bestPractices: number
  seo: number
}

interface FrameworkResult {
  buildMs: number | 'BUILD_FAILED'
  lighthouse: LighthouseScores | 'LIGHTHOUSE_FAILED'
}

const data: { timestamp: string; results: Record<string, FrameworkResult> } = JSON.parse(
  readFileSync(resultsFile, 'utf-8'),
)

function pad(s: string, n: number): string {
  return s.padEnd(n)
}

function fmtBuild(ms: number | 'BUILD_FAILED'): string {
  if (ms === 'BUILD_FAILED') return 'FAILED      '
  return `${(ms / 1000).toFixed(2)}s`.padEnd(12)
}

function fmtScore(score: number | undefined): string {
  return String(score ?? 'N/A').padEnd(6)
}

console.log('\nWaldJS Benchmark Results')
console.log(`Run: ${data.timestamp}\n`)
console.log(
  pad('Framework', 12) + pad('Build (med)', 13) + pad('Perf', 6) + pad('A11y', 6) + pad('Best', 6) + 'SEO',
)
console.log('─'.repeat(49))

for (const [fw, result] of Object.entries(data.results)) {
  const lh = result.lighthouse === 'LIGHTHOUSE_FAILED' ? null : result.lighthouse
  console.log(
    pad(fw.charAt(0).toUpperCase() + fw.slice(1), 12) +
      fmtBuild(result.buildMs) +
      (lh ? fmtScore(lh.performance) : pad('N/A', 6)) +
      (lh ? fmtScore(lh.accessibility) : pad('N/A', 6)) +
      (lh ? fmtScore(lh.bestPractices) : pad('N/A', 6)) +
      (lh ? lh.seo : 'N/A'),
  )
}
console.log()
```

- [ ] **Step 2: Verify TypeScript parses without errors**

```bash
cd benchmarks && pnpm exec tsc --noEmit --module esnext --moduleResolution bundler --target es2022 scripts/report.ts
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add benchmarks/scripts/report.ts
git commit -m "feat(benchmarks): add report formatter"
```

---

## Task 8: Wire up and verify end-to-end

**Files:**
- No new files — verify the full pipeline works.

**Prerequisite check:** `@waldjs/cli` must be compiled. If `packages/cli/dist/` doesn't exist, run `pnpm build` in the monorepo root first.

- [ ] **Step 1: Verify monorepo build is up to date**

```bash
pnpm build
```

Expected: all packages build successfully. `packages/cli/dist/` exists.

- [ ] **Step 2: Generate content**

```bash
pnpm --filter @waldjs/benchmarks generate
```

Expected: `Generated 50 posts in .../benchmarks/content/blog`

- [ ] **Step 3: Run full benchmark via root script**

```bash
pnpm bench
```

Expected: console output showing per-framework build times and Lighthouse scores, followed by the comparison table. Example:

```
WaldJS Benchmark Suite

[wald]
  [wald] Run 1/3: 1243ms
  [wald] Run 2/3: 1198ms
  [wald] Run 3/3: 1211ms
  Build median: 1211ms
  Lighthouse on 5 pages...
  Perf: 98  A11y: 100  Best: 100  SEO: 100

[astro]
  ...

[eleventy]
  ...

Results saved to results/latest.json

WaldJS Benchmark Results
Run: 2026-06-30T...

Framework   Build (med)  Perf  A11y  Best  SEO
─────────────────────────────────────────────────
Wald        1.21s        98    100   100   100
Astro       4.xx s       ...
Eleventy    2.xx s       ...
```

- [ ] **Step 4: Verify `results/latest.json` is correct**

```bash
cat benchmarks/results/latest.json | head -20
```

Expected: valid JSON with `timestamp`, `results.wald.buildMs` (a number), `results.wald.lighthouse.performance` (0–100).

- [ ] **Step 5: Verify `results/` is gitignored**

```bash
git status benchmarks/results/
```

Expected: no output (results/ is untracked and ignored).

- [ ] **Step 6: Commit**

```bash
git add benchmarks/
git commit -m "feat(benchmarks): complete benchmark suite — WaldJS vs Astro vs Eleventy"
```
