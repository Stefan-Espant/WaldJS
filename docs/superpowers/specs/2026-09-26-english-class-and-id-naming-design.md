# English CSS Classes, HTML IDs and Related JS Names — Design

## Motivation

Sub-project 3 of 3 in the accessibility/semantics/i18n-naming effort (sub-projects 1 and 2 are merged — PRs #72, #73). The marketing site's CSS class names, HTML element IDs, and the JS function/variable names tied to them are almost entirely Dutch. The goal: an internationally-legible codebase — someone opening devtools or reading the source shouldn't need to know Dutch to understand the structure.

## Scope, decided explicitly with the user

**In scope:**
- Every Dutch CSS class name (both the `class="..."` attribute values and their matching CSS selectors).
- Every Dutch HTML `id="..."` (both the attribute values and their matching CSS/JS references — `getElementById`, `querySelector`, `#id` selectors).
- JS function and local variable names in `site.js` and `animations.js` that are tied to the above (event handlers referenced from `onclick="..."` attributes, functions that manipulate the renamed classes/ids).
- The Playground demo's default example code (`titel`/`soorten` → `title`/`species`) and the small `compileer`/`ververs` helper functions inside its IIFE, for consistency — this is genuinely reachable/visible content and code, not just an edge case.

**Explicitly out of scope (agreed before starting):**
- **`forest.js`'s internal WebGL/animation variables** (`bodem`, `gras`, `bloemen`, `vliegjes`, `klok`, `dagState`, etc. — roughly 80 identifiers). These never appear as a literal CSS class or HTML id anywhere — they're pure internal implementation detail of the 3D scene, invisible in devtools' Elements panel, and there is zero automated test coverage for the rendered visual output (only "does it build," never "does it render correctly"). Renaming ~80 identifiers in dense procedural-generation/shader code with no safety net is a materially different risk profile than the rest of this sub-project. **Exception:** the two functions from `forest.js` that ARE referenced externally via `onclick="..."` — `zetDagNacht` and the `'dag'` CSS class it toggles on `<body>` — are renamed, because they cross into shared, externally-visible surface (an `onclick` attribute in `Nav.wald`, and a class consumed by `03-nav.css`). Only the function's own name and that one class-toggle line change; everything else inside the function body (`dagState`, `pasDagToe`, etc.) stays as-is.
- **The `/waarom` route itself, its page content, and its internal section IDs** (`waarom-intro`, `waarom-snelheid`, etc.). `/waarom` is a deliberate brand/URL choice from the positioning work (PR #64), not generic UI naming, and its section IDs are specific to that one page rather than reusable site-wide patterns.
- **The bilingual `nl`/`en` content-language spans and the language-toggle mechanism itself** — that's functionality, not naming to clean up.
- **File names** (e.g. `20-kopieerknop.css`, `Formaat.wald`, `Metafoor.wald`, `Structuur.wald`). Not part of the originally agreed scope (classes, ids, JS names) — renaming files is a distinct, separate concern (import paths, component names used across many files) that wasn't discussed and isn't included here.

## Full rename table

Grounded by direct inspection of every usage site (CSS selector definitions, `class=`/`id=` attributes in every `.wald` file, `getElementById`/`querySelector` calls, `onclick="..."` references, and `href="#fragment"` links) — not guessed.

### CSS classes

| Dutch | English | Notes |
|---|---|---|
| `actief` | `active` | lang-switch buttons |
| `balk` | `bar` | the visual progress-bar track inside a `.staaf`/`.stat` |
| `cli-kaart` | `cli-card` | |
| `codeblok` | `code-block` | |
| `dag` | `day` | `body.dag` → `body.day`, toggled by the renamed `setDayNight()` |
| `dagnacht` | `day-night` | shared class on both toggle buttons |
| `datum` | `date` | |
| `deels` | `partial` | comparison table cell state |
| `footer-bos` | `footer-forest` | |
| `footer-merk` | `footer-brand` | |
| `footer-onder` | `footer-bottom` | |
| `icoon` | `icon` | |
| `ja` | `yes` | comparison table cell state |
| `kaart` | `card` | generic card (Metafoor, etc.) — distinct token from `log-kaart`/`cli-kaart` |
| `kaarten` | `cards` | card grid container |
| `klaar` | `complete` | roadmap badge state — **not** `done`, to avoid colliding with the unrelated, already-English `li.done` |
| `kolom` | `column` | footer columns |
| `kopieer` | `copy` | code-block copy button (created dynamically in `site.js`) |
| `links` (on `.varen`) | `left` | fern decoration position — paired with `rechts`/`right` |
| `links-kant` | `left-side` | desktop nav list |
| `log-kaart` | `log-card` | |
| `log-kop` | `log-header` | |
| `nee` | `no` | comparison table cell state |
| `oms` | `description` | roadmap item description span |
| `rechts` (on `.varen`) | `right` | paired with `links`/`left` above |
| `rechts-kant` | `right-side` | desktop nav list |
| `sectiekop` | `section-heading` | |
| `sluit` | `close` | mobile menu close button |
| `staaf` | `stat` | one labeled bar/row inside a `.staafgroep`/`.stat-group` — distinct from `.balk`/`.bar`, the visual track itself |
| `staafgroep` | `stat-group` | |
| `tekst` | `text` | |
| `term-uit` | `term-output` | also used as an id on the same element, see below |
| `titel` | `title` | code-block header bar — distinct from the *content* variable `titel` in the Playground demo, which separately becomes `title` too |
| `varen` | `fern` | |
| `verberg` | `hide` | responsive nav-link visibility |
| `vergelijk` | `compare` | comparison table |
| `vol` | `full` | full-bleed section modifier |
| `waarde` | `value` | benchmark stat value |

**Left as-is (already English, or a deliberately short internal token scheme):** `badge`, `bench`, `bench-grid`, `brand`, `btn`, `c-c`/`c-k`/`c-s`/`c-t` (comment/keyword/string/tag — a consistent one-letter-per-token-type scheme for code-block syntax highlighting), `changelog`, `cli-grid`, `cta`, `done` (roadmap `<li>` state), `dot`, `en`, `faq`, `footer-grid`, `gh-link`, `gh-stats`, `ghost`, `hamburger`, `label`, `lang-switch`, `metric`, `nl`, `pagina-intro` → see note below, `pg-editor`, `pg-grid`, `pg-preview`, `pkg`, `plant-hint`, `qs-grid`, `roadmap`, `roadmap-note`, `skip-link`, `split`, `sub`, `tag`, `terminal`, `wald`.

Note: `pagina-intro` (added in PR #70, Dutch for "page-intro") is renamed too — missed in the "already English" scan, corrected here: → `page-intro`.

### HTML IDs

| Dutch | English | Cross-references that must update in lockstep |
|---|---|---|
| `btn-dagnacht` | `btn-day-night` | `getElementById` in `forest.js`, `onclick` target unaffected (function itself renamed separately) |
| `btn-geluid` | `btn-sound` | `getElementById` in `site.js` |
| `cursorvlieg` | `cursor-firefly` | `getElementById` in `site.js` |
| `changelog-overzicht` | `changelog-overview` | section id, no external links reference it |
| `formaat` | `format` | **linked from `Nav.wald` and `Footer.wald`** (`href="/#formaat"`, both desktop and mobile nav) — every href must update too |
| `gh-sterren` | `gh-stars` | `getElementById` in `site.js` |
| `groeibalk` | `growth-bar` | `getElementById` in `site.js` |
| `groeiblad` | `growth-leaf` | `getElementById` in `site.js` |
| `metafoor` | `metaphor` | section id, no external links reference it |
| `mobielmenu` | `mobile-menu` | `getElementById` in `site.js` (`toggleMenu`/`vangFocusInMenu`), CSS in `17-hamburger-mobiel-menu.css` |
| `structuur` | `structure` | **linked from `Footer.wald`** (`href="/#structuur"`) |
| `term-tekst` | `term-text` | `getElementById` in `site.js` |
| `term-uit` | `term-output` | `getElementById` in `site.js`; also a class on the same element (see CSS table) |

**Left as-is (already English):** `benchmarks`, `bos3d`, `btn-en`, `btn-nl`, `changelog`, `changelog-entry`, `cli`, `faq`, `features`, `gh-forks`, `gh-stats`, `main`, `packages`, `pg-editor`, `pg-preview`, `playground`, `quickstart`, `roadmap`, `scrim`, `top`, `vergelijking`, `verloop44`, `vs-astro-intro`, `vs-astro-keuze`, `vs-eleventy-intro`, `vs-eleventy-keuze`, `waldlogo`, all `waarom-*` ids (excluded, see Scope).

### JS function/variable names

| Dutch | English | File |
|---|---|---|
| `zetTaal` | `setLanguage` | `site.js` — called from `onclick="zetTaal('nl')"` in `Nav.wald` (×2, desktop + mobile lang buttons per language = 4 call sites total) |
| `zetGeluid` | `setSound` | `site.js` — called from `onclick="zetGeluid()"` in `Nav.wald` |
| `zetDagNacht` | `setDayNight` | `forest.js` — called from `onclick="zetDagNacht()"` in `Nav.wald`; only the function's own name and its `classList.toggle('dag', ...)` line change, not its internal body |
| `vorigeFocusVoorMenu` | `previousFocusBeforeMenu` | `site.js` — internal to the focus-trap logic added in PR #73 |
| `vangFocusInMenu` | `trapFocusInMenu` | `site.js` |
| `compileer` | `compile` | `site.js` — Playground mini-compiler |
| `ververs` | `refresh` | `site.js` — Playground live-preview refresh |
| `knop`, `blok`, `titel` (locals in the copy-button IIFE) | `button`, `block`, `titleEl` | `site.js` — local variables only, not exported |

**Left as-is:** `toggleMenu`, `checkHeadingOrder` (already English). Every identifier inside `forest.js` not listed above (per the Scope section).

### Playground demo content

The default example shown in the live `.wald` editor (`site.js`, inside the Playground IIFE) is translated for consistency:

```
---
const titel = "Mijn eerste boom"
const soorten = ["eik", "beuk", "den"]
---
<h1>{titel}</h1>
<p>Er groeien {soorten.length} soorten in dit bos:</p>
...
```

becomes:

```
---
const title = "My first tree"
const species = ["oak", "beech", "pine"]
---
<h1>{title}</h1>
<p>{species.length} species grow in this forest:</p>
...
```

This is the one piece of user-visible *content* in this sub-project (everything else is invisible-to-visitors naming) — included because it's the very first interactive `.wald` code a visitor sees, and leaving it Dutch while the rest of the codebase goes English would be inconsistent with the stated goal.

## Approach

Given the scale (~100 renames across nearly every file in `marketing/`), this is executed as several small, independently-verified tasks grouped by area (tokens/base, nav, footer, benchmarks, changelog, comparison table, hero/terminal/code-blocks, metafoor/split, playground, mobile-menu-JS) rather than one giant change — each task renames a cluster of related classes/ids together with their CSS selectors and JS references, rebuilds, and re-runs the full smoke-test suite before moving to the next. The existing smoke tests already assert the presence of several of these ids/classes by literal string (e.g. the section-id loop test, the `/waarom`/comparison-page tests) — those assertions are updated in the same task that renames the underlying id, so a missed reference fails loudly rather than silently.

## Testing

- The existing smoke-test suite's literal id/class string assertions are updated in lockstep with each rename (not a separate pass at the end — a stale assertion should fail immediately after the task that breaks it, not linger until a final sweep).
- After all tasks: a full-codebase grep for the old Dutch identifiers (the complete list in this doc) across `marketing/src/` should return zero matches, confirmed as an explicit final verification step — this is the actual proof of completeness, not just "tests still pass" (tests only check the specific strings they already assert; a grep catches anything the test suite doesn't happen to cover).
- Visual smoke-check: since these are almost entirely 1:1 renames (same visual behavior, different identifier strings), no visual regression is expected — but a final `pnpm build` + spot-check of a few pages' rendered output (do the benchmark bars, the metaphor cards, the code-block copy buttons still look right) is worth doing once at the end, given the sheer number of files touched.

## Non-goals

- `forest.js` internals, `/waarom`'s own content/ids, file names, and the nl/en language toggle mechanism (all covered above under Scope).
- No visual/design changes — this is a pure identifier rename, the rendered output should be pixel-identical before and after.
