# Phase 2a — Sapling: Content Collections & Static Paths

**Date:** 2026-06-28
**Scope:** `@waldjs/content` package + compiler uitbreiding + CLI aanpassingen voor content-driven static generation.

---

## Context

Phase 1 leverde de CLI-basis: `wald grow`, `wald build`, `wald preview`, `wald plant`. Dynamic routes werken in `wald grow` maar worden overgeslagen in `wald build` met een waarschuwing. Phase 2a lost dit op door content collections en `getStaticPaths()` toe te voegen — het fundament voor een content-first website (blog, docs, portfolio).

**Vastgestelde keuzes:**

| Keuze | Beslissing |
|---|---|
| Content formaat | Markdown (`.md`) met frontmatter |
| Mapstructuur | `content/<collection>/*.md` naast `src/` |
| Collection API | Virtual module `wald:content` |
| `getStaticPaths()` | Export in frontmatter van de `.wald` pagina |
| Markdown parser | `gray-matter` (frontmatter) + `marked` (body → HTML) |

---

## Projectstructuur

Een WaldJS project met Phase 2a:

```
my-forest/
├── content/
│   └── blog/
│       ├── hello-world.md
│       └── second-post.md
├── src/
│   └── pages/
│       ├── index.wald
│       └── blog/
│           ├── index.wald         ← lijst alle posts
│           └── [slug].wald        ← individuele post
├── public/
└── package.json
```

Een Markdown-bestand:

```md
---
title: Hello World
date: 2026-06-28
---

Dit is de inhoud van de post.
```

---

## Entry Type

Elke collection entry heeft drie velden:

```ts
export type Entry = {
  slug: string                      // bestandsnaam zonder .md
  data: Record<string, unknown>     // frontmatter
  body: string                      // Markdown omgezet naar HTML
}
```

---

## Collection API (`wald:content`)

Virtual module beschikbaar in elke `.wald` pagina via `wald grow` (Vite plugin) en `wald build` (data: URL import met runtime patching).

### `getCollection(name)`

Geeft alle entries van een collection terug, gesorteerd op bestandsnaam.

```wald
---
import { getCollection } from 'wald:content'
const posts = await getCollection('blog')
---
<h1>Blog</h1>
<ul>
  {posts.map(p => `<li><a href="/blog/${p.slug}">${p.data.title}</a></li>`).join('')}
</ul>
```

### `getEntry(collection, slug)`

Geeft één entry terug op slug. Gooit een fout als de entry niet bestaat.

```wald
---
import { getEntry } from 'wald:content'
const post = await getEntry('blog', $$props.slug)
---
<h1>{post.data.title}</h1>
<div>{post.body}</div>
```

---

## `getStaticPaths()`

Een dynamic route exporteert `getStaticPaths()` uit de frontmatter. De functie geeft een array van `{ params }` terug.

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

`wald build` roept `getStaticPaths()` aan voor elke dynamic route en genereert een HTML-bestand per set params. `wald grow` gebruikt de bestaande URL-matching — `getStaticPaths()` wordt niet aangeroepen in dev.

---

## Build Output

```
dist/
├── index.html
└── blog/
    ├── index.html           ← src/pages/blog/index.wald
    ├── hello-world/
    │   └── index.html       ← slug = 'hello-world'
    └── second-post/
        └── index.html       ← slug = 'second-post'
```

---

## Pakketstructuur

### Nieuw: `packages/content/`

```
packages/content/
├── src/
│   └── index.ts     — readCollection, readEntry, Entry type
├── package.json
└── tsconfig.json
```

**Publieke API:**

```ts
export type Entry = {
  slug: string
  data: Record<string, unknown>
  body: string
}

export function readCollection(name: string, contentDir: string): Promise<Entry[]>
export function readEntry(collection: string, slug: string, contentDir: string): Promise<Entry>
```

Dependencies: `gray-matter`, `marked`.

### Uitbreiding `packages/compiler/`

**Virtual module plugin:** `waldPlugin()` krijgt een extra Vite virtual module plugin die `wald:content` resolvet. De resolved module exporteert `getCollection` en `getEntry` als wrappers om `readCollection`/`readEntry` met `process.cwd()/content/` als `contentDir`.

**Export hoisting in de transform:** De huidige compiler wikkelt alle frontmatter-code in de `createTree` callback. `export`-declaraties in de frontmatter zijn daarbinnen syntactisch ongeldig. De transform moet `export`-statements detecteren en naar module-niveau hijsen.

Input:
```wald
---
export async function getStaticPaths() { ... }
const post = await getEntry('blog', $$props.slug)
---
<h1>{post.data.title}</h1>
```

Output na hoisting:
```js
import { createTree, renderTemplate } from '@waldjs/runtime'

export async function getStaticPaths() { ... }   // ← gehesen naar module-niveau

export default createTree(async ($$result, $$props) => {
  const post = await getEntry('blog', $$props.slug)
  return renderTemplate`<h1>${post.data.title}</h1>`
})
```

```ts
// Virtual module output (vereenvoudigd)
import { readCollection, readEntry } from '@waldjs/content'
const contentDir = '/path/to/project/content'

export const getCollection = (name) => readCollection(name, contentDir)
export const getEntry = (collection, slug) => readEntry(collection, slug, contentDir)
```

### Uitbreiding `packages/cli/`

**`wald build`:**
- Dynamic routes worden niet meer overgeslagen met een warning
- Compiler-output van een dynamic route pagina wordt geïnspecteerd op `getStaticPaths` export
- `getStaticPaths()` wordt aangeroepen, geeft `{ params }[]` terug
- Per set params wordt de pagina gerenderd met `Tree.render(params)` en weggeschreven naar `dist/`
- `'wald:content'` wordt gepatcht naar de resolved `@waldjs/content` URL (zelfde aanpak als `@waldjs/runtime`)

**`wald plant`:**
- Scaffoldt `content/blog/hello-world.md` als voorbeeld
- Scaffoldt `src/pages/blog/index.wald` (listing) en `src/pages/blog/[slug].wald` (detail) als startpunt

---

## Acceptatiecriteria Phase 2a

- `getCollection('blog')` in een `.wald` pagina geeft alle entries uit `content/blog/*.md` terug
- `getEntry('blog', 'hello-world')` geeft één entry terug met `slug`, `data` en `body`
- `body` is gerenderde HTML, niet raw Markdown
- `wald grow` serveert `/blog/hello-world` via de bestaande dynamic route matching
- `wald build` roept `getStaticPaths()` aan en genereert `dist/blog/hello-world/index.html`
- `wald plant` scaffoldt een werkend content-driven startproject
- De `wald:content` virtual module werkt in zowel `wald grow` als `wald build`

---

## Buiten Scope (Phase 2a)

- Schema-validatie per collection (Zod/TypeBox)
- MDX-ondersteuning
- Geneste collections
- Sortering/filtering in `getCollection()` (gebruiker doet dit zelf in frontmatter-code)
- Layouts (`<Layout />`) — Phase 2b
- Componenten — Phase 2b
