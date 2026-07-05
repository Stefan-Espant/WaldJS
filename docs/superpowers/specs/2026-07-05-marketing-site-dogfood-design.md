# Marketing Site als WaldJS-project (dogfooding) — Design Spec

**Date:** 2026-07-05
**Status:** Approved

## Goal

De marketing website (`marketing/index.html`, 1761 regels, één bestand) herbouwen als WaldJS-project: CSS en JS in aparte bestanden, de pagina opgedeeld in `.wald`-componenten, gebouwd met `wald build`. Het framework bouwt zijn eigen marketing site.

## Vereiste compiler-verbetering: doctype & comments

De scanner ondersteunt `<!DOCTYPE html>` niet: het compileert naar `< DOCTYPE html>` plus een zwervende `</>`. Omdat `maybeWrap` in de CLI alleen omhult wanneer output *niet* met `<!DOCTYPE` begint, moet een pagina een volledig document kunnen leveren.

**Fix in `packages/compiler/src/parser/scanner.ts`:**
- `<!DOCTYPE ...>` (case-insensitief, tot en met de eerstvolgende `>`) wordt een tekst-node met de letterlijke inhoud.
- `<!--` tot en met `-->` wordt een tekst-node met de letterlijke comment (comments blijven in de output staan).
- Beide met unit tests in `scanner.test.ts` en een end-to-end test in `compile.test.ts` (volledig document → output begint met `<!DOCTYPE html>`, geen `</>`-restanten).

## Projectstructuur

```
marketing/
  package.json          # @waldjs/marketing, private
  public/
    css/site.css        # alle CSS uit de huidige <style>-blok (~290 regels)
    js/site.js          # i18n (NL/EN), smooth scroll, playground-logica
    js/forest.js        # Three.js nachtbos-scène
    js/animations.js    # GSAP/ScrollTrigger animaties
  src/
    pages/
      index.wald        # doctype + <head> + compositie van alle secties
    components/
      Nav.wald  Hero.wald  Quickstart.wald  Formaat.wald
      Playground.wald  Metafoor.wald  Features.wald  Vergelijking.wald
      Benchmarks.wald  Cli.wald  Structuur.wald  Packages.wald
      Roadmap.wald  Faq.wald  Changelog.wald  Footer.wald
```

- `package.json`: scripts `dev: wald grow`, `build: wald build`; dependency `@waldjs/cli: workspace:*`.
- `index.wald` importeert de 16 componenten en rendert het volledige document: `<!DOCTYPE html>`, `<html data-lang="nl">`, `<head>` met bestaande meta/OG-tags, Google Fonts, Three.js/GSAP CDN-scripts, `<link rel="stylesheet" href="/css/site.css">`, dan body met de componenten en `<script src="/js/...">`-tags.
- Elke component bevat exact één sectie uit het huidige HTML-bestand (inhoud 1-op-1 overgenomen, geen redesign).

## Inhoudsmigratie-regels

1. **Accolades in zichtbare codevoorbeelden** (`{title}`, `{posts.map(...)}` in `<pre>`/`<code>`): vervangen door HTML-entities `&#123;` en `&#125;` zodat de scanner ze niet als expressies parseert. De browser rendert ze als accolades.
2. **Playground-textarea seed** (bevat `.wald`-syntax incl. `---` en `{expr}`): verhuist uit de HTML naar `site.js` — de textarea start leeg in de markup en `site.js` zet `textarea.value` bij init.
3. **Alle `<script>`-blokken** verhuizen naar de drie JS-bestanden onder `public/js/`. Inline scripts blijven niet achter (de CLI's `hoistScripts` verplaatst script-tags naar het einde van de body; volgorde blijft behouden: three → gsap → ScrollTrigger → eigen scripts).
4. **CSS** verhuist integraal naar `public/css/site.css`. Er blijven geen `<style>`-blokken in templates achter (CSS-accolades zouden de expressie-scanner breken).

## Workspace-integratie

- `pnpm-workspace.yaml`: `marketing` toevoegen aan `packages:`.
- Turbo bouwt marketing mee via de bestaande pipeline (`wald build` → `marketing/dist/`).
- `marketing/index.html` (het oude monoliet-bestand) wordt verwijderd.
- `dist/` is al gitignored.

## Testen

- Compiler: scanner-tests voor doctype en comments; compile-test voor een volledig document.
- Marketing: smoke-test (`marketing/src/smoke.test.ts`, zelfde patroon als `examples/basic`) die `wald build` draait en controleert dat `dist/index.html` bestaat, begint met `<!DOCTYPE html>` en de sectie-id's (`quickstart`, `playground`, `benchmarks`, `faq`) bevat.

## Out of scope

- Redesign of inhoudswijzigingen van de site
- Meertalige routing (i18n blijft client-side zoals nu)
- Zelf-gehoste fonts of het vervangen van CDN-dependencies
- Deployment
