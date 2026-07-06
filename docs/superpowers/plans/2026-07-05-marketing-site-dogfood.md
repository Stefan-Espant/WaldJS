# Marketing Site als WaldJS-project — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** De marketing website (`marketing/index.html`, 1761 regels) herbouwen als WaldJS-workspace-package met aparte CSS/JS-bestanden en 16 `.wald`-componenten, gebouwd via `wald build`.

**Architecture:** Eerst een kleine compiler-verbetering (scanner leert `<!DOCTYPE>` en `<!-- -->` als raw tekst), daarna een nieuw `marketing/` package: `public/` voor css/js-assets, `src/pages/index.wald` als volledig-document-pagina die 16 sectie-componenten (Branches) importeert. Turbo bouwt het package mee.

**Tech Stack:** WaldJS zelf (dogfooding), pnpm workspace, vitest, Three.js/GSAP via CDN (ongewijzigd).

---

## File Map

| Bestand | Actie |
|---|---|
| `packages/compiler/src/parser/scanner.ts` | `scanRawMarkup()` voor `<!...>` en `<!--...-->` |
| `packages/compiler/src/parser/scanner.test.ts` | Tests doctype/comments |
| `packages/compiler/src/compile.test.ts` | E2E test volledig document |
| `pnpm-workspace.yaml` | `marketing` toevoegen |
| `marketing/package.json` | NIEUW — @waldjs/marketing |
| `marketing/public/css/site.css` | NIEUW — CSS uit `<style>` blok |
| `marketing/public/js/site.js` | NIEUW — i18n/menu/scroll/playground |
| `marketing/public/js/forest.js` | NIEUW — Three.js scène |
| `marketing/public/js/animations.js` | NIEUW — GSAP/ScrollTrigger |
| `marketing/src/pages/index.wald` | NIEUW — document + compositie |
| `marketing/src/components/*.wald` | NIEUW — 16 sectie-componenten |
| `marketing/src/smoke.test.ts` | NIEUW — build smoke test |
| `marketing/index.html` | VERWIJDEREN (na geslaagde build) |

**Bronbestand-kaart (`marketing/index.html`, regelnummers):**
- 1–20: doctype, `<head>` meta/OG, Google Fonts, Three.js/GSAP CDN-scripts
- 21–308: `<style>` blok → `site.css`
- 311–315: `<canvas id="bos3d">` + scrim/groeibalk/groeiblad/cursorvlieg divs (blijven direct in body van index.wald)
- 317–355: `<nav>` → Nav.wald
- 356–404: `<header id="top">` (hero) → Hero.wald
- 405–431: `#quickstart` → Quickstart.wald
- 432–455: `#formaat` → Formaat.wald
- 456–471: `#playground` → Playground.wald
- 472–494: `#metafoor` → Metafoor.wald
- 495–564: `#features` → Features.wald
- 565–583: `#vergelijking` → Vergelijking.wald
- 584–622: `#benchmarks` → Benchmarks.wald
- 623–637: `#cli` → Cli.wald
- 638–680: `#structuur` → Structuur.wald
- 681–694: `#packages` → Packages.wald
- 695–712: `#roadmap` → Roadmap.wald
- 713–738: `#faq` → Faq.wald
- 739–794: `#changelog` → Changelog.wald
- 795–836: `<footer>` → Footer.wald
- 837–1759: `<script>` blok → gesplitst naar de drie js-bestanden

---

## Migratie-regels (gelden voor ALLE component-taken)

1. **Accolades in zichtbare tekst/code** (`{` of `}` binnen `<pre>`, `<code>`, of gewone tekst): vervang door `&#123;` en `&#125;`. De scanner parseert `{...}` anders als expressie. Let op: accolades binnen `<script>`-blokken en binnen HTML-comments zijn WEL veilig (raw doorgegeven) — maar na deze migratie horen er geen script-blokken meer in templates te staan.
2. **Attributen altijd met dubbele quotes.** De scanner kent geen enkele quotes. Controleer per sectie of er `attr='...'` voorkomt en zet om naar `attr="..."`.
3. **Inhoud 1-op-1 overnemen** — geen redesign, geen tekstwijzigingen. Alleen de twee transformaties hierboven.
4. **Hidden SVG-defs behouden.** Er staat een verborgen `<svg>` met `<symbol id="waldlogo">` (of vergelijkbaar) in de body die door `<use href="#waldlogo"/>` in nav/footer wordt gebruikt. Zoek hem met `grep -n "waldlogo" marketing/index.html` en plaats hem bovenaan de body in `index.wald`.
5. **Component-templates zijn fragmenten** — geen doctype/head; alleen de sectie-markup. Frontmatter is leeg (`---\n---`) tenzij anders vermeld.

---

## Task 1: Compiler — doctype & comments als raw tekst

**Files:**
- Modify: `packages/compiler/src/parser/scanner.ts`
- Test: `packages/compiler/src/parser/scanner.test.ts`
- Test: `packages/compiler/src/compile.test.ts`

**Context:** `scanNode()` (regel 36–45) routeert `<` + volgende char ≠ `/` naar `scanElement()`. Bij `<!DOCTYPE html>` levert dat een leeg tag-identifier op → mangled output `< DOCTYPE html>` plus een zwervende `</>`. Fix: een nieuwe branch vóór de element-check die `<!...>` als raw tekst consumeert.

- [ ] **Step 1: Schrijf failing tests**

In `packages/compiler/src/parser/scanner.test.ts`, nieuw describe-blok:

```typescript
describe('scanTemplate — doctype en comments', () => {
  it('geeft <!DOCTYPE html> door als letterlijke tekst', () => {
    const nodes = scanTemplate('<!DOCTYPE html>\n<p>hi</p>')
    expect(nodes[0]).toEqual({ type: 'text', value: '<!DOCTYPE html>' })
  })

  it('geeft een HTML-comment door als letterlijke tekst', () => {
    const nodes = scanTemplate('<!-- logo klein --><p>hi</p>')
    expect(nodes[0]).toEqual({ type: 'text', value: '<!-- logo klein -->' })
  })

  it('parseert accolades binnen comments niet als expressies', () => {
    const nodes = scanTemplate('<!-- {geen expressie} -->')
    expect(nodes[0]).toEqual({ type: 'text', value: '<!-- {geen expressie} -->' })
  })

  it('comment met > erin eindigt pas bij -->', () => {
    const nodes = scanTemplate('<!-- a > b --><p>x</p>')
    expect(nodes[0]).toEqual({ type: 'text', value: '<!-- a > b -->' })
  })

  it('ongesloten comment loopt tot einde bron zonder crash', () => {
    const nodes = scanTemplate('<!-- nooit dicht')
    expect(nodes[0]).toEqual({ type: 'text', value: '<!-- nooit dicht' })
  })
})
```

In `packages/compiler/src/compile.test.ts`, nieuw describe-blok:

```typescript
describe('compile — volledig HTML-document', () => {
  it('compileert een document met doctype zonder mangling', () => {
    const source = `---
---
<!DOCTYPE html>
<html lang="nl">
<head><title>Wald</title></head>
<body><h1>hi</h1></body>
</html>`
    const output = compile(source, '/src/page.wald')
    expect(output).toContain('<!DOCTYPE html>')
    expect(output).not.toContain('< DOCTYPE')
    expect(output).not.toContain('</>')
  })
})
```

- [ ] **Step 2: Run tests — verwacht FAIL**

Run: `cd packages/compiler && pnpm test`
Verwacht: de nieuwe tests falen (mangled output).

- [ ] **Step 3: Implementeer `scanRawMarkup`**

In `packages/compiler/src/parser/scanner.ts`, wijzig `scanNode()`:

```typescript
  private scanNode(): TemplateNode | null {
    if (this.current === '<' && this.peek(1) === '!') {
      return this.scanRawMarkup()
    }
    if (this.current === '<' && this.peek(1) !== '/') {
      if (this.isScriptTag()) return this.scanScript()
      return this.scanElement()
    }
    if (this.current === '{') {
      return this.scanExpression()
    }
    return this.scanText()
  }
```

En voeg onder `scanScript()` toe:

```typescript
  // <!DOCTYPE ...> and <!-- comments --> pass through as literal text.
  private scanRawMarkup(): TemplateNode {
    const start = this.pos
    if (this.source.startsWith('<!--', this.pos)) {
      const close = this.source.indexOf('-->', this.pos + 4)
      this.pos = close === -1 ? this.source.length : close + 3
    } else {
      while (this.pos < this.source.length && this.current !== '>') this.advance()
      if (this.pos < this.source.length) this.advance() // consume >
    }
    return { type: 'text', value: this.source.slice(start, this.pos) }
  }
```

- [ ] **Step 4: Run tests — verwacht PASS**

Run: `cd packages/compiler && pnpm test`
Verwacht: alle tests groen (bestaande + nieuwe). Run daarna `pnpm build` in packages/compiler — clean.

- [ ] **Step 5: Commit**

```bash
git add packages/compiler/src/parser/scanner.ts packages/compiler/src/parser/scanner.test.ts packages/compiler/src/compile.test.ts
git commit -m "feat(compiler): pass doctype and HTML comments through as raw text"
```

---

## Task 2: Marketing package scaffold + asset-extractie

**Files:**
- Create: `marketing/package.json`
- Modify: `pnpm-workspace.yaml`
- Create: `marketing/public/css/site.css`
- Create: `marketing/public/js/site.js`, `marketing/public/js/forest.js`, `marketing/public/js/animations.js`

- [ ] **Step 1: package.json + workspace**

`marketing/package.json`:

```json
{
  "name": "@waldjs/marketing",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "wald grow",
    "build": "wald build",
    "test": "vitest run"
  },
  "dependencies": {
    "@waldjs/cli": "workspace:*"
  },
  "devDependencies": {
    "vitest": "^2.0.0"
  }
}
```

`pnpm-workspace.yaml`:

```yaml
packages:
  - 'packages/*'
  - 'examples/*'
  - 'marketing'
allowBuilds:
  esbuild: true
```

Run daarna vanaf de repo-root: `pnpm install`

- [ ] **Step 2: CSS extraheren**

Kopieer de inhoud van het `<style>`-blok (regels 22 t/m 307 van `marketing/index.html` — d.w.z. alles tússen `<style>` en `</style>`) integraal naar `marketing/public/css/site.css`. Geen wijzigingen aan de CSS zelf.

- [ ] **Step 3: JS splitsen in drie bestanden**

Het `<script>`-blok loopt van regel 838 t/m 1758 (tussen `<script>` op 837 en `</script>` op 1759). Splits op de volgende markers (zoek de IIFE- of sectiegrenzen in het bestand — de Three.js-code begint rond regel 875 met `const canvas = document.getElementById('bos3d')`):

- `marketing/public/js/site.js` — alles vóór de Three.js-sectie: scroll-restoration, smooth scroll, `zetTaal` (i18n), menu (`toggleMenu`), playground-logica (editor-seed, compile-preview). Plus alles ná de GSAP-sectie dat geen Three.js of GSAP is.
- `marketing/public/js/forest.js` — de volledige Three.js-scène (vanaf `document.getElementById('bos3d')` t/m het einde van die IIFE/sectie, inclusief render-loop en resize-handlers).
- `marketing/public/js/animations.js` — alle GSAP/ScrollTrigger-code (zoek `gsap.` en `ScrollTrigger`).

Regels:
- Functies die vanuit inline `onclick=""`-attributen worden aangeroepen (zoals `toggleMenu`) moeten globaal blijven — de bestanden worden als klassieke scripts geladen (géén `type="module"`), dus top-level `function`-declaraties zijn automatisch globaal.
- Behoud de volgorde en inhoud letterlijk; verplaats alleen.

- [ ] **Step 4: Verifieer volledige dekking**

Controleer dat elke regel van het originele scriptblok in precies één van de drie bestanden zit:

```bash
wc -l marketing/public/js/*.js
```

Verwacht: samen ≈ 920 regels (±10 voor verwijderde `<script>`-tags).

- [ ] **Step 5: Commit**

```bash
git add marketing/package.json pnpm-workspace.yaml pnpm-lock.yaml marketing/public/
git commit -m "feat(marketing): scaffold WaldJS package with extracted css/js assets"
```

---

## Task 3: Componenten A — Nav t/m Vergelijking (8 stuks)

**Files:**
- Create: `marketing/src/components/Nav.wald` (bron: regels 317–355)
- Create: `marketing/src/components/Hero.wald` (bron: 356–404)
- Create: `marketing/src/components/Quickstart.wald` (bron: 405–431)
- Create: `marketing/src/components/Formaat.wald` (bron: 432–455)
- Create: `marketing/src/components/Playground.wald` (bron: 456–471)
- Create: `marketing/src/components/Metafoor.wald` (bron: 472–494)
- Create: `marketing/src/components/Features.wald` (bron: 495–564)
- Create: `marketing/src/components/Vergelijking.wald` (bron: 565–583)

- [ ] **Step 1: Maak de 8 componenten**

Per component: kopieer de HTML van de genoemde bronregels 1-op-1, pas de migratie-regels toe (accolade-entities in zichtbare code, dubbele quotes), en zet er lege frontmatter boven. Voorbeeld-structuur (Formaat.wald — deze sectie bevat een `.wald`-codevoorbeeld in een `<pre>`, dus hier zijn de entities essentieel):

```
---
---
<section id="formaat">
  ... letterlijke inhoud van regels 433–455, met in het <pre>-blok
  elke { vervangen door &#123; en elke } door &#125; ...
</section>
```

Let op per component:
- **Nav.wald**: bevat `<!-- logo klein -->` comment (blijft — compiler ondersteunt dat nu) en `<use href="#waldlogo"/>` (blijft; de symbol-defs komen in index.wald).
- **Hero.wald**: check op accolades in eventuele code-snippets.
- **Formaat.wald** en **Quickstart.wald**: bevatten codevoorbeelden → entities.
- **Playground.wald**: de `<textarea id="pg-editor">` is al leeg in de markup (seed zit in JS) — zo houden.

- [ ] **Step 2: Compileer-check per component**

Snelle syntaxcontrole zonder volledige build:

```bash
cd packages/compiler && for f in ../../marketing/src/components/*.wald; do
  node -e "
    const { compile } = require('./dist/index.js');
    const src = require('fs').readFileSync('$f', 'utf-8');
    try { compile(src, '$f'); console.log('OK  $f'); }
    catch (e) { console.log('FAIL $f: ' + e.message); process.exitCode = 1; }
  "
done
```

Verwacht: 8× OK. Bij FAIL: meestal een vergeten accolade-entity of enkele quote.

- [ ] **Step 3: Commit**

```bash
git add marketing/src/components/
git commit -m "feat(marketing): add Nav through Vergelijking components"
```

---

## Task 4: Componenten B — Benchmarks t/m Footer (8 stuks) + index.wald

**Files:**
- Create: `marketing/src/components/Benchmarks.wald` (bron: 584–622)
- Create: `marketing/src/components/Cli.wald` (bron: 623–637)
- Create: `marketing/src/components/Structuur.wald` (bron: 638–680)
- Create: `marketing/src/components/Packages.wald` (bron: 681–694)
- Create: `marketing/src/components/Roadmap.wald` (bron: 695–712)
- Create: `marketing/src/components/Faq.wald` (bron: 713–738)
- Create: `marketing/src/components/Changelog.wald` (bron: 739–794)
- Create: `marketing/src/components/Footer.wald` (bron: 795–836)
- Create: `marketing/src/pages/index.wald`

- [ ] **Step 1: Maak de 8 componenten**

Zelfde procedure en migratie-regels als Task 3. Let op:
- **Cli.wald** en **Structuur.wald**: bevatten terminal/boomstructuur-voorbeelden in `<pre>` → entities waar accolades staan.
- **Footer.wald**: bevat mogelijk een tweede `<use href="#waldlogo"/>` — behouden.

- [ ] **Step 2: Maak index.wald**

`marketing/src/pages/index.wald` — het volledige document:

```
---
import Nav from '../components/Nav.wald'
import Hero from '../components/Hero.wald'
import Quickstart from '../components/Quickstart.wald'
import Formaat from '../components/Formaat.wald'
import Playground from '../components/Playground.wald'
import Metafoor from '../components/Metafoor.wald'
import Features from '../components/Features.wald'
import Vergelijking from '../components/Vergelijking.wald'
import Benchmarks from '../components/Benchmarks.wald'
import Cli from '../components/Cli.wald'
import Structuur from '../components/Structuur.wald'
import Packages from '../components/Packages.wald'
import Roadmap from '../components/Roadmap.wald'
import Faq from '../components/Faq.wald'
import Changelog from '../components/Changelog.wald'
import Footer from '../components/Footer.wald'
---
<!DOCTYPE html>
<html lang="nl" data-lang="nl">
<head>
  ... regels 4–20 van het origineel: meta, OG-tags, favicon, preconnects,
      Google Fonts link, Three.js/GSAP/ScrollTrigger CDN-scripts ...
  <link rel="stylesheet" href="/css/site.css">
</head>
<body>
  ... hidden SVG symbol-defs (waldlogo) — zie migratie-regel 4 ...
  <canvas id="bos3d" aria-hidden="true"></canvas>
  <div id="scrim" aria-hidden="true"></div>
  <div id="groeibalk" aria-hidden="true"></div>
  <div id="groeiblad" aria-hidden="true">🌿</div>
  <div id="cursorvlieg" aria-hidden="true"></div>
  <Nav />
  <Hero />
  <Quickstart />
  <Formaat />
  <Playground />
  <Metafoor />
  <Features />
  <Vergelijking />
  <Benchmarks />
  <Cli />
  <Structuur />
  <Packages />
  <Roadmap />
  <Faq />
  <Changelog />
  <Footer />
  <script src="/js/site.js"></script>
  <script src="/js/forest.js"></script>
  <script src="/js/animations.js"></script>
</body>
</html>
```

(De `...`-blokken staan voor letterlijke overname uit het bronbestand — geen samenvatting. De CDN `<script src>`-tags in de head blijven staan; `hoistScripts` verplaatst alle scripts naar het einde van de body met behoud van volgorde: three → gsap → ScrollTrigger → site → forest → animations.)

- [ ] **Step 3: Compileer-check**

Zelfde node-loop als Task 3 Step 2, nu over `marketing/src/components/*.wald` én `marketing/src/pages/index.wald`. Verwacht: alles OK.

- [ ] **Step 4: Commit**

```bash
git add marketing/src/
git commit -m "feat(marketing): add remaining components and index page"
```

---

## Task 5: Build, smoke test en oplevering

**Files:**
- Create: `marketing/src/smoke.test.ts`
- Delete: `marketing/index.html`

- [ ] **Step 1: Schrijf de smoke test**

`marketing/src/smoke.test.ts`:

```typescript
import { describe, it, expect, beforeAll } from 'vitest'
import { execSync } from 'node:child_process'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(__dirname, '..')

describe('marketing site build', () => {
  beforeAll(() => {
    execSync('pnpm build', { cwd: ROOT, stdio: 'pipe' })
  }, 180_000)

  it('produceert dist/index.html', () => {
    expect(existsSync(join(ROOT, 'dist/index.html'))).toBe(true)
  })

  it('begint met een doctype en bevat de secties', () => {
    const html = readFileSync(join(ROOT, 'dist/index.html'), 'utf-8')
    expect(html.trimStart().startsWith('<!DOCTYPE html>')).toBe(true)
    for (const id of ['quickstart', 'formaat', 'playground', 'metafoor', 'features', 'vergelijking', 'benchmarks', 'cli', 'structuur', 'packages', 'roadmap', 'faq', 'changelog']) {
      expect(html).toContain(`id="${id}"`)
    }
  })

  it('kopieert de assets mee', () => {
    expect(existsSync(join(ROOT, 'dist/css/site.css'))).toBe(true)
    expect(existsSync(join(ROOT, 'dist/js/site.js'))).toBe(true)
    expect(existsSync(join(ROOT, 'dist/js/forest.js'))).toBe(true)
    expect(existsSync(join(ROOT, 'dist/js/animations.js'))).toBe(true)
  })

  it('bevat geen inline script-blokken meer behalve CDN en asset-verwijzingen', () => {
    const html = readFileSync(join(ROOT, 'dist/index.html'), 'utf-8')
    const inlineScripts = html.match(/<script(?![^>]*src=)[^>]*>[\s\S]*?<\/script>/g) ?? []
    expect(inlineScripts).toEqual([])
  })
})
```

- [ ] **Step 2: Run de smoke test**

```bash
cd marketing && pnpm test
```

Verwacht: PASS. Bij falen: lees de buildfout — meestal een component met parse-error (accolades/quotes) of een ontbrekend asset-pad.

- [ ] **Step 3: Visuele verificatie**

```bash
cd marketing && pnpm build && pnpm exec wald preview
```

Open de getoonde URL en controleer: 3D-bos rendert, taalknoppen werken, playground werkt, menu werkt. Stop de server daarna.

- [ ] **Step 4: Verwijder het oude bestand**

```bash
git rm marketing/index.html
```

- [ ] **Step 5: Volledige test-run vanaf de root**

```bash
pnpm test
```

Verwacht: alle packages groen, inclusief marketing.

- [ ] **Step 6: Commit**

```bash
git add marketing/src/smoke.test.ts
git commit -m "feat(marketing): build marketing site with WaldJS, remove monolith html"
```
