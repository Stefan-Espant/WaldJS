# Phase 3 — Canopy Islands

**Date:** 2026-06-30
**Scope:** Client-side hydration via `canopy:*` directives — islands architectuur voor `.wald` componenten.

---

## Context

Phase 3 (vanilla script hoisting) leverde `<script>` blokken die werken als inline vanilla JS. Phase 3b voegt echte islands toe: componenten die server-side gerenderd worden én client-side "wakker worden" via een gebundeld JavaScript module. In de WaldJS-metafoor zijn dit Canopies — de bovenste laag van het bos die licht (= interactiviteit) opvangt.

Het model is opzettelijk gelijk aan Astro's islands: server-rendered HTML als basis, opt-in hydration per component, progressive enhancement. Geen framework-keuze voor de gebruiker.

---

## Vastgestelde keuzes

| Keuze | Beslissing |
|---|---|
| Syntax | `canopy:load`, `canopy:idle`, `canopy:visible` directive op component-tag |
| Wrapper element | `<wald-canopy>` Web Component |
| Script API | `export default function(root, props)` in `<script>` blok van component |
| Props serialisatie | JSON in `data-props` attribuut op `<wald-canopy>` |
| Runtime package | Nieuw `@waldjs/canopy` package |
| Lazy loading | `load` = meteen, `idle` = requestIdleCallback, `visible` = IntersectionObserver |
| Build pipeline | Extra client build pass vóór SSR pass |
| Dev server | Virtual modules via Vite plugin — geen extra stap |
| TypeScript in `<script>` | Ondersteund via Vite bundeling |
| npm imports in `<script>` | Ondersteund via Vite bundeling |

---

## Developer-facing syntax

### Pagina

```html
<!-- src/pages/index.wald -->
---
import Counter from '../components/Counter.wald'
---
<h1>Hallo</h1>
<Counter canopy:load initialCount={5} />
<Counter canopy:visible initialCount={0} />
```

### Component

```html
<!-- src/components/Counter.wald -->
---
const { initialCount = 0 } = $$props
---
<button>{initialCount}</button>
<script>
export default function(root, props) {
  let n = props.initialCount
  root.querySelector('button').onclick = () =>
    root.querySelector('button').textContent = ++n
}
</script>
```

De `<script>` in een component heeft twee gedragingen:
- Normaal gebruik (geen directive) → hoisted inline script, ongewijzigd (Phase 3 oud gedrag)
- `canopy:*` gebruik → gebundeld als client module, `export default` wordt de factory

### Gegenereerde HTML (na build)

```html
<wald-canopy data-src="/assets/counter-def456.js"
             data-strategy="load"
             data-props='{"initialCount":5}'>
  <button>5</button>
</wald-canopy>
<wald-canopy data-src="/assets/counter-def456.js"
             data-strategy="visible"
             data-props='{"initialCount":0}'>
  <button>0</button>
</wald-canopy>
<script type="module" src="/assets/wald-canopy-abc123.js"></script>
```

---

## Architectuur

```
packages/
  canopy/                   ← nieuw
    src/
      index.ts              ← <wald-canopy> custom element definitie
    package.json
  compiler/
    src/
      ast/types.ts          ← ComponentNode uitbreiden met canopy?
      parser/scanner.ts     ← canopy:* attrs detecteren
      transform/index.ts    ← renderComponent() canopy branch
  cli/
    src/
      vite-plugin.ts        ← ?canopy-script virtual module
      commands/build.ts     ← extra client build pass (Pass 0 + 1a)
```

---

## Sectie 1 — `@waldjs/canopy` runtime

```typescript
// packages/canopy/src/index.ts
class WaldCanopy extends HTMLElement {
  async connectedCallback() {
    const src = this.dataset.src!
    const strategy = this.dataset.strategy as 'load' | 'idle' | 'visible'
    const props = JSON.parse(this.dataset.props ?? '{}')

    const run = async () => {
      try {
        const mod = await import(/* @vite-ignore */ src)
        if (typeof mod.default !== 'function') {
          console.error(`[wald-canopy] ${src} does not export a default function`)
          return
        }
        mod.default(this, props)
      } catch (e) {
        console.error(`[wald-canopy] Failed to load ${src}:`, e)
      }
    }

    if (strategy === 'load') {
      run()
    } else if (strategy === 'idle') {
      if ('requestIdleCallback' in window) requestIdleCallback(run)
      else setTimeout(run, 1)
    } else if (strategy === 'visible') {
      const obs = new IntersectionObserver(([entry]) => {
        if (entry.isIntersecting) { obs.disconnect(); run() }
      })
      obs.observe(this)
    }
  }
}

if (!customElements.get('wald-canopy')) {
  customElements.define('wald-canopy', WaldCanopy)
}
```

---

## Sectie 2 — Compiler wijzigingen

### AST types

```typescript
// packages/compiler/src/ast/types.ts
export type ComponentNode = {
  type: 'component'
  name: string
  attrs: AttributeNode[]
  children: TemplateNode[]
  canopy?: { strategy: 'load' | 'idle' | 'visible' }  // nieuw
}
```

### Scanner

Bij het parsen van component-tags (tags die beginnen met hoofdletter): detecteer `canopy:load`, `canopy:idle`, `canopy:visible` attributen, zet ze in `node.canopy`, en filter ze uit `attrs`. Onbekende `canopy:*` waarden geven een parse-error.

### Transform

```typescript
// packages/compiler/src/transform/index.ts

function renderComponent(node: ComponentNode): string {
  // bestaand: geen canopy
  if (!node.canopy) {
    // ... ongewijzigd
  }

  // nieuw: canopy wrapper
  const props = node.attrs
    .map(attr =>
      typeof attr.value === 'string'
        ? `${attr.name}: ${JSON.stringify(attr.value)}`
        : `${attr.name}: (${attr.value.code})`
    )
    .join(', ')

  const propsJson = `JSON.stringify({ ${props} })`
  const strategy = node.canopy.strategy
  const src = `wald:canopy:${node.name}`

  return [
    `\${new SafeHtml(`,
    `  '<wald-canopy data-src="${src}" data-strategy="${strategy}" data-props=\'' +`,
    `  ${propsJson} +`,
    `  '\'>' + await ${node.name}.render({ ${props} }) + '</wald-canopy>'`,
    `)}`,
  ].join('\n')
}
```

`data-src="wald:canopy:Counter"` is een placeholder — de echte asset URL wordt ingevuld door de build pipeline na de client build pass.

---

## Sectie 3 — Build pipeline

### Overzicht

```
Pass 0  — scan: vind alle .wald bestanden met <script> + canopy-gebruik
Pass 1a — client build: bundel canopy scripts + @waldjs/canopy runtime
Pass 1b — SSR build: ongewijzigd (bestaande Pass 1)
Pass 2  — pre-render: placeholder vervangen + runtime script injecteren
```

### Pass 0 — Scan

Parst alle `.wald` bestanden in `src/` met de compiler's parser. Verzamelt:
- Welke componenten een `<script>` blok hebben
- Welke pages/components die component gebruiken met een `canopy:*` directive

Output: `Map<componentName, absoluteFilePath>` — de canopy entry points.

Als een component als `canopy:*` gebruikt wordt maar geen `<script>` blok heeft: build warning, geen error.

### Pass 1a — Client build

```typescript
const canopyEntries = {
  'wald-canopy': '@waldjs/canopy',
  ...Object.fromEntries(
    [...canopyMap.entries()].map(([name, file]) => [
      name.toLowerCase(),
      file + '?canopy-script',
    ])
  ),
}

await build(mergeConfig(config.vite ?? {}, {
  build: {
    ssr: false,
    outDir: distDir,
    emptyOutDir: false,
    rollupOptions: { input: canopyEntries },
  },
  plugins: [waldPlugin()],
}))
```

De Vite plugin levert `Counter.wald?canopy-script` als virtual module: alleen de `<script>` block inhoud van `Counter.wald`, zonder de template.

Output in `distDir/assets/`:
- `wald-canopy-[hash].js`
- `counter-[hash].js`
- etc.

Na Pass 1a: lees de Vite manifest (`dist/.vite/manifest.json`) om de asset URL mapping op te bouwen:
`{ 'wald-canopy': '/assets/wald-canopy-abc.js', 'counter': '/assets/counter-def.js' }`

### Pass 1b — SSR build (ongewijzigd)

Bestaande pass. Bundelt `.wald` pages als SSR modules.

### Pass 2 — Pre-render

Na het renderen van elke HTML string:
1. Vervang alle `data-src="wald:canopy:Counter"` placeholders via de asset manifest
2. Als de HTML canopy-wrappers bevat: injecteer de runtime script voor `</body>`:
   ```html
   <script type="module" src="/assets/wald-canopy-abc123.js"></script>
   ```

### Dev server (`wald grow`)

Vite's dev mode handelt de client modules automatisch af — de Vite plugin levert `?canopy-script` virtual modules, `@waldjs/canopy` wordt als regulier package geïmporteerd. Geen extra stappen nodig.

---

## Sectie 4 — Vite plugin uitbreidingen

```typescript
// packages/cli/src/vite-plugin.ts

resolveId(id) {
  if (id.endsWith('.wald')) return id
  if (id.endsWith('.wald?canopy-script')) return '\0' + id  // virtual
},

async load(id) {
  if (!id.startsWith('\0') || !id.endsWith('.wald?canopy-script')) return
  const file = id.slice(1).replace('?canopy-script', '')
  const source = readFileSync(file, 'utf-8')
  const ast = parse(source)
  const scriptNode = ast.template.find(n => n.type === 'script') as ScriptNode | undefined
  if (!scriptNode) return 'export default function() {}'
  // strip <script>...</script> tags, return content only
  return scriptNode.content.replace(/^<script[^>]*>/, '').replace(/<\/script>$/, '')
},
```

---

## Error handling

| Situatie | Gedrag |
|---|---|
| `canopy:xyz` (onbekende strategy) | Compiler error: `canopy:xyz is not valid — use canopy:load, canopy:idle or canopy:visible` |
| Component zonder `<script>` + `canopy:*` | Build warning: `Counter has no <script> block — canopy:load has no effect` |
| Script bundle laadt niet in browser | `<wald-canopy>` logt `console.error`, server-rendered HTML blijft zichtbaar |
| `mod.default` is geen functie | `console.error` met component naam en src URL |
| Meerdere `<script>` blokken in één component | Eerste script wordt gebruikt als canopy script, rest wordt genegeerd (warning) |

---

## Testing

### `@waldjs/canopy`
- Custom element registered na import
- `canopy:load` → roept factory direct aan
- `canopy:idle` → roept factory aan via requestIdleCallback
- `canopy:visible` → roept factory aan zodra element in viewport komt
- Props worden correct gedeserialiseerd
- Foutpad: `mod.default` geen functie → console.error, geen throw

### `@waldjs/compiler`
- Scanner: `canopy:load` op component-tag → `node.canopy = { strategy: 'load' }`, verdwijnt uit `node.attrs`
- Scanner: `canopy:xyz` → parse error
- Transform: canopy component genereert `<wald-canopy>` wrapper met placeholder `data-src`
- Transform: normaal component ongewijzigd

### `@waldjs/cli` build
- Pass 0 vindt canopy entries correct
- Asset manifest wordt correct ingelezen
- Placeholder `data-src="wald:canopy:Counter"` wordt vervangen door `/assets/counter-hash.js`
- Runtime `<script type="module">` wordt geïnjecteerd als pagina canopies heeft
- Pagina zonder canopies: geen runtime script geïnjecteerd

---

## Geraakte bestanden

| Bestand | Actie |
|---|---|
| `packages/canopy/src/index.ts` | Nieuw — `<wald-canopy>` custom element |
| `packages/canopy/package.json` | Nieuw |
| `packages/compiler/src/ast/types.ts` | Uitbreiden — `canopy?` op `ComponentNode` |
| `packages/compiler/src/parser/scanner.ts` | Uitbreiden — `canopy:*` detectie |
| `packages/compiler/src/parser/scanner.test.ts` | Uitbreiden |
| `packages/compiler/src/transform/index.ts` | Uitbreiden — canopy branch in `renderComponent` |
| `packages/compiler/src/transform/index.test.ts` | Uitbreiden |
| `packages/cli/src/vite-plugin.ts` | Uitbreiden — `?canopy-script` virtual module |
| `packages/cli/src/vite-plugin.test.ts` | Uitbreiden |
| `packages/cli/src/commands/build.ts` | Uitbreiden — Pass 0 + 1a + placeholder vervanging |
| `packages/cli/src/commands/build.test.ts` | Uitbreiden |

---

## Buiten scope

- `canopy:only` (geen server-render, alleen client)
- Meerdere `<script>` blokken per component
- Reactief state management / props updates na initialisatie
- TypeScript types voor `props` in `<script>` blok (generics)
- `<style>` scoping per canopy
- Content Security Policy headers
- Server-sent events / WebSockets
