# WaldJS

A content-first web framework for building fast, static-first websites. Write `.wald` files — part Markdown frontmatter, part HTML template — and WaldJS compiles them into a static site.

> **Status:** Early development. Phase 1 (CLI + routing) and Phase 2a (content collections) are complete. Phase 2b (components + layouts) is in progress.

---

## Quick start

```bash
npm create wald@latest my-forest
cd my-forest
npm install
npm run dev
```

Or with pnpm:

```bash
pnpm dlx @waldjs/cli plant my-forest
cd my-forest
pnpm install
pnpm dev
```

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

## CLI commands

```bash
wald plant <name>   # Create a new project
wald grow           # Start the dev server (http://localhost:7233)
wald build          # Build to dist/
wald preview        # Preview the build (http://localhost:4321)
```

---

## Project structure

```
my-forest/
├── content/
│   └── blog/
│       └── hello-world.md
├── src/
│   └── pages/
│       ├── index.wald
│       └── blog/
│           ├── index.wald
│           └── [slug].wald
├── public/              # Copied to dist/ as-is
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
| **Branches** | Components — reusable `.wald` files *(coming in Phase 2b)* |
| **Canopies** | Client-side hydration *(coming in Phase 3)* |

---

## Packages

| Package | Description |
|---|---|
| `@waldjs/cli` | The `wald` CLI — `plant`, `grow`, `build`, `preview` |
| `@waldjs/compiler` | Compiles `.wald` files to JavaScript modules |
| `@waldjs/runtime` | Runtime helpers — `createTree`, `renderTemplate` |
| `@waldjs/content` | Content collection reader — `readCollection`, `readEntry` |

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
- **Phase 2b — Branches:** Components + layouts 🚧
- **Phase 3 — Canopy:** Client-side hydration
- **Phase 4 — Forest:** Config file, deployment adapters
