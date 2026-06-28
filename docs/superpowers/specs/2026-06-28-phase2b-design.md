# Phase 2b — Branches: Components & Layouts

**Date:** 2026-06-28
**Scope:** Herbruikbare `.wald` componenten + layouts met volledige HTML-shell controle.

---

## Context

Phase 2a leverde content collections en `getStaticPaths()`. Phase 2b voegt compositie toe: herbruikbare componenten (`src/components/`) en layouts (`src/layouts/`) die de HTML-shell leveren. In de WaldJS-metafoor zijn componenten **Branches** — onderdelen van een Tree.

De parser herkent al `ComponentNode` (uppercase tags). De transform geeft momenteel `''` terug als stub. Phase 2b vult die stub in.

---

## Vastgestelde keuzes

| Keuze | Beslissing |
|---|---|
| Componenten zijn | Gewone `.wald` bestanden, identiek aan pagina's |
| Technische aanpak | Components-as-Trees — zelfde `Tree`/`createTree` abstractie als pagina's |
| Children-prop naam | `pond` — in de WaldJS forest-metafoor stroomt de inhoud van een Tree in de pond van de Layout |
| HTML-shell | Layout levert volledige HTML (inclusief `<!DOCTYPE>`, `<head>`, `<body>`) |
| Shell-detectie | Auto: output die begint met `<!DOCTYPE` of `<html` wordt niet nogmaals gewikkeld |
| Import-syntax | Expliciet in frontmatter — `import Card from '../components/Card.wald'` |
| Unsafe HTML | `SafeHtml` class in runtime — component-output bypassed escaping |

---

## Projectstructuur

```
my-forest/
├── content/
│   └── blog/
├── src/
│   ├── components/        ← herbruikbare .wald bestanden
│   │   └── Card.wald
│   ├── layouts/           ← layouts met volledige HTML-shell
│   │   └── Layout.wald
│   └── pages/
│       ├── index.wald
│       └── blog/
│           ├── index.wald
│           └── [slug].wald
├── public/
└── package.json
```

---

## Component-syntax

### Een component schrijven (`src/components/Card.wald`)

```wald
---
const { title, body } = $$props
---
<article>
  <h2>{title}</h2>
  <p>{body}</p>
</article>
```

Identiek aan een pagina — props via `$$props`, template met `{expressies}`. Geen routing, geen `getStaticPaths`.

### Een component gebruiken

```wald
---
import Card from '../components/Card.wald'
---
<main>
  <Card title="Hoi" body="Tekst" />
</main>
```

- Importeer via frontmatter, zelfde patroon als `wald:content`
- Uppercase eerste letter in de template = component (parser herkent dit al)
- String-props als HTML-attributen: `title="Hoi"`
- Expressie-props met accolades: `title={post.data.title}`

### Layout schrijven (`src/layouts/Layout.wald`)

```wald
---
const { title, pond } = $$props
---
<!DOCTYPE html>
<html lang="nl">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width" />
    <title>{title}</title>
    <link rel="stylesheet" href="/style.css" />
  </head>
  <body>
    {pond}
  </body>
</html>
```

- `pond` bevat de vooraf-gerenderde HTML van de pagina-inhoud
- Layout levert de volledige HTML-shell — `wrapHtml` wordt overgeslagen

### Layout gebruiken in een pagina

```wald
---
import Layout from '../layouts/Layout.wald'
const title = 'Home'
---
<Layout title={title}>
  <h1>Welkom</h1>
  <p>Dit is de inhoud van de pagina.</p>
</Layout>
```

De kinderen van `<Layout>` (de `<h1>` en `<p>`) worden vooraf gerenderd als HTML-string en doorgegeven als `pond` prop.

---

## Technische implementatie

### 1. Runtime: `SafeHtml` + `renderTemplate` update

`packages/runtime/src/index.ts`:

```ts
export class SafeHtml {
  constructor(public readonly value: string) {}
}
```

`renderTemplate` wordt uitgebreid: als een geïnterpoleerde waarde een `SafeHtml` instantie is, wordt de waarde direct ingevoegd (geen escaping). Anders: bestaande `escapeHtml` logica.

```ts
result += (value instanceof SafeHtml ? value.value : escapeHtml(value)) + strings[i + 1]
```

### 2. Compiler transform: `ComponentNode` renderen

`packages/compiler/src/transform/index.ts` — `renderNode` case `'component'` wordt gevuld:

```ts
case 'component': return renderComponent(node)
```

Zonder children (zelfsluitend):
```js
${new SafeHtml(await Card.render({ title: "Hoi", body: "Tekst" }))}
```

Met children (layout-gebruik):
```js
${new SafeHtml(await Layout.render({
  title: "Home",
  pond: new SafeHtml(renderTemplate`<h1>Welkom</h1><p>Inhoud</p>`)
}))}
```

De kinderen worden als geneste `renderTemplate` call gerenderd — waarden daarin worden correct ge-escaped, maar het resulterende HTML-geheel is veilig en wordt als `SafeHtml` doorgegeven.

De compiler importeert `SafeHtml` in de gegenereerde module:

```js
import { createTree, renderTemplate, SafeHtml } from '@waldjs/runtime'
```

### 3. CLI: `maybeWrap` helper

`packages/cli/src/shell.ts` krijgt een nieuwe export:

```ts
export function maybeWrap(html: string): string {
  const t = html.trimStart()
  return t.startsWith('<!DOCTYPE') || t.startsWith('<html')
    ? html
    : wrapHtml(html)
}
```

`wald grow` en `wald build` vervangen `wrapHtml(...)` door `maybeWrap(...)`.

### 4. `wald plant` scaffold

`scaffold()` in `packages/cli/src/commands/plant.ts` voegt toe:

- `src/layouts/Layout.wald` — layout met `pond`, volledige HTML-shell, `<title>{title}</title>`
- `src/components/Card.wald` — eenvoudig kaartcomponent met `title` en `body` props
- `src/pages/index.wald` — bijgewerkt om `<Layout>` en `<Card>` te gebruiken

---

## Gegenereerde module-output

Input (`src/pages/index.wald`):

```wald
---
import Layout from '../layouts/Layout.wald'
import Card from '../components/Card.wald'
const title = 'Home'
---
<Layout title={title}>
  <Card title="Nieuws" body="Laatste update." />
</Layout>
```

Output (gegenereerde JS):

```js
import { createTree, renderTemplate, SafeHtml } from '@waldjs/runtime'
import Layout from '../layouts/Layout.wald'
import Card from '../components/Card.wald'

export default createTree(async ($$result, $$props) => {
  const title = 'Home'

  return renderTemplate`${new SafeHtml(await Layout.render({
    title: (title),
    pond: new SafeHtml(renderTemplate`${new SafeHtml(await Card.render({ title: "Nieuws", body: "Laatste update." }))}`)
  }))}`
})
```

---

## Acceptatiecriteria Phase 2b

- `<Card title="Hoi" />` in een `.wald` pagina rendert de Card-component met de gegeven props
- `<Layout title={title}>...</Layout>` rendert de layout met de pagina-inhoud als `pond`
- Layout-output die begint met `<!DOCTYPE` wordt niet nogmaals gewikkeld in `wrapHtml`
- `wald grow` serveert pagina's met layouts correct
- `wald build` genereert HTML-bestanden met de volledige layout-shell
- `wald plant` scaffoldt een werkend project met `Layout.wald` en `Card.wald`

---

## Buiten Scope (Phase 2b)

- Named slots (meerdere `pond`-achtige props zijn wél mogelijk via gewone props, maar geen speciale syntax)
- Client-side component hydration — Phase 3 (Canopies)
- CSS scoping per component
- Component auto-import (geen directory-scanning, altijd expliciet importeren)
- Props type-validatie
