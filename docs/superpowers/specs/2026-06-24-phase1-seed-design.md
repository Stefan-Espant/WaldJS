# Phase 1 — Seed Design

**Date:** 2026-06-24
**Scope:** `@waldjs/cli` package — CLI, dev server, file-based routing, static generation.

---

## Context

Phase 0 leverde de compiler-basis: `@waldjs/compiler` (parse, transform, compile, Vite plugin) en `@waldjs/runtime` (createTree, renderTemplate). Phase 1 bouwt hierop en maakt WaldJS bruikbaar als framework: een CLI, een dev server, routing en een production build.

**Vastgestelde keuzes:**

| Keuze | Beslissing |
|---|---|
| CLI framework | Citty |
| Dev server | Vite middleware + SSR mode |
| `wald plant` | Minimale scaffold |
| Dynamic routes in build | Nee — alleen dev; `getStaticPaths()` komt in Phase 2 |

---

## Package Structuur

Er komt één nieuw package: `packages/cli/`. De bestaande `@waldjs/compiler` en `@waldjs/runtime` worden als dependency gebruikt.

```
packages/cli/
├── src/
│   ├── commands/
│   │   ├── plant.ts     — scaffold nieuw project
│   │   ├── grow.ts      — dev server (Vite middleware + SSR)
│   │   ├── build.ts     — static generation
│   │   └── preview.ts   — serve dist/ als statische bestanden
│   ├── router/
│   │   └── index.ts     — file-based routing: scan + match
│   ├── shell.ts         — HTML wrapper (hardcoded; layouts in Phase 2)
│   └── index.ts         — Citty entry point
├── bin/
│   └── wald.js          — executable entry point
├── package.json
└── tsconfig.json
```

---

## Router

De router scant `src/pages/` en bouwt een route-tabel.

### File → URL mapping

```
src/pages/index.wald          →  /
src/pages/about.wald          →  /about
src/pages/blog/index.wald     →  /blog
src/pages/blog/[slug].wald    →  /blog/:slug
```

### Publieke API

```ts
export type Route = {
  pattern: string           // '/blog/:slug'
  file: string              // absoluut pad naar .wald bestand
  params: string[]          // ['slug'] — leeg voor statische routes
}

export function scanRoutes(pagesDir: string): Route[]

export function matchRoute(
  routes: Route[],
  url: string
): { route: Route; params: Record<string, string> } | null
```

### Dynamic routes

Dynamic routes (`[param]`) worden volledig ondersteund in `wald grow` — URL matching en param extractie werken. In `wald build` worden ze overgeslagen met een terminal-waarschuwing. Phase 2 voegt `getStaticPaths()` toe samen met content collections.

---

## Dev Server — `wald grow`

```
wald grow
  ↓
scanRoutes('src/pages/') → routes
  ↓
Vite createServer({
  server: { middlewareMode: true },
  plugins: [waldPlugin()]
})
  ↓
Custom Connect middleware per request:
  1. matchRoute(routes, url) → { route, params }
     Geen match → 404 "Page not found"
  2. vite.ssrLoadModule(route.file) → { default: Tree }
  3. Tree.render() → HTML string
  4. wrapHtml(html) → volledige pagina → HTTP response
```

Vite's HMR werkt automatisch — wijziging in een `.wald` bestand invalideert de module en herlaadt de browser.

**Poort:** 7233 (TREE: T=7, R=2, E=3, E=3)

---

## HTML Shell

Hardcoded in Phase 1. In Phase 2 vervangen door layout support.

```ts
export function wrapHtml(content: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width">
  <title>WaldJS</title>
</head>
<body>
${content}
</body>
</html>`
}
```

---

## Static Generation — `wald build`

```
wald build
  ↓
scanRoutes('src/pages/') → routes
  ↓
Filter: routes zonder params (statische routes)
Dynamic routes → log waarschuwing, overslaan
  ↓
Per statische route:
  1. fs.readFile(route.file) → source
  2. compile(source, route.file) → JS module string
  3. patch '@waldjs/runtime' → absoluut bestandspad
  4. import(`data:text/javascript,${encodeURIComponent(patched)}`) → { default: Tree }
  5. Tree.render() → HTML string
  6. wrapHtml(html) → schrijf naar dist/[route.pattern]/index.html
  ↓
Kopieer public/ → dist/ (als public/ bestaat)
```

### Output structuur

```
dist/
├── index.html              ← src/pages/index.wald
├── about/
│   └── index.html          ← src/pages/about.wald
└── blog/
    └── index.html          ← src/pages/blog/index.wald
```

---

## Preview — `wald preview`

Serveert `dist/` als statische bestanden via `sirv`.

**Poort:** 4321

---

## Project Scaffolding — `wald plant`

```bash
wald plant my-forest
```

Genereert:

```
my-forest/
├── src/
│   └── pages/
│       └── index.wald
├── package.json
└── .gitignore
```

**`src/pages/index.wald`:**
```wald
---
const title = "Hello Wald"
---
<h1>{title}</h1>
<p>Welcome to your forest.</p>
```

**`package.json`:**
```json
{
  "name": "my-forest",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "wald grow",
    "build": "wald build",
    "preview": "wald preview"
  },
  "dependencies": {
    "@waldjs/cli": "latest"
  }
}
```

**`.gitignore`:**
```
node_modules
dist
```

**Terminal output na scaffolding:**
```
✓ Created my-forest

  cd my-forest
  pnpm install
  pnpm dev
```

---

## Runtime Update

Phase 1 vereist een kleine aanpassing aan `@waldjs/runtime`. `Tree.render()` moet props accepteren zodat route-params doorgegeven kunnen worden aan pagina's.

**Huidige signatuur:**
```ts
export type Tree = { render: () => Promise<string> }
export function createTree(fn: RenderFn): Tree {
  return { render: () => fn({}, {}) }
}
```

**Nieuwe signatuur (backward-compatible):**
```ts
export type Tree = { render: (props?: Record<string, unknown>) => Promise<string> }
export function createTree(fn: RenderFn): Tree {
  return { render: (props = {}) => fn({}, props) }
}
```

De dev server roept dan `Tree.render({ slug: 'hello-world' })` aan. Bestaande pagina's zonder props blijven werken — `props` is optioneel.

---

## Acceptatiecriteria Phase 1

- `wald plant my-forest` genereert een werkend project
- `wald grow` start een dev server op poort 7233
- `src/pages/index.wald` is bereikbaar op `http://localhost:7233/`
- `src/pages/about.wald` is bereikbaar op `http://localhost:7233/about`
- `src/pages/blog/[slug].wald` matcht op `http://localhost:7233/blog/hello-world` met `$$props.slug === 'hello-world'`
- `wald build` genereert `dist/index.html` en `dist/about/index.html`
- `wald preview` serveert `dist/` op poort 4321
- Wijziging in `.wald` bestand herlaadt de browser automatisch

---

## Buiten Scope (Phase 1)

- `getStaticPaths()` voor dynamic routes in build
- Layouts (`<Layout />`)
- Componenten
- Content collections
- `wald.config.ts`
- Assets bundling (CSS, afbeeldingen)
- `<head>` management per pagina
