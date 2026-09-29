# English CSS Classes, IDs and Related JS Names Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename every Dutch CSS class, HTML id, and directly-related JS function/variable name in the marketing site to English, per the approved rename table, without changing any visual behavior.

**Architecture:** ~100 renames grouped into 14 small, independently-buildable/testable tasks by area (nav/toggles, layout decorations, footer, section ids, code-block pattern, terminal/GitHub-stats, metaphor cards, CLI cards, benchmarks, comparison table, changelog, roadmap, page-intro class, playground content, and the cross-cutting `sectiekop`→`section-heading` rename used in 19 files, done last), each task renaming a cluster of related identifiers across all the files that reference them together, then rebuilding and re-running the smoke-test suite before moving on.

**Spec:** `docs/superpowers/specs/2026-09-26-english-class-and-id-naming-design.md` — **read this first for the full rename table and the explicit scope boundaries (forest.js internals, `/waarom`'s own content/ids, file names, and the nl/en toggle are all explicitly OUT of scope — do not touch them).**

**Tech Stack:** WaldJS (`.wald` components + CSS partials bundled by `marketing/scripts/build-css.js`), Vitest.

---

## Before you start

This plan assumes you're already in the isolated worktree at
`/Users/stefan/Desktop/semantique-agency/repositories/waldjs/.worktrees/english-classnames`
on branch `refactor/english-css-classnames`. If starting fresh:

```bash
git fetch origin main
git worktree add .worktrees/english-classnames -b refactor/english-css-classnames origin/main
cd .worktrees/english-classnames
export NVM_DIR="$HOME/.nvm" && \. "$NVM_DIR/nvm.sh" && nvm use 22
pnpm install
```

Run all commands from `marketing/` inside this worktree unless noted.

**How to execute each task's renames:** for every `old → new` pair listed, run
`grep -rn '<old>' src/` first to see every occurrence (source files only —
`dist/` is generated, never edit it directly), then use the Edit tool to
change each one. Do not use a blind global sed across the whole `marketing/`
directory — some short tokens (e.g. `vol`, `dot`) are common English words
and a blind replace could corrupt unrelated text; targeted, reviewed edits
per occurrence are required. After each task's renames, rebuild and run the
smoke tests before committing.

**Read `docs/superpowers/specs/2026-09-26-english-class-and-id-naming-design.md`'s
full rename table now** — every task below references it by cluster name
rather than repeating the whole table in each task.

---

### Task 1: Nav structure, language/day-night/sound toggles, mobile menu

**Files:** `marketing/src/components/Nav.wald`, `marketing/src/assets/js/site.js`, `marketing/src/assets/js/forest.js` (only the `zetDagNacht` function name and its `classList.toggle('dag', ...)` line — nothing else in that file), `marketing/src/styles/partials/03-nav.css`, `marketing/src/styles/partials/24-dag-nacht-knop.css`, `marketing/src/styles/partials/17-hamburger-mobiel-menu.css`, `marketing/src/styles/partials/28-footer.css` (only the `nav ul li.verberg` media-query rule), `marketing/src/smoke.test.ts`

- [ ] **Step 1: Rename these identifiers everywhere they appear in the files above**

| Old | New |
|---|---|
| `actief` (class) | `active` |
| `verberg` (class) | `hide` |
| `links-kant` (class) | `left-side` |
| `rechts-kant` (class) | `right-side` |
| `dagnacht` (class) | `day-night` |
| `dag` (class, on `body`) | `day` |
| `mobielmenu` (id) | `mobile-menu` |
| `sluit` (class) | `close` |
| `btn-dagnacht` (id) | `btn-day-night` |
| `btn-geluid` (id) | `btn-sound` |
| `zetTaal` (function) | `setLanguage` |
| `zetGeluid` (function) | `setSound` |
| `zetDagNacht` (function, in `forest.js` — rename only the function name and the `classList.toggle('dag', ...)` line's string; leave every other line inside the function body untouched) | `setDayNight` |
| `vorigeFocusVoorMenu` (variable) | `previousFocusBeforeMenu` |
| `vangFocusInMenu` (function) | `trapFocusInMenu` |

Also update every `onclick="..."` attribute in `Nav.wald` that calls the renamed functions (`zetTaal('nl')`/`zetTaal('en')`/`zetGeluid()`/`zetDagNacht()`, both the desktop nav and the mobile menu — 6 call sites total: 2× `zetTaal`, 1× `zetGeluid`, 1× `zetDagNacht`, and their mobile-menu counterparts don't call these specific ones but do call `toggleMenu` — leave `toggleMenu` alone, it's already English).

In `marketing/src/smoke.test.ts`, check for any hardcoded string containing `mobielmenu` (there's at least one, from the PR #73 dialog-semantics test) and update it to `mobile-menu`.

- [ ] **Step 2: Rebuild and run the smoke tests**

Run: `cd marketing && pnpm build && ./node_modules/.bin/vitest run src/smoke.test.ts`
Expected: PASS. If it fails, it's likely a missed reference — grep for the old identifier again rather than guessing.

- [ ] **Step 3: Verify nothing Dutch remains for this cluster**

Run: `grep -rn "actief\|verberg\|links-kant\|rechts-kant\|dagnacht\|mobielmenu\|\bsluit\b\|zetTaal\|zetGeluid\|zetDagNacht\|vorigeFocusVoorMenu\|vangFocusInMenu" marketing/src/`
Expected: no output (empty). If `forest.js` still shows internal-only matches unrelated to `zetDagNacht`'s own name/the `dag` toggle line — that's fine, those are out of scope per the design doc; just confirm the function's own declaration and the `onclick` call sites are gone.

- [ ] **Step 4: Commit**

```bash
git add marketing/src/components/Nav.wald marketing/src/assets/js/site.js marketing/src/assets/js/forest.js marketing/src/styles/partials/03-nav.css marketing/src/styles/partials/24-dag-nacht-knop.css marketing/src/styles/partials/17-hamburger-mobiel-menu.css marketing/src/styles/partials/28-footer.css marketing/src/smoke.test.ts
git commit -m "marketing: rename nav/toggle/mobile-menu classes, ids and functions to English

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: Layout-level decorations (growth bar, cursor firefly)

**Files:** `marketing/src/layouts/Layout.wald`, `marketing/src/assets/js/site.js`, `marketing/src/styles/partials/22-groeibalk-scroll-voortgang.css`, `marketing/src/styles/partials/23-cursor-vuurvliegje.css`

- [ ] **Step 1: Rename these ids**

| Old | New |
|---|---|
| `groeibalk` (id) | `growth-bar` |
| `groeiblad` (id) | `growth-leaf` |
| `cursorvlieg` (id) | `cursor-firefly` |

Update the `id="..."` attributes in `Layout.wald`, the `getElementById('...')` calls in `site.js`, and the `#groeibalk`/`#groeiblad`/`#cursorvlieg` CSS selectors in both `.css` files above. Consider renaming the two CSS files themselves — **do not**: file renames are explicitly out of scope per the design doc, even though the current file names now describe content by an id that no longer matches (this is an accepted, deliberate inconsistency, not a mistake to fix).

- [ ] **Step 2: Rebuild and run the smoke tests**

Run: `cd marketing && pnpm build && ./node_modules/.bin/vitest run src/smoke.test.ts`
Expected: PASS.

- [ ] **Step 3: Verify nothing Dutch remains for this cluster**

Run: `grep -rn "groeibalk\|groeiblad\|cursorvlieg" marketing/src/`
Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add marketing/src/layouts/Layout.wald marketing/src/assets/js/site.js marketing/src/styles/partials/22-groeibalk-scroll-voortgang.css marketing/src/styles/partials/23-cursor-vuurvliegje.css
git commit -m "marketing: rename growth-bar and cursor-firefly ids to English

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: Footer structure and fern decoration

**Files:** `marketing/src/components/Footer.wald`, `marketing/src/styles/partials/28-footer.css` (the rest of the file, beyond what Task 1 already touched), `marketing/src/styles/partials/07-varens-botanische-decoratie.css`

- [ ] **Step 1: Rename these identifiers**

| Old | New |
|---|---|
| `footer-bos` (class) | `footer-forest` |
| `footer-merk` (class) | `footer-brand` |
| `footer-onder` (class) | `footer-bottom` |
| `kolom` (class) | `column` |
| `varen` (class, on `svg`) | `fern` |
| `links` (class, on `svg.varen`, meaning "left") | `left` |
| `rechts` (class, on `svg.varen`, meaning "right") | `right` |

Update `Footer.wald`'s markup (including the two `<svg class="varen links">`/`<svg class="varen rechts">` decorative elements), the CSS selectors in both files, and check `marketing/src/assets/js/site.js`'s fern-generation IIFE (`document.querySelectorAll('svg.varen')` and `gsap.utils.toArray('svg.varen')`, around line 95 and 134) — those only reference the base `.varen`/`.fern` class, not `.links`/`.right`, so they need the `varen`→`fern` part of the rename but not a `.links`/`.rechts` change.

- [ ] **Step 2: Rebuild and run the smoke tests**

Run: `cd marketing && pnpm build && ./node_modules/.bin/vitest run src/smoke.test.ts`
Expected: PASS.

- [ ] **Step 3: Verify nothing Dutch remains for this cluster**

Run: `grep -rn "footer-bos\|footer-merk\|footer-onder\|class=\"kolom\"\|varen\b" marketing/src/`
Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add marketing/src/components/Footer.wald marketing/src/styles/partials/28-footer.css marketing/src/styles/partials/07-varens-botanische-decoratie.css marketing/src/assets/js/site.js
git commit -m "marketing: rename footer and fern-decoration classes to English

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 4: Shared homepage section ids (`formaat`, `metafoor`, `structuur`)

**Files:** `marketing/src/components/Formaat.wald`, `marketing/src/components/Metafoor.wald`, `marketing/src/components/Structuur.wald`, `marketing/src/components/Nav.wald`, `marketing/src/components/Footer.wald`, `marketing/src/smoke.test.ts`

- [ ] **Step 1: Rename these ids**

| Old | New |
|---|---|
| `formaat` (id, on the section in `Formaat.wald`) | `format` |
| `metafoor` (id, on the section in `Metafoor.wald`) | `metaphor` |
| `structuur` (id, on the section in `Structuur.wald`) | `structure` |

`formaat` is linked from **both** `Nav.wald` (desktop `links-kant` list and the mobile menu — 2 occurrences of `href="/#formaat"`) and `Footer.wald` (1 occurrence). `structuur` is linked from `Footer.wald` only (1 occurrence, `href="/#structuur"`). `metafoor` has no external links referencing it — only its own section id needs to change.

In `marketing/src/smoke.test.ts`, find the test asserting section ids exist on the homepage (`for (const id of ['quickstart', 'formaat', 'playground', 'metafoor', ...`) and update `'formaat'` → `'format'`, `'metafoor'` → `'metaphor'`, `'structuur'` → `'structure'` in that array.

- [ ] **Step 2: Rebuild and run the smoke tests**

Run: `cd marketing && pnpm build && ./node_modules/.bin/vitest run src/smoke.test.ts`
Expected: PASS.

- [ ] **Step 3: Verify nothing Dutch remains for this cluster**

Run: `grep -rn '"formaat"\|#formaat\|"metafoor"\|#metafoor\|"structuur"\|#structuur' marketing/src/`
Expected: no output. (Component *file names* `Formaat.wald`/`Metafoor.wald`/`Structuur.wald` stay as-is — out of scope.)

- [ ] **Step 4: Commit**

```bash
git add marketing/src/components/Formaat.wald marketing/src/components/Metafoor.wald marketing/src/components/Structuur.wald marketing/src/components/Nav.wald marketing/src/components/Footer.wald marketing/src/smoke.test.ts
git commit -m "marketing: rename formaat/metafoor/structuur section ids to English

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 5: Code-block pattern (`codeblok`, `titel`, `kopieer`, `tekst`)

**Files:** `marketing/src/components/Features.wald`, `marketing/src/components/Formaat.wald`, `marketing/src/components/Hero.wald`, `marketing/src/components/Playground.wald`, `marketing/src/components/Quickstart.wald`, `marketing/src/components/Structuur.wald`, `marketing/src/assets/js/site.js` (the copy-button IIFE only), `marketing/src/styles/partials/08-code.css`, `marketing/src/styles/partials/20-kopieerknop.css`, `marketing/src/styles/partials/11-split.css`, `marketing/src/styles/partials/29-mobiel.css` (only the `.codeblok .titel` / `.split .tekst h2 .tag` media-query rules)

- [ ] **Step 1: Rename these identifiers**

| Old | New |
|---|---|
| `codeblok` (class) | `code-block` |
| `titel` (class, the code-block header bar — appears in every file listed above) | `title` |
| `kopieer` (class, the dynamically-created copy button) | `copy` |
| `tekst` (class, used in `Features.wald`, `Formaat.wald`, `Structuur.wald`, and `.split .tekst` in `11-split.css`) | `text` |

In `site.js`'s copy-button IIFE (the one with the header comment `Kopieerknoppen op codeblokken`, around line 140-161), also rename the local variables to match: `knop` → `button`, `blok` → `block`, `titel` (the local var holding `blok.querySelector('.titel')`) → `titleEl`. Leave `pre` and `label` as-is (already English/generic). The bilingual button label text itself (`'<span class="nl">Kopieer</span><span class="en">Copy</span>'`) stays unchanged — that's content, not a class/variable name.

- [ ] **Step 2: Rebuild and run the smoke tests**

Run: `cd marketing && pnpm build && ./node_modules/.bin/vitest run src/smoke.test.ts`
Expected: PASS.

- [ ] **Step 3: Verify nothing Dutch remains for this cluster**

Run: `grep -rn 'codeblok\|class="titel"\|\.titel\b\|"kopieer"\|\.kopieer\b\|class="tekst"\|\.tekst\b' marketing/src/`
Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add marketing/src/components/Features.wald marketing/src/components/Formaat.wald marketing/src/components/Hero.wald marketing/src/components/Playground.wald marketing/src/components/Quickstart.wald marketing/src/components/Structuur.wald marketing/src/assets/js/site.js marketing/src/styles/partials/08-code.css marketing/src/styles/partials/20-kopieerknop.css marketing/src/styles/partials/11-split.css marketing/src/styles/partials/29-mobiel.css
git commit -m "marketing: rename code-block/title/copy-button/text classes to English

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 5b: Terminal hero animation + GitHub star count

**Files:** `marketing/src/components/Hero.wald`, `marketing/src/assets/js/site.js` (the terminal-typing IIFE and the GitHub-stats IIFE), `marketing/src/styles/partials/21-terminal-in-hero.css`

- [ ] **Step 1: Rename these identifiers**

| Old | New |
|---|---|
| `term-tekst` (id) | `term-text` |
| `term-uit` (id and class — same token used both ways on one element) | `term-output` |
| `gh-sterren` (id) | `gh-stars` |

`term-tekst`/`term-uit` are on `<span id="term-tekst">`/`<span id="term-uit" class="term-uit">` in `Hero.wald`'s terminal block, referenced via `getElementById` in `site.js`'s terminal-animation IIFE, and styled via `21-terminal-in-hero.css`. `gh-sterren` is on a `<b id="gh-sterren">` in `Hero.wald`'s GitHub-stats block, referenced via `getElementById` in `site.js`'s separate GitHub-stats IIFE (`gh-forks`/`gh-stats` are already English, leave those).

- [ ] **Step 2: Rebuild and run the smoke tests**

Run: `cd marketing && pnpm build && ./node_modules/.bin/vitest run src/smoke.test.ts`
Expected: PASS.

- [ ] **Step 3: Verify nothing Dutch remains for this cluster**

Run: `grep -rn 'term-tekst\|term-uit\|gh-sterren' marketing/src/`
Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add marketing/src/components/Hero.wald marketing/src/assets/js/site.js marketing/src/styles/partials/21-terminal-in-hero.css
git commit -m "marketing: rename terminal text/output and GitHub star-count ids to English

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 6: Metaphor cards + generic card grid

**Files:** `marketing/src/components/Metafoor.wald`, `marketing/src/styles/partials/10-kaarten.css`

- [ ] **Step 1: Rename these identifiers**

| Old | New |
|---|---|
| `icoon` (class) | `icon` |
| `kaart` (class, generic card) | `card` |
| `kaarten` (class, card grid container) | `cards` |

Note: `term` (as in `<span class="term">Wald</span>`) is already English (short for "terminology"), leave it. `.kaart h3 span.term` selector in `10-kaarten.css` only needs the `.kaart`→`.card` part renamed.

- [ ] **Step 2: Rebuild and run the smoke tests**

Run: `cd marketing && pnpm build && ./node_modules/.bin/vitest run src/smoke.test.ts`
Expected: PASS.

- [ ] **Step 3: Verify nothing Dutch remains for this cluster**

Run: `grep -rn '"icoon"\|\.icoon\b\|class="kaart"\|\.kaart\b\|class="kaarten"\|\.kaarten\b' marketing/src/`
Expected: no output. (`log-kaart`/`cli-kaart` are handled in Tasks 9/5 respectively — if this grep still shows those, that's fine at this point in the plan, they're different tasks; just confirm no bare, unprefixed `kaart`/`kaarten`/`icoon` remain.)

- [ ] **Step 4: Commit**

```bash
git add marketing/src/components/Metafoor.wald marketing/src/styles/partials/10-kaarten.css
git commit -m "marketing: rename icon/card/cards classes to English

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 6b: CLI command cards

**Files:** `marketing/src/components/Cli.wald`, `marketing/src/styles/partials/15-cli.css`, `marketing/src/styles/partials/29-mobiel.css` (only the `.cli-kaart` media-query rule)

- [ ] **Step 1: Rename `cli-kaart` to `cli-card` everywhere**

4 occurrences in `Cli.wald` (one per CLI command card), several selectors in `15-cli.css` (base rule, `:hover`, a media query, `code`, `p`), one in `29-mobiel.css`'s media query.

- [ ] **Step 2: Rebuild and run the smoke tests**

Run: `cd marketing && pnpm build && ./node_modules/.bin/vitest run src/smoke.test.ts`
Expected: PASS.

- [ ] **Step 3: Verify nothing Dutch remains for this cluster**

Run: `grep -rn 'cli-kaart' marketing/src/`
Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add marketing/src/components/Cli.wald marketing/src/styles/partials/15-cli.css marketing/src/styles/partials/29-mobiel.css
git commit -m "marketing: rename cli-kaart class to cli-card

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 7: Benchmarks

**Files:** `marketing/src/components/Benchmarks.wald`, `marketing/src/styles/partials/13-benchmarks.css`

- [ ] **Step 1: Rename these identifiers**

| Old | New |
|---|---|
| `staafgroep` (class) | `stat-group` |
| `staaf` (class, a labeled bar/row) | `stat` |
| `balk` (class, the visual bar track) | `bar` |
| `waarde` (class) | `value` |
| `vol` (class, on the section — `section.vol` in `Benchmarks.wald`) | `full` |

Careful with `staaf` vs `balk`: they're different nesting levels (`.staaf` is the row/item, `.balk` is the bar-track inside it, `.balk i` is the fill). Both become English words that could look similar (`stat` vs `bar`) — don't conflate them into the same name.

- [ ] **Step 2: Rebuild and run the smoke tests**

Run: `cd marketing && pnpm build && ./node_modules/.bin/vitest run src/smoke.test.ts`
Expected: PASS.

- [ ] **Step 3: Verify nothing Dutch remains for this cluster**

Run: `grep -rn 'staafgroep\|\.staaf\b\|class="staaf' marketing/src/ && grep -rn '\.balk\b\|"balk"' marketing/src/ && grep -rn 'class="waarde"\|\.waarde\b' marketing/src/ && grep -rn 'class="vol"\|section\.vol' marketing/src/`
Expected: no output for any of the four checks.

- [ ] **Step 4: Commit**

```bash
git add marketing/src/components/Benchmarks.wald marketing/src/styles/partials/13-benchmarks.css
git commit -m "marketing: rename benchmark stat-group/stat/bar/value classes to English

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 8: Comparison table

**Files:** `marketing/src/components/Vergelijking.wald`, `marketing/src/styles/partials/26-vergelijking.css`

- [ ] **Step 1: Rename these identifiers**

| Old | New |
|---|---|
| `vergelijk` (class, on the `<table>`) | `compare` |
| `ja` (class, table cell state) | `yes` |
| `nee` (class, table cell state) | `no` |
| `deels` (class, table cell state) | `partial` |

- [ ] **Step 2: Rebuild and run the smoke tests**

Run: `cd marketing && pnpm build && ./node_modules/.bin/vitest run src/smoke.test.ts`
Expected: PASS.

- [ ] **Step 3: Verify nothing Dutch remains for this cluster**

Run: `grep -rn 'class="vergelijk"\|\.vergelijk\b\|class="ja"\|\.ja\b\|class="nee"\|\.nee\b\|class="deels"\|\.deels\b' marketing/src/`
Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add marketing/src/components/Vergelijking.wald marketing/src/styles/partials/26-vergelijking.css
git commit -m "marketing: rename comparison-table classes to English

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 9: Changelog

**Files:** `marketing/src/components/Changelog.wald`, `marketing/src/pages/changelog/index.wald`, `marketing/src/pages/changelog/[slug].wald`, `marketing/src/styles/partials/27-changelog-groeidagboek.css`

- [ ] **Step 1: Rename these identifiers**

| Old | New |
|---|---|
| `log-kaart` (class) | `log-card` |
| `log-kop` (class) | `log-header` |
| `datum` (class) | `date` |
| `changelog-overzicht` (id, on `changelog/index.wald`'s `<section>`) | `changelog-overview` |

`log-kaart` appears in `Changelog.wald` (the homepage's 3-most-recent preview) and in `changelog/index.wald`'s `SafeHtml` template string. `log-kop`/`datum` appear in the same two files, inside the same template strings. Also check `changelog/[slug].wald` — it uses `class="log-kaart"` for the single-entry body wrapper too. The `changelog-overzicht` id is only on `changelog/index.wald`'s opening `<section id="changelog-overzicht" class="pagina-intro">` — no external links reference this id, just rename it (leave the `pagina-intro` class alone, that's Task 11's job).

- [ ] **Step 2: Rebuild and run the smoke tests**

Run: `cd marketing && pnpm build && ./node_modules/.bin/vitest run src/smoke.test.ts`
Expected: PASS. Note: the existing test `'toont nog maar de 3 recentste changelog-entries op de homepage'` asserts `class="log-kaart"` count — update that string to `class="log-card"` too.

- [ ] **Step 3: Verify nothing Dutch remains for this cluster**

Run: `grep -rn 'log-kaart\|log-kop\|class="datum"\|\.datum\b\|changelog-overzicht' marketing/src/`
Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add marketing/src/components/Changelog.wald marketing/src/pages/changelog/index.wald "marketing/src/pages/changelog/[slug].wald" marketing/src/styles/partials/27-changelog-groeidagboek.css marketing/src/smoke.test.ts
git commit -m "marketing: rename changelog log-card/log-header/date classes to English

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 10: Roadmap

**Files:** `marketing/src/components/Roadmap.wald`, `marketing/src/styles/partials/14-roadmap.css`

- [ ] **Step 1: Rename these identifiers**

| Old | New |
|---|---|
| `klaar` (class, badge state — **not** the unrelated, already-English `li.done`) | `complete` |
| `oms` (class, item description span) | `description` |

- [ ] **Step 2: Rebuild and run the smoke tests**

Run: `cd marketing && pnpm build && ./node_modules/.bin/vitest run src/smoke.test.ts`
Expected: PASS.

- [ ] **Step 3: Verify nothing Dutch remains for this cluster**

Run: `grep -rn 'badge klaar\|\.klaar\b\|class="oms"\|\.oms\b' marketing/src/`
Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add marketing/src/components/Roadmap.wald marketing/src/styles/partials/14-roadmap.css
git commit -m "marketing: rename roadmap badge/description classes to English

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 11: `pagina-intro` → `page-intro`

**Files:** `marketing/src/pages/waarom.wald`, `marketing/src/pages/vs/astro.wald`, `marketing/src/pages/vs/eleventy.wald`, `marketing/src/pages/changelog/index.wald`, `marketing/src/pages/changelog/[slug].wald`, `marketing/src/styles/partials/06-secties.css`

- [ ] **Step 1: Rename `pagina-intro` to `page-intro` everywhere**

This class was added in PR #70 (the fixed-nav-overlap fix) on the opening `<section>` of each of these 5 pages, and defined once in `06-secties.css`.

- [ ] **Step 2: Rebuild and run the smoke tests**

Run: `cd marketing && pnpm build && ./node_modules/.bin/vitest run src/smoke.test.ts`
Expected: PASS.

- [ ] **Step 3: Verify nothing Dutch remains for this cluster**

Run: `grep -rn 'pagina-intro' marketing/src/`
Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add marketing/src/pages/waarom.wald marketing/src/pages/vs/astro.wald marketing/src/pages/vs/eleventy.wald marketing/src/pages/changelog/index.wald "marketing/src/pages/changelog/[slug].wald" marketing/src/styles/partials/06-secties.css
git commit -m "marketing: rename pagina-intro class to page-intro

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 12: Playground demo content and compiler function names

**Files:** `marketing/src/assets/js/site.js` (the Playground IIFE only)

- [ ] **Step 1: Translate the default demo code and rename the two local functions**

Find the Playground IIFE (header comment `Playground — mini .wald-compiler`). Change:

```js
  editor.value = `---
const titel = "Mijn eerste boom"
const soorten = ["eik", "beuk", "den"]
---
<h1>{titel}</h1>
<p>Er groeien {soorten.length} soorten in dit bos:</p>
<ul>
  {soorten.map(s => '<li>' + s + '</li>').join('')}
</ul>`;
  function compileer(bron){
```

to:

```js
  editor.value = `---
const title = "My first tree"
const species = ["oak", "beech", "pine"]
---
<h1>{title}</h1>
<p>{species.length} species grow in this forest:</p>
<ul>
  {species.map(s => '<li>' + s + '</li>').join('')}
</ul>`;
  function compile(source){
```

Then update every use of `bron` (the parameter, now `source`) inside `compileer`'s (now `compile`'s) body, and rename the `compileer(...)` call site inside `ververs()`. Rename `ververs` itself to `refresh`, and its call site (`editor.addEventListener('input', ververs); ververs();`) accordingly. Leave the internal local variables `fm`, `tpl`, `delen`, `vars`, `code` — check the design doc's JS table; only `compileer`→`compile`, `ververs`→`refresh`, and `bron`→`source` are listed. (If you find `delen`/`fm`/`tpl` genuinely bother you, leave them — they're not in the approved rename table, and scope-creeping beyond the agreed list on a task like this is exactly what review will flag.)

- [ ] **Step 2: Rebuild and run the smoke tests**

Run: `cd marketing && pnpm build && ./node_modules/.bin/vitest run src/smoke.test.ts`
Expected: PASS.

- [ ] **Step 3: Manual check of the actual demo behavior**

Run: `grep -o 'const title = [^\n]*' dist/assets/js/site.js` (or open `dist/index.html` in a browser, scroll to Playground, confirm the editor shows the English demo and the preview renders "My first tree" / "3 species grow in this forest:" with an oak/beech/pine list). This is genuinely visible, interactive content — worth eyeballing once, not just trusting the string diff.

- [ ] **Step 4: Verify nothing Dutch remains for this cluster**

Run: `grep -n 'compileer\|ververs\|Mijn eerste boom\|soorten\|eik.*beuk.*den' marketing/src/assets/js/site.js`
Expected: no output.

- [ ] **Step 5: Commit**

```bash
git add marketing/src/assets/js/site.js
git commit -m "marketing: translate Playground demo content, rename compile/refresh functions

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 13: `sectiekop` → `section-heading` (cross-cutting, 19 files)

This is the single most widely-used Dutch class in the codebase — the shared "tag + heading + intro paragraph" block at the top of nearly every section on every page. Deliberately done last among the rename tasks (not first) so it doesn't conflict with in-flight work from earlier tasks touching the same files for unrelated reasons (e.g. Task 6's `Metafoor.wald` edits, Task 7's `Benchmarks.wald` edits).

**Files (confirmed via `grep -rl "sectiekop" marketing/src/`, all 19 — don't rely on memory, re-run that grep yourself before starting in case an earlier task incidentally changed something):**

- `marketing/src/components/Benchmarks.wald`
- `marketing/src/components/Changelog.wald`
- `marketing/src/components/Cli.wald`
- `marketing/src/components/Features.wald`
- `marketing/src/components/Faq.wald`
- `marketing/src/components/Metafoor.wald`
- `marketing/src/components/Packages.wald`
- `marketing/src/components/Playground.wald`
- `marketing/src/components/Quickstart.wald`
- `marketing/src/components/Vergelijking.wald`
- `marketing/src/components/Roadmap.wald`
- `marketing/src/pages/waarom.wald`
- `marketing/src/pages/changelog/[slug].wald`
- `marketing/src/pages/vs/astro.wald`
- `marketing/src/pages/changelog/index.wald`
- `marketing/src/pages/vs/eleventy.wald`
- `marketing/src/styles/partials/01-base.css`
- `marketing/src/styles/partials/06-secties.css`
- `marketing/src/styles/partials/29-mobiel.css`

- [ ] **Step 1: Rename `sectiekop` to `section-heading` in all 19 files above**

Every `.wald` file has exactly one `<div class="sectiekop">` (occasionally two, e.g. a page with an intro section plus a second content section that also uses the pattern — check each file, don't assume exactly one). The 3 CSS files have the actual style rules (`06-secties.css` is the primary owner: `.sectiekop`, `.sectiekop .tag`, `.sectiekop h2`, `.sectiekop p`, `.sectiekop::after`; `01-base.css` has one reference inside the `text-wrap: balance` selector list (`.sectiekop p`); `29-mobiel.css` has responsive overrides).

- [ ] **Step 2: Rebuild and run the smoke tests**

Run: `cd marketing && pnpm build && ./node_modules/.bin/vitest run src/smoke.test.ts`
Expected: PASS.

- [ ] **Step 3: Verify nothing Dutch remains for this cluster**

Run: `grep -rn "sectiekop" marketing/src/`
Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add marketing/src/components/Benchmarks.wald marketing/src/components/Changelog.wald marketing/src/components/Cli.wald marketing/src/components/Features.wald marketing/src/components/Faq.wald marketing/src/components/Metafoor.wald marketing/src/components/Packages.wald marketing/src/components/Playground.wald marketing/src/components/Quickstart.wald marketing/src/components/Vergelijking.wald marketing/src/components/Roadmap.wald marketing/src/pages/waarom.wald "marketing/src/pages/changelog/[slug].wald" marketing/src/pages/vs/astro.wald marketing/src/pages/changelog/index.wald marketing/src/pages/vs/eleventy.wald marketing/src/styles/partials/01-base.css marketing/src/styles/partials/06-secties.css marketing/src/styles/partials/29-mobiel.css
git commit -m "marketing: rename sectiekop class to section-heading across the whole site

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 14: Final full-codebase verification + push + PR

**Files:** none (verification only)

- [ ] **Step 1: Run the full monorepo test suite**

Run (from the worktree root): `pnpm build && pnpm test`
Expected: PASS across every package.

- [ ] **Step 2: Full-codebase grep for every renamed identifier**

Run this single combined check (adjust/extend if you recall any identifier from the design doc's tables not listed here):

```bash
grep -rnE "actief|verberg|links-kant|rechts-kant|dagnacht|mobielmenu|\bsluit\b|zetTaal|zetGeluid|zetDagNacht|vorigeFocusVoorMenu|vangFocusInMenu|groeibalk|groeiblad|cursorvlieg|footer-bos|footer-merk|footer-onder|class=\"kolom\"|varen|\"formaat\"|#formaat|\"metafoor\"|#metafoor|\"structuur\"|#structuur|codeblok|class=\"titel\"|\.titel\b|\"kopieer\"|\.kopieer\b|class=\"tekst\"|\.tekst\b|\"icoon\"|\.icoon\b|class=\"kaart\"|\.kaart\b|class=\"kaarten\"|\.kaarten\b|staafgroep|\.staaf\b|\.balk\b|class=\"waarde\"|\.waarde\b|class=\"vol\"|class=\"vergelijk\"|\.vergelijk\b|class=\"ja\"|\.ja\b|class=\"nee\"|\.nee\b|class=\"deels\"|\.deels\b|log-kaart|log-kop|class=\"datum\"|\.datum\b|badge klaar|\.klaar\b|class=\"oms\"|\.oms\b|pagina-intro|compileer|ververs|term-tekst|term-uit|gh-sterren|cli-kaart|sectiekop|changelog-overzicht" marketing/src/
```

Expected: no output. If anything matches, that's a missed rename from an earlier task — go fix it in the appropriate task's spirit (same commit-message style), don't just patch it silently here.

- [ ] **Step 3: Visual spot-check**

Run: `pnpm build` (from `marketing/`), then open `dist/index.html`, `dist/waarom/index.html`, and `dist/changelog/index.html` in a browser (or screenshot via any available headless-browser tooling) and confirm: benchmark bars render correctly, metaphor cards look unchanged, code-block copy buttons appear and work, the footer's fern decorations and columns look unchanged, the mobile hamburger menu still opens/closes/traps focus correctly (re-verify this specifically — Task 1 touched the exact same focus-trap code reviewed carefully in the previous sub-project).

- [ ] **Step 4: Push and open a PR**

```bash
git push -u origin refactor/english-css-classnames
```

Open a PR against `main`. Note in the description: (1) this is sub-project 3 of 3, closing out the accessibility/semantics/i18n-naming effort (sub-projects 1 and 2 are PRs #72 and #73); (2) this is a pure identifier rename — no visual or behavioral change is intended anywhere; (3) list the explicit scope exclusions (forest.js internals, `/waarom`'s own ids/content, file names) so a reviewer doesn't wonder why those weren't touched; (4) summarize the final verification (full-codebase grep returned clean, full test suite passes, mobile-menu focus trap re-verified).
