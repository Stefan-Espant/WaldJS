# WaldJS

[![npm version](https://img.shields.io/npm/v/@waldjs/cli.svg)](https://www.npmjs.com/package/@waldjs/cli)
[![license](https://img.shields.io/npm/l/@waldjs/cli.svg)](LICENSE)

A content-first web framework for building fast, static-first websites. Write `.wald` files — part Markdown frontmatter, part HTML template — and WaldJS compiles them into a static site.

<img width="1954" height="1254" alt="Scherm­afbeelding 2026-07-08 om 07 40 00" src="https://github.com/user-attachments/assets/eb33ec5d-85ef-469e-85c4-ba08326f30b2" />

---

## Quick start

```bash
npm create wald@latest my-forest
cd my-forest
npm run dev
```

Or with pnpm:

```bash
pnpm create wald my-forest
cd my-forest
pnpm dev
```

`create wald` scaffolds the project and installs dependencies for you — no separate install step needed.

---

## The `.wald` file format

A `.wald` file has two parts separated by `---`:

```wald
---
const title = "Hello World"
---
<h1>{title}</h1>
<p>Welcome to your forest.</p>
```

The top part (frontmatter) is plain JavaScript/TypeScript. The bottom part is an HTML template where `{expression}` interpolates values. All interpolated values are HTML-escaped by default.

---

## Pages

Files in `src/pages/` become routes automatically:

| File | Route |
|---|---|
| `src/pages/index.wald` | `/` |
| `src/pages/about.wald` | `/about` |
| `src/pages/blog/index.wald` | `/blog` |
| `src/pages/blog/[slug].wald` | `/blog/:slug` |

---

## Content collections

Put Markdown files in `content/<collection>/`:

```
content/
└── blog/
    ├── hello-world.md
    └── second-post.md
```

Each Markdown file has YAML frontmatter:

```md
---
title: Hello World
date: 2026-06-28
---

This is the content of the post.
```

Import `getCollection` and `getEntry` from `wald:content` in your page frontmatter:

```wald
---
import { getCollection } from 'wald:content'
const posts = await getCollection('blog')
---
<ul>
  {posts.map(p => '<li>' + p.data.title + '</li>').join('')}
</ul>
```

Each entry has three fields:

```ts
type Entry = {
  slug: string                   // filename without .md
  data: Record<string, unknown>  // frontmatter fields
  body: string                   // rendered HTML
}
```

---

## Dynamic routes with `getStaticPaths()`

For dynamic routes like `src/pages/blog/[slug].wald`, export `getStaticPaths()` from the frontmatter. `wald build` calls it to know which pages to generate.

```wald
---
import { getCollection, getEntry } from 'wald:content'

export async function getStaticPaths() {
  const posts = await getCollection('blog')
  return posts.map(p => ({ params: { slug: p.slug } }))
}

const post = await getEntry('blog', $$props.slug)
---
<h1>{post.data.title}</h1>
<div>{post.body}</div>
```

`$$props` contains the route params during rendering.

---

## Components & layouts

Any `.wald` file can be imported and used as a component. Props are passed as attributes; children land in the `pond` prop:

```wald
---
import Layout from '../layouts/Layout.wald'
const title = "Hello World"
---
<Layout title={title}>
  <p>Welcome to your forest.</p>
</Layout>
```

The layout reads its props (including the children) from `$$props`:

```wald
---
const { title, pond } = $$props
---
<html>
  <head><title>{title}</title></head>
  <body>
    {pond}
  </body>
</html>
```

---

## Images

Import `Image` from `wald:image` to serve a responsive, optimized image instead of a plain `<img>`:

```wald
---
import { Image } from 'wald:image'
---
<Image src="/assets/hero.jpg" alt="A misty forest" widths={[400, 800, 1200]} />
```

`src` points at a file under `src/assets/`, same as a plain `<img src="/assets/...">` would. `wald build` resizes the image to each requested width (`[400, 800]` by default), converts it to WebP, and writes the variants to `dist/assets/optimized/`; the rendered `<img>` gets a matching `srcset`/`sizes` plus the source's natural `width`/`height`. Formats WebP can't usefully re-encode (SVG, GIF) are copied through unprocessed instead of failing the build.

`wald grow` skips optimization entirely and serves the original file as-is — resizing/converting on every dev-server request would slow down the edit-reload loop for no benefit, since only the production build's output matters for real users.

---

## Canopy islands

Pages ship 0 KB JavaScript by default. To make a component interactive, give it a `<script>` block that exports a default function and mount it with a `canopy:*` directive:

```wald
---
const { start = 0 } = $$props
---
<button>Clicked {start} times</button>
<script>
export default function (root, props) {
  let count = props.start
  const button = root.querySelector('button')
  button.addEventListener('click', () => {
    button.textContent = `Clicked ${++count} times`
  })
}
</script>
```

```wald
---
import Counter from '../components/Counter.wald'
---
<Counter start={0} canopy:visible />
```

The component is server-rendered as usual, wrapped in a `<wald-canopy>` element, and its script is loaded as an ES module when the strategy fires:

| Directive | Loads |
|---|---|
| `canopy:load` | Immediately on page load |
| `canopy:idle` | When the browser is idle (`requestIdleCallback`) |
| `canopy:visible` | When the island scrolls into view (`IntersectionObserver`) |

Only pages that use islands load the canopy runtime — everything else stays static.

### Script hoisting

Plain `<script>` blocks in templates are hoisted to the end of `<body>` and deduplicated across components. Add `data-wald-no-hoist` to keep a script exactly where you wrote it — for example an inline script in `<head>` that must run before first paint:

```html
<script data-wald-no-hoist>/* runs before first paint */</script>
```

### Link prefetching

Add `wald:prefetch` to any element with an `href` to prefetch that page's HTML before the user clicks:

```wald
<a href="/blog" wald:prefetch="visible">Read the blog</a>
<a href="/pricing" wald:prefetch="hover">See pricing</a>
```

| Value | Prefetches when |
|---|---|
| `wald:prefetch="visible"` | The link scrolls into view (`IntersectionObserver`) |
| `wald:prefetch="hover"` | The user hovers the link (`mouseenter`) |

No compiler support needed — `wald:prefetch` is a plain HTML attribute, so it survives untouched like any other. A small inline runtime is added automatically to a page's HTML, but only if that page actually uses `wald:prefetch` somewhere; pages without it stay at 0 KB JS.

---

## Config file

Create a `wald.config.ts` in your project root to configure the build:

```ts
import { defineConfig } from '@waldjs/cli'

export default defineConfig({
  outDir: 'dist',  // default
  base: '/',       // default — set to '/my-subpath/' for sub-directory deploys
  vite: {          // passed through to Vite (plugins, resolve, etc.)
    plugins: [],
  },
})
```

All options are optional. Without a config file WaldJS uses the defaults above.

### Deployment adapters

Pick an adapter to tailor the build output to your host. The default is `staticAdapter()` — plain static files that work anywhere:

```ts
import { defineConfig, netlifyAdapter } from '@waldjs/cli'

export default defineConfig({
  adapter: netlifyAdapter(),
})
```

| Adapter | Output |
|---|---|
| `staticAdapter()` | Plain static files (default) |
| `netlifyAdapter()` | Adds a `_headers` file with cache rules |
| `cloudflarePagesAdapter()` | Adds a `_headers` file with cache rules |
| `vercelAdapter()` | Builds to `.vercel/output/` with a `config.json` (Build Output API v3) |
| `githubPagesAdapter()` | Adds a `.nojekyll` file and a `404.html` fallback (a copy of `index.html`) |
| `denoDeployAdapter()` | Plain static files — Deno Deploy needs no special output shape |

Write your own with `defineAdapter({ name, adapt({ outDir }) { … } })`.

---

## CLI commands

```bash
wald plant <name>   # Create a new project
wald grow           # Start the dev server (http://localhost:7233)
wald build          # Build to dist/ (Vite SSR + static pre-render)
wald preview        # Preview the build (http://localhost:4321)
wald check          # Type-check .wald and .ts files
wald new component <Name>   # Scaffold src/components/<Name>.wald
wald new page <route>       # Scaffold src/pages/<route>.wald
```

`wald grow` live-reloads the browser whenever a `.wald` page/component or a `content/` entry changes — no manual refresh needed. Reloads are full-page (the render pipeline re-runs per request; there's no partial/state-preserving hot update yet).

`wald new page` understands dynamic segments — `wald new page blog/[slug]` scaffolds a typed `Props` and a `getStaticPaths()` stub, the same shape `wald plant`'s own starter uses.

When a `.wald` file fails to compile or a page throws while rendering, `wald grow` responds with a readable HTML error page (message, file/line, code frame, and stack) instead of a bare 500 — no need to go dig through the terminal.

---

## Project structure

```
my-forest/
├── content/
│   └── blog/
│       └── hello-world.md
├── src/
│   ├── layouts/
│   │   └── Layout.wald
│   ├── components/
│   │   └── Card.wald
│   └── pages/
│       ├── index.wald
│       └── blog/
│           ├── index.wald
│           └── [slug].wald
├── public/              # Copied to dist/ as-is
├── wald.config.ts       # Optional config
└── package.json
```

---

## The forest metaphor

WaldJS uses a forest metaphor throughout:

| Term | Meaning |
|---|---|
| **Wald** | The forest — your whole website |
| **Roots** | The compiler that transforms `.wald` files |
| **Trees** | Pages — `.wald` files in `src/pages/` |
| **Branches** | Components — reusable `.wald` files |
| **Canopies** | Client-side hydration — islands via `canopy:load`, `canopy:idle` and `canopy:visible` |

---

## Packages

| Package | Description |
|---|---|
| `@waldjs/cli` | The `wald` CLI — `plant`, `grow`, `build`, `preview` |
| `@waldjs/compiler` | Compiles `.wald` files to JavaScript modules |
| `@waldjs/runtime` | Runtime helpers — `createTree`, `renderTemplate` |
| `@waldjs/content` | Content collection reader — `readCollection`, `readEntry` |
| `@waldjs/canopy` | The `<wald-canopy>` element that hydrates islands client-side |

---

## Development

This is a pnpm monorepo using Turborepo.

```bash
pnpm install       # Install all dependencies
pnpm build         # Build all packages
pnpm test          # Run all tests
```

Phases:

- **Phase 0 — Roots:** Compiler (parser + transform) ✅
- **Phase 1 — Seed:** CLI (`plant`, `grow`, `build`, `preview`) ✅
- **Phase 2a — Sapling:** Content collections + `getStaticPaths()` ✅
- **Phase 2b — Branches:** Components + layouts ✅
- **Phase 3 — Canopy:** Client-side hydration ✅
- **Phase 4a — Forest:** Vite plugin (`vite-plugin-wald`) ✅
- **Phase 4b — Forest:** `wald.config.ts` + Vite SSR build pipeline ✅
- **Phase 4c — Forest:** Deployment adapters ✅
