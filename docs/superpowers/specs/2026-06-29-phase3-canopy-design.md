# Phase 3 — Canopy: Vanilla JS Script Blocks

**Date:** 2026-06-29
**Scope:** `<script>` blokken in `.wald` templates, gehost naar einde van `<body>`, gededupliceerd.

---

## Context

Phase 2b leverde herbruikbare componenten en layouts. Phase 3 voegt client-side interactiviteit toe via vanilla JS `<script>` blokken. In de WaldJS-metafoor is de Canopy de bovenste laag van het bos die licht (= interactiviteit) opvangt.

WaldJS kiest bewust voor progressive enhancement zonder framework-dependency: de server rendert altijd zinvolle HTML, en `<script>` blokken verbeteren de pagina daarna in de browser. Als JavaScript uitvalt, blijft de statische HTML zichtbaar.

Geen hydration, geen framework-keuze. Developers die complexere reactieve UI nodig hebben, kiezen Astro.

---

## Vastgestelde keuzes

| Keuze | Beslissing |
|---|---|
| Interactiviteitsmodel | Progressive enhancement — vanilla JS `<script>` blokken |
| Script-plaatsing | Gehost naar voor `</body>`, verwijderd uit inline positie |
| Deduplicatie | Op exacte content — zelfde script van hergebruikte component verschijnt één keer |
| Extractie-aanpak | Post-render string-operatie in CLI shell (geen compiler-wijzigingen in runtime) |
| Hydration | Buiten scope — eventueel Phase 4 |
| `<style>` hoisting | Buiten scope |
| `<script src="...">` deduplicatie | Buiten scope |
| TypeScript in `<script>` | Buiten scope |

---

## Developer-facing syntax

### Script in een pagina

```wald
---
const label = "Vind ik leuk"
---
<button class="like-btn">{label}</button>
<script>
  document.querySelector('.like-btn').addEventListener('click', (e) => {
    e.target.textContent = 'Geliked!'
  })
</script>
```

### Script in een component (`src/components/Counter.wald`)

```wald
---
const { id, initial } = $$props
---
<div>
  <span id="count-{id}">{initial}</span>
  <button onclick="increment('{id}')">+</button>
</div>
<script>
  function increment(id) {
    const el = document.getElementById('count-' + id)
    el.textContent = parseInt(el.textContent) + 1
  }
</script>
```

### Gegenereerde output (na hoisting)

```html
<!DOCTYPE html>
<html lang="nl">
  <head><title>Home</title></head>
  <body>
    <div>
      <span id="count-main">0</span>
      <button onclick="increment('main')">+</button>
    </div>
    <script>
      function increment(id) {
        const el = document.getElementById('count-' + id)
        el.textContent = parseInt(el.textContent) + 1
      }
    </script>
  </body>
</html>
```

---

## Technische implementatie

### 1. Scanner: raw text mode voor `<script>`

`packages/compiler/src/parser/scanner.ts`

De scanner herkent `<script` als het begin van een raw text element. Alles tot `</script>` wordt gelezen als ruwe tekst — geen `{expr}` parsing, geen child-tag parsing. Dit voorkomt dat JavaScript-code met `<` (kleiner-dan) of `{` de parser breekt.

```
Normaal: <tag> → parse attributes → parse children
Script:  <script ...> → read raw tot </script>
```

### 2. AST: `ScriptNode`

`packages/compiler/src/parser/index.ts`

Nieuw node-type:

```ts
type ScriptNode = {
  type: 'script'
  content: string  // volledige tag inclusief <script ...>...</script>
}
```

`ScriptNode` kan voorkomen als child van elk element-node of als top-level node in de template.

### 3. Transform: `ScriptNode` → raw HTML string

`packages/compiler/src/transform/index.ts`

```ts
case 'script': return `\${new SafeHtml(${JSON.stringify(node.content)})}`
```

De script-tag belandt als veilige HTML-string in de `renderTemplate` output. `hoistScripts` pakt hem daar na het renderen uit.

### 4. CLI: `hoistScripts()` in `shell.ts`

`packages/cli/src/shell.ts`

```ts
export function hoistScripts(html: string): string {
  const seen = new Set<string>()
  const collected: string[] = []
  const stripped = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, (match) => {
    if (!seen.has(match)) {
      seen.add(match)
      collected.push(match)
    }
    return ''
  })
  if (collected.length === 0) return html
  return stripped.replace('</body>', collected.join('\n') + '\n</body>')
}
```

### 5. Integratie in `grow.ts` en `build.ts`

`packages/cli/src/commands/grow.ts` en `packages/cli/src/commands/build.ts`

Render-pipeline wordt:

```ts
const html = hoistScripts(maybeWrap(await mod.default.render()))
```

### 6. `wald plant` scaffold

`packages/cli/src/commands/plant.ts`

`src/components/Counter.wald` toegevoegd aan scaffold — eenvoudig teller-component met `<script>` blok als voorbeeld van client-side interactiviteit.

---

## Geraakte bestanden

| Bestand | Wijziging |
|---|---|
| `packages/compiler/src/parser/scanner.ts` | Raw text mode voor `<script>` |
| `packages/compiler/src/parser/index.ts` | `ScriptNode` type + parsing |
| `packages/compiler/src/parser/scanner.test.ts` | Tests voor raw text mode |
| `packages/compiler/src/parser/index.test.ts` | Tests voor `ScriptNode` in AST |
| `packages/compiler/src/transform/index.ts` | `ScriptNode` renderen |
| `packages/compiler/src/transform/index.test.ts` | Tests voor script rendering |
| `packages/cli/src/shell.ts` | `hoistScripts()` toevoegen |
| `packages/cli/src/shell.test.ts` | Tests voor `hoistScripts()` |
| `packages/cli/src/commands/grow.ts` | `hoistScripts()` in render-pipeline |
| `packages/cli/src/commands/build.ts` | `hoistScripts()` in render-pipeline |
| `packages/cli/src/commands/plant.ts` | Scaffold `Counter.wald` toevoegen |
| `packages/cli/src/commands/plant.test.ts` | Test voor Counter scaffold |

---

## Edge cases

| Situatie | Verwacht gedrag |
|---|---|
| Pagina zonder `<script>` | `hoistScripts` geeft HTML ongewijzigd terug |
| Pagina zonder Layout | `wrapHtml` voegt `<body>...</body>` toe — `</body>` altijd aanwezig |
| Zelfde component N× op één pagina | Script verschijnt één keer in output |
| Script met `<` of `{` in JS-code | Scanner raw text mode voorkomt misparsing |
| `<script src="...">` externe script | Passeert door, niet gededupliceerd |
| `<script type="module">` | Werkt, geen speciale behandeling |

---

## Acceptatiecriteria Phase 3

- `<script>` blok in een `.wald` template compileert zonder fouten
- JavaScript met `<` en `{` in script-inhoud wordt niet misparsed door de scanner
- `wald grow`: script verschijnt voor `</body>` in de HTML die de browser ontvangt
- `wald build`: script verschijnt voor `</body>` in het gegenereerde HTML-bestand
- Zelfde script van een hergebruikte component verschijnt één keer in de output
- Pagina's zonder `<script>` blokken zijn byte-voor-byte ongewijzigd ten opzichte van Phase 2b output
- `wald plant` scaffoldt een `Counter.wald` component met een werkend `<script>` blok

---

## Bekende beperkingen

- **`<pre>`/`<code>` false positives:** `hoistScripts` gebruikt een regex op de HTML-string. Als een pagina een `<script>` tag toont als code-voorbeeld (bijv. in een `<pre>` blok), wordt die ook geëxtraheerd en gehoist. Acceptabele trade-off voor content-sites — een volwaardige HTML-parser is buiten scope.

---

## Buiten scope (Phase 3)

- `<style>` hoisting of scoping per component
- `<script src="...">` deduplicatie
- Preact / framework hydration
- TypeScript in `<script>` blokken
- `<script type="module">` speciale behandeling
- Content Security Policy headers
