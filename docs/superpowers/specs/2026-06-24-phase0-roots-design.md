# Phase 0 — Roots Compiler Design

**Date:** 2026-06-24
**Scope:** `@waldjs/compiler` package only — no CLI, no dev server, no routing.

---

## Context

WaldJS is een content-first web framework. De roadmap is opgesplitst in fasen om token-efficiënt te werken en subagents maximaal te kunnen inzetten. Phase 0 legt de compiler-basis waarop alle latere fasen bouwen.

**Vastgestelde keuzes uit de brainstorm:**

| Keuze | Beslissing |
|---|---|
| Parser strategie | Transform-to-Module (zoals Astro) |
| Build engine | Vite |
| Template expressies | Alle JS expressies — geen restrictie |
| Architectuur | `@waldjs/compiler` package + Vite plugin |

---

## Monorepo Setup

**Tooling:** pnpm workspaces + Turborepo

```
wald/
├── packages/
│   └── compiler/         ← alles voor Phase 0
├── examples/
└── package.json
```

Phase 0 raakt alleen `packages/compiler`. De andere packages (`cli`, `runtime`, `content`, `garden`, `integrations`) worden aangemaakt als lege placeholders.

---

## Compile Pipeline

```
.wald bestand
    ↓
1. parse()      → WaldDocument AST
    ↓
2. transform()  → JS module string
    ↓
3. Vite SSR     → importeert module via importModule()
                  roept de tree aan: await tree.render()
    ↓
4. HTML string  → output
```

De gegenereerde JS module is volledig intern — de developer ziet hem nooit.

### Transform voorbeeld

Input (`index.wald`):

```wald
---
const title = "Hello Wald"
---

<h1>{title}</h1>
```

Gegenereerde module (intern):

```js
import { createTree, renderTemplate } from '@waldjs/runtime'

export default createTree(async ($$result, $$props) => {
  const title = "Hello Wald"

  return renderTemplate`<h1>${title}</h1>`
})
```

- `createTree` = Wald equivalent van Astro's `createComponent`
- `renderTemplate` = tagged template literal die HTML escaped
- `$$` prefix op parameters voorkomt conflicten met frontmatter variabelen

---

## WaldAST

### Node Types

```ts
type WaldDocument = {
  type: 'document'
  frontmatter: FrontmatterNode
  template: TemplateNode[]
}

type FrontmatterNode = {
  type: 'frontmatter'
  code: string  // raw JS/TS code
}

type TemplateNode =
  | ElementNode
  | TextNode
  | ExpressionNode
  | ComponentNode  // gedefinieerd, niet geïmplementeerd in Phase 0

type ElementNode = {
  type: 'element'
  tag: string
  attrs: AttributeNode[]
  children: TemplateNode[]
}

type TextNode = {
  type: 'text'
  value: string
}

type ExpressionNode = {
  type: 'expression'
  code: string  // raw JS expressie — wordt letterlijk geemit
}

type AttributeNode = {
  type: 'attribute'
  name: string
  value: string | ExpressionNode
}

type ComponentNode = {
  type: 'component'
  name: string
  attrs: AttributeNode[]
  children: TemplateNode[]
}
```

### Voorbeeld AST

Voor `<h1 class="title">{title}</h1>`:

```json
{
  "type": "document",
  "frontmatter": {
    "type": "frontmatter",
    "code": "const title = \"Hello Wald\""
  },
  "template": [{
    "type": "element",
    "tag": "h1",
    "attrs": [{ "type": "attribute", "name": "class", "value": "title" }],
    "children": [{ "type": "expression", "code": "title" }]
  }]
}
```

---

## Parser

De parser werkt in twee stappen:

**Stap 1 — Frontmatter extractie**

Split de source op de eerste en tweede `---` delimiter. Alles ertussen is de raw frontmatter JS string. Geen externe parser nodig.

**Stap 2 — Template scanner**

Een hand-written karakter-voor-karakter scanner herkent:
- `<tag attr="val">` → `ElementNode`
- `</tag>` → sluit element
- `{expression}` → `ExpressionNode` (code letterlijk overgenomen)
- Overige tekst → `TextNode`

Geen externe HTML parser — de `.wald` template subset is klein genoeg om zelf te scannen. Dit geeft betere foutmeldingen en nul dependencies.

---

## Dependency Graph

```ts
type DependencyGraph = {
  nodes: Map<string, GraphNode>
}

type GraphNode = {
  file: string        // absoluut pad naar .wald bestand
  mtime: number       // last modified timestamp
  imports: string[]   // component dependencies (Phase 2+)
  output: string | null  // gecached HTML output
}
```

**Incremental compilation:**

```ts
function needsRecompile(node: GraphNode): boolean {
  const stat = fs.statSync(node.file)
  return stat.mtimeMs !== node.mtime
}
```

In Phase 0 is `imports` altijd leeg — elke pagina is onafhankelijk. De graph structuur is alvast gereed voor Phase 2 wanneer component dependencies erbij komen.

---

## Vite Plugin

```ts
import type { Plugin } from 'vite'
import { compile } from '../index'

export function waldPlugin(): Plugin {
  return {
    name: 'vite-plugin-wald',

    resolveId(id) {
      if (id.endsWith('.wald')) return id
    },

    transform(code, id) {
      if (!id.endsWith('.wald')) return
      return compile(code, id)
    }
  }
}
```

De plugin is intentioneel minimaal — alle logica zit in de compiler, niet in de plugin.

---

## Publieke API van `@waldjs/compiler`

```ts
// src/index.ts

export function parse(source: string): WaldDocument
// .wald source → AST

export function transform(ast: WaldDocument): string
// AST → JS module string

export function compile(source: string, id: string): string
// parse + transform in één stap — gebruikt door de Vite plugin

export function waldPlugin(): Plugin
// Vite plugin — re-export voor gemak
```

Alles wat niet hier staat is intern.

---

## Package Structuur

```
packages/compiler/
├── src/
│   ├── parser/
│   │   ├── index.ts        parse()
│   │   ├── frontmatter.ts  --- splitter
│   │   └── scanner.ts      template scanner
│   ├── ast/
│   │   └── types.ts        WaldDocument + alle node types
│   ├── transform/
│   │   └── index.ts        transform()
│   ├── graph/
│   │   └── index.ts        DependencyGraph + needsRecompile
│   ├── vite/
│   │   └── plugin.ts       waldPlugin()
│   └── index.ts            publieke API exports
├── tests/
│   ├── parser.test.ts
│   ├── transform.test.ts
│   └── compile.test.ts
├── package.json
└── tsconfig.json
```

---

## Runtime (minimaal)

Phase 0 vereist een minimale `@waldjs/runtime` met twee exports:

```ts
type RenderFn = ($$result: BuildContext, $$props: Record<string, unknown>) => Promise<string>

type BuildContext = {
  // uitbreidbaar in latere fasen (assets, metadata, etc.)
}

export function createTree(fn: RenderFn): { render: () => Promise<string> }
export function renderTemplate(strings: TemplateStringsArray, ...values: unknown[]): string
```

`renderTemplate` escaped HTML entities in expressies om XSS te voorkomen. De runtime is een aparte package maar bevat in Phase 0 minder dan 50 regels code.

---

## Acceptatiecriteria Phase 0

- `parse('<h1>{title}</h1>')` geeft een correct `WaldDocument` terug
- `compile(source, id)` geeft een geldige JS module string terug
- `waldPlugin()` kan in een Vite config gebruikt worden
- Een `.wald` bestand met frontmatter + template genereert correcte HTML
- Expressies worden HTML-escaped in de output
- Gewijzigde bestanden worden herkend door de dependency graph

---

## Buiten Scope (Phase 0)

- CLI (`wald plant`, `wald grow`, `wald build`)
- Dev server
- File-based routing
- Componenten (`<Button />` — `ComponentNode` is gedefinieerd maar niet geïmplementeerd)
- Layouts
- Markdown / content collections
- Canopy / hydration
- `@waldjs/runtime` buiten de twee Phase 0 functies
