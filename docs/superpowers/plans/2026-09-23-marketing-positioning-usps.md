# Marketing Positioning (USPs) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `/waarom` ("why WaldJS") page telling WaldJS's own story without comparison framing, and sharpen `/vs/astro`'s "why choose WaldJS" bullets — both grounded in the session's verified facts (benchmark numbers, canopy's actual design, built-in tooling), not invented claims.

**Architecture:** New `marketing/src/pages/waarom.wald` using the existing `Layout`, no comparison table, no named competitors. Cross-linked from `Nav.wald`, `Footer.wald`, and both `/vs/*` pages. `/vs/astro`'s existing "Kies WaldJS als je..." bullets get replaced with sharper, more specific ones.

**Spec:** `docs/superpowers/specs/2026-09-23-marketing-positioning-usps-design.md`

**Tech Stack:** WaldJS (Layout, static pages), Vitest.

---

## Before you start

This plan assumes you're already in the isolated worktree at
`/Users/stefan/Desktop/semantique-agency/repositories/waldjs/.worktrees/marketing-positioning`
on branch `feat/marketing-positioning-usps`, stacked on the not-yet-merged
`feat/marketing-content-expansion` (PR #63, itself stacked on the
already-merged #61/#62). If starting fresh:

```bash
git fetch origin main
git fetch origin feat/marketing-content-expansion
git worktree add .worktrees/marketing-positioning -b feat/marketing-positioning-usps origin/feat/marketing-content-expansion
cd .worktrees/marketing-positioning
export NVM_DIR="$HOME/.nvm" && \. "$NVM_DIR/nvm.sh" && nvm use 22
pnpm install
pnpm build
```

Run all commands from `marketing/` inside this worktree unless noted. Use
`./node_modules/.bin/vitest` (not `../node_modules/.bin/vitest`).

**Important tone context (not just content — read before writing anything):**
`/waarom` must NOT read as a comparison page. Do not name Astro, Eleventy, or
any other framework anywhere on `/waarom`. It tells WaldJS's own story on
its own terms — a page that keeps gesturing at a competitor reinforces "this
is just a clone of X," which is exactly what this page exists to avoid.
`/vs/astro` is the opposite case: it's explicitly a comparison page for
people already comparing, so naming Astro there is expected and fine.

---

### Task 1: `/waarom` page + cross-links + sharpened `/vs/astro` bullets

**Files:**
- Create: `marketing/src/pages/waarom.wald`
- Modify: `marketing/src/components/Nav.wald`
- Modify: `marketing/src/components/Footer.wald`
- Modify: `marketing/src/pages/vs/astro.wald`
- Modify: `marketing/src/pages/vs/eleventy.wald`
- Modify: `marketing/src/smoke.test.ts`

- [ ] **Step 1: Write the failing tests first**

In `marketing/src/smoke.test.ts`, add a new `it` block inside the existing
`describe('marketing site build', ...)` (after the last existing `it`
block, before the closing `})`):

```ts
  it('produceert een /waarom-pagina zonder concurrent-namen', () => {
    const path = join(ROOT, 'dist/waarom/index.html')
    expect(existsSync(path)).toBe(true)
    const html = readFileSync(path, 'utf-8')
    expect(html).toContain('<link rel="canonical" href="https://waldjs.steefan.nl/waarom">')
    expect(html.toLowerCase()).not.toContain('astro')
    expect(html.toLowerCase()).not.toContain('eleventy')

    const sitemap = readFileSync(join(ROOT, 'dist/sitemap.xml'), 'utf-8')
    expect(sitemap).toContain('<loc>https://waldjs.steefan.nl/waarom</loc>')
  })
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd marketing && ./node_modules/.bin/vitest run src/smoke.test.ts`
Expected: FAIL — `dist/waarom/index.html` doesn't exist yet.

- [ ] **Step 3: Create the `/waarom` page**

Create `marketing/src/pages/waarom.wald`:

```wald
---
import Layout from '../layouts/Layout.wald'
---
<Layout
  title="Waarom WaldJS?"
  description="WaldJS in het kort: bouwsnelheid, geen framework-lock-in voor interactiviteit, en één klein formaat zonder extra tooling."
  canonicalPath="/waarom"
>
  <section id="waarom-intro">
    <div class="sectiekop">
      <span class="tag"><span class="nl">Filosofie</span><span class="en">Philosophy</span></span>
      <h1><span class="nl">Waarom WaldJS?</span><span class="en">Why WaldJS?</span></h1>
      <p><span class="nl">Nog een framework. We snappen het — er zijn er al genoeg. Maar WaldJS vraagt weinig: één bestandsformaat, geen losse tooling, en je bent binnen een paar minuten weer weg als het niks voor je is.</span><span class="en">Yet another framework. We get it — there are plenty already. But WaldJS asks little of you: one file format, no separate tooling, and you can walk away in minutes if it's not for you.</span></p>
    </div>
  </section>

  <section id="waarom-snelheid">
    <div class="sectiekop">
      <h2><span class="nl">Bouwt in seconden, niet minuten</span><span class="en">Builds in seconds, not minutes</span></h2>
      <p><span class="nl">Voor dezelfde 50-berichten-blogsite bouwt WaldJS in 1,62 seconden. Dat zijn onze eigen, gemeten <a href="/#benchmarks">benchmarks</a> — geen marketingclaim.</span><span class="en">For the same 50-post blog site, WaldJS builds in 1.62 seconds. That's our own, measured <a href="/#benchmarks">benchmark data</a> — not a marketing claim.</span></p>
    </div>
  </section>

  <section id="waarom-lockin">
    <div class="sectiekop">
      <h2><span class="nl">Geen framework-keuze om te maken</span><span class="en">No framework choice to make</span></h2>
      <p><span class="nl">Canopy's — de stukjes die interactief worden — zijn gewone JS/TS-modules. Geen adapter om te kiezen, geen extra dependency om te installeren. Je schrijft de code die je toch al zou schrijven, en WaldJS laadt 'm op het juiste moment.</span><span class="en">Canopies — the bits that become interactive — are plain JS/TS modules. No adapter to choose, no extra dependency to install. You write the code you'd write anyway, and WaldJS loads it at the right moment.</span></p>
    </div>
  </section>

  <section id="waarom-formaat">
    <div class="sectiekop">
      <h2><span class="nl">Eén formaat, verder niets te installeren</span><span class="en">One format, nothing else to install</span></h2>
      <p><span class="nl">Een <code style="font-family:var(--mono);font-size:.85em">.wald</code>-bestand is frontmatter en template in één geheel. De formatter (<code style="font-family:var(--mono);font-size:.85em">wald format</code>) en leesbare foutpagina's in de dev-server zitten er al in — geen Prettier-config, geen losse plugin te zoeken.</span><span class="en">A <code style="font-family:var(--mono);font-size:.85em">.wald</code> file is frontmatter and template as one whole. The formatter (<code style="font-family:var(--mono);font-size:.85em">wald format</code>) and readable dev-server error pages are already built in — no Prettier config, no separate plugin to hunt down.</span></p>
    </div>
  </section>

  <section id="waarom-namen">
    <div class="sectiekop">
      <h2><span class="nl">Namen die iets betekenen</span><span class="en">Names that mean something</span></h2>
      <p><span class="nl">Roots is de compiler, trees zijn je pagina's, branches je componenten, canopies de interactieve laag. Zodra je het bos-verhaal snapt, kun je <code style="font-family:var(--mono);font-size:.85em">wald grow</code> raden zonder de docs te openen.</span><span class="en">Roots is the compiler, trees are your pages, branches your components, canopies the interactive layer. Once you get the forest story, you can guess what <code style="font-family:var(--mono);font-size:.85em">wald grow</code> does without opening the docs.</span></p>
    </div>
  </section>

  <section id="waarom-cta">
    <div class="sectiekop">
      <p style="margin-top:1.5rem">
        <a class="btn" href="/#quickstart"><span class="nl">Probeer het — 2 minuten</span><span class="en">Try it — 2 minutes</span></a>
      </p>
    </div>
  </section>
</Layout>
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd marketing && pnpm build && ./node_modules/.bin/vitest run src/smoke.test.ts`
Expected: PASS.

- [ ] **Step 5: Add `/waarom` to `Nav.wald`**

In `marketing/src/components/Nav.wald`, in the desktop `<ul class="links-kant">`
list, add a new item right after the Changelog `<li>`:

```html
    <li class="verberg"><a href="/changelog">Changelog</a></li>
    <li class="verberg"><a href="/waarom"><span class="nl">Waarom WaldJS</span><span class="en">Why WaldJS</span></a></li>
```

In the mobile menu (`#mobielmenu` div), add a new link right after the
Changelog link and before the GitHub link:

```html
  <a href="/changelog" onclick="toggleMenu(false)">Changelog</a>
  <a href="/waarom" onclick="toggleMenu(false)"><span class="nl">Waarom WaldJS</span><span class="en">Why WaldJS</span></a>
  <a href="https://github.com/Stefan-Espant/WaldJS/" target="_blank" rel="noopener">GitHub ↗</a>
```

- [ ] **Step 6: Add `/waarom` to `Footer.wald`**

In `marketing/src/components/Footer.wald`, in the "Verken"/"Explore" column
(the first `<ul>`, containing Quick start/.wald-format/Features/Benchmarks/
Roadmap), add a new item at the end:

```html
        <li><a href="/#roadmap">Roadmap</a></li>
        <li><a href="/waarom"><span class="nl">Waarom WaldJS</span><span class="en">Why WaldJS</span></a></li>
```

- [ ] **Step 7: Sharpen `/vs/astro`'s "Kies WaldJS als je..." bullets**

In `marketing/src/pages/vs/astro.wald`, replace:

```html
        <ul>
          <li><span class="nl">een kleiner, eenvoudiger formaat wilt zonder een groot integratie-ecosysteem nodig te hebben</span><span class="en">want a smaller, simpler format and don't need a large integration ecosystem</span></li>
          <li><span class="nl">canopy-islands als gewone JS/TS-modules voldoende vindt, zonder losse framework-adapters</span><span class="en">are fine with canopy islands as plain JS/TS modules, without separate framework adapters</span></li>
        </ul>
```

with:

```html
        <ul>
          <li><span class="nl">bouwsnelheid zwaar laat wegen — 1,62s versus 138,92s voor dezelfde 50-posts-blogsite in onze eigen benchmarks</span><span class="en">weigh build speed heavily — 1.62s vs. 138.92s for the same 50-post blog site in our own benchmarks</span></li>
          <li><span class="nl">geen framework-adapter wilt kiezen voor interactiviteit — canopy's zijn gewone JS/TS, geen React/Vue/Svelte-laag erbovenop</span><span class="en">don't want to choose a framework adapter for interactivity — canopies are plain JS/TS, no React/Vue/Svelte layer on top</span></li>
        </ul>
```

Also add one link to `/waarom` at the end of the `#vs-astro-keuze` section,
right after the closing `</div>` of the `split` div and before the section's
closing `</section>` tag:

```html
    </div>
    <p style="margin-top:1.5rem"><a href="/waarom"><span class="nl">Lees het hele verhaal van WaldJS →</span><span class="en">Read WaldJS's full story →</span></a></p>
  </section>
```

(This replaces the previous bare `</div>\n  </section>` ending of that
section — read the current file first to get the exact surrounding
whitespace right, don't guess blindly.)

- [ ] **Step 8: Add the same `/waarom` link to `/vs/eleventy`**

In `marketing/src/pages/vs/eleventy.wald`, add the identical closing link to
the end of its own `#vs-eleventy-keuze` section (same pattern as Step 7,
adapted to this file's section id):

```html
    <p style="margin-top:1.5rem"><a href="/waarom"><span class="nl">Lees het hele verhaal van WaldJS →</span><span class="en">Read WaldJS's full story →</span></a></p>
  </section>
```

- [ ] **Step 9: Rebuild and run the full test suite**

Run: `cd marketing && pnpm build && ./node_modules/.bin/vitest run src/smoke.test.ts`
Expected: PASS — all tests, including the new `/waarom` test and the
existing (unmodified) `/vs/astro`/`/vs/eleventy` distinct-title/canonical
test from the content-expansion PR (the bullet/link changes inside the page
body don't affect title/canonical, so that test should keep passing
untouched).

- [ ] **Step 10: Manually re-confirm the tone requirement**

Run: `grep -io 'astro\|eleventy' marketing/dist/waarom/index.html`
Expected: no output (already covered by the automated test in Step 1, but
worth a direct visual confirmation given how central this requirement is).

- [ ] **Step 11: Commit**

```bash
git add marketing/src/pages/waarom.wald marketing/src/components/Nav.wald marketing/src/components/Footer.wald marketing/src/pages/vs/astro.wald marketing/src/pages/vs/eleventy.wald marketing/src/smoke.test.ts
git commit -m "marketing: add /waarom positioning page, sharpen /vs/astro USP bullets"
```

---

### Task 2: Full verification pass

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

Run (from the repo root): `pnpm build && pnpm test`
Expected: PASS across every package.

- [ ] **Step 2: Manual checklist**

- [ ] `dist/sitemap.xml` contains 13 routes now (the 12 from the
      content-expansion PR + `/waarom`).
- [ ] `dist/waarom/index.html` genuinely contains no mention of Astro or
      Eleventy (already covered by an automated test, confirm once more).
- [ ] `/waarom` is reachable from the homepage's own Nav (desktop + mobile)
      and Footer, and from both `/vs/astro` and `/vs/eleventy`.
- [ ] Re-read `/waarom`'s copy and the sharpened `/vs/astro` bullets once
      more — flag in the final report that this is first-draft marketing
      copy needing human review before merge (same caveat as the prior two
      SEO-sub-project PRs).

- [ ] **Step 3: Push and open a PR**

```bash
git push -u origin feat/marketing-positioning-usps
```

Open a PR against `main`. Note in the description: (1) this is a follow-up
to the three SEO sub-projects, stacked on the not-yet-merged
`feat/marketing-content-expansion` (PR #63); (2) the goal was sharper
positioning without reading as "just Astro with a forest theme" — explain
briefly why `/waarom` deliberately never names a competitor while `/vs/astro`
still does; (3) the copy is a first draft needing human review before merge.
