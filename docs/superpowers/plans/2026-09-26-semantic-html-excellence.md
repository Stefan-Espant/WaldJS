# Semantic HTML Excellence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring the marketing site to a modern (2026) semantic-HTML/accessibility baseline: valid heading order everywhere, a `<main>` landmark, table header scope, a real dialog-semantics mobile menu with focus trapping, `aria-current="page"`, and a skip-to-content link.

**Architecture:** Two shared, structural heading-order fixes (Footer, changelog cards) instead of per-page patches; a `<main>` wrapper and skip-link in the shared `Layout.wald`; `canonicalPath` threaded from `Layout` to `Nav` (mirroring the existing `Layout`→`Footer` pattern) for `aria-current`; focus-trap logic added to the existing `toggleMenu()` in `site.js`.

**Spec:** `docs/superpowers/specs/2026-09-26-semantic-html-excellence-design.md`

**Tech Stack:** WaldJS (`.wald` components, `SafeHtml` for conditional/dynamic markup), Vitest, `puppeteer-core` for the one JS-timing-dependent manual check.

---

## Before you start

This plan assumes you're already in the isolated worktree at
`/Users/stefan/Desktop/semantique-agency/repositories/waldjs/.worktrees/semantic-html`
on branch `a11y/semantic-html-excellence`. If starting fresh:

```bash
git fetch origin main
git worktree add .worktrees/semantic-html -b a11y/semantic-html-excellence origin/main
cd .worktrees/semantic-html
export NVM_DIR="$HOME/.nvm" && \. "$NVM_DIR/nvm.sh" && nvm use 22
pnpm install
```

Run all commands from `marketing/` inside this worktree unless noted.

---

### Task 1: Heading-order fixes (Footer + changelog cards)

**Files:**
- Modify: `marketing/src/components/Footer.wald`
- Modify: `marketing/src/styles/partials/28-footer.css`
- Modify: `marketing/src/pages/changelog/index.wald`
- Modify: `marketing/src/styles/partials/27-changelog-groeidagboek.css`
- Modify: `marketing/src/smoke.test.ts`

- [ ] **Step 1: Write the failing tests**

In `marketing/src/smoke.test.ts`, add this helper function near the top of
the file, right after the `const ROOT = join(__dirname, '..')` line (before
the `describe(...)` block):

```ts
function checkHeadingOrder(html: string, label: string): void {
  const levels = [...html.matchAll(/<h([1-6])[ >]/g)].map(m => Number(m[1]))
  for (let i = 1; i < levels.length; i++) {
    expect(levels[i] - levels[i - 1], `${label}: heading jumps from h${levels[i - 1]} to h${levels[i]} (position ${i})`).toBeLessThanOrEqual(1)
  }
}
```

Then add a new `it` block inside `describe('marketing site build', ...)`
(after the last existing `it` block, before the closing `})`):

```ts
  it('heeft geldige koppen-volgorde (geen niveau overslaan) op elk paginatype', () => {
    const pages = [
      'dist/index.html',
      'dist/waarom/index.html',
      'dist/vs/astro/index.html',
      'dist/vs/eleventy/index.html',
      'dist/changelog/index.html',
      'dist/changelog/roots/index.html',
    ]
    for (const page of pages) {
      const html = readFileSync(join(ROOT, page), 'utf-8')
      checkHeadingOrder(html, page)
    }
  })

  it('gebruikt h2 voor changelog-kaarttitels en footer-kolomtitels, geen h3/h4', () => {
    const changelog = readFileSync(join(ROOT, 'dist/changelog/index.html'), 'utf-8')
    expect(changelog).toContain('<h2><a href="/changelog/roots">')
    expect(changelog).not.toContain('<h3><a href="/changelog/')

    const html = readFileSync(join(ROOT, 'dist/index.html'), 'utf-8')
    expect((html.match(/class="footer-grid"[\s\S]*?<h2>/g) ?? []).length).toBeGreaterThan(0)
  })
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd marketing && pnpm build && ./node_modules/.bin/vitest run src/smoke.test.ts`
Expected: FAIL — `/waarom`, `/changelog`, and `/changelog/roots` currently
have heading-order skips, and the h2-not-h3/h4 assertions don't match yet.

- [ ] **Step 3: Fix `Footer.wald`'s column headings**

In `marketing/src/components/Footer.wald`, change both occurrences of
`<h4>` to `<h2>`:

```html
    <div class="kolom">
      <h2><span class="nl">Verken</span><span class="en">Explore</span></h2>
```

and

```html
    <div class="kolom">
      <h2><span class="nl">Bronnen</span><span class="en">Resources</span></h2>
```

- [ ] **Step 4: Update the matching CSS selector**

In `marketing/src/styles/partials/28-footer.css`, find `.footer-grid h4`
and rename it to `.footer-grid h2`. Read the file first to get the exact
surrounding rule content right — don't guess at the declarations inside.

- [ ] **Step 5: Fix the changelog card titles**

In `marketing/src/pages/changelog/index.wald`, inside the `SafeHtml`
template-string block, change `<h3>` to `<h2>`:

```
          <div class="log-kop"><h2><a href="/changelog/${entry.slug}">${entry.data.title}</a></h2><span class="datum">${entry.data.dateLabel}</span></div>
```

- [ ] **Step 6: Update the matching CSS selectors**

In `marketing/src/styles/partials/27-changelog-groeidagboek.css`, rename
every `.log-kop h3` selector (there are three: the base rule, the
`a, a:visited` rule, and the `a:hover, a:focus-visible` rule) to
`.log-kop h2`. Read the file first for the exact current content.

- [ ] **Step 7: Run the tests to verify they pass**

Run: `cd marketing && pnpm build && ./node_modules/.bin/vitest run src/smoke.test.ts`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add marketing/src/components/Footer.wald marketing/src/styles/partials/28-footer.css marketing/src/pages/changelog/index.wald marketing/src/styles/partials/27-changelog-groeidagboek.css marketing/src/smoke.test.ts
git commit -m "marketing: fix heading-order skips via Footer/changelog h2 (was h4/h3)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: `<main>` landmark + skip-to-content link

**Files:**
- Modify: `marketing/src/layouts/Layout.wald`
- Modify: `marketing/src/styles/partials/01-base.css`
- Modify: `marketing/src/smoke.test.ts`

- [ ] **Step 1: Write the failing tests**

In `marketing/src/smoke.test.ts`, add a new `it` block:

```ts
  it('heeft precies een <main id="main"> landmark en een skip-link ernaartoe', () => {
    for (const page of ['dist/index.html', 'dist/waarom/index.html']) {
      const html = readFileSync(join(ROOT, page), 'utf-8')
      expect((html.match(/<main id="main">/g) ?? []).length, `${page} main count`).toBe(1)
      expect(html).toContain('<a class="skip-link" href="#main">')
    }
  })
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd marketing && pnpm build && ./node_modules/.bin/vitest run src/smoke.test.ts`
Expected: FAIL.

- [ ] **Step 3: Add the skip-link and `<main>` wrapper**

In `marketing/src/layouts/Layout.wald`, add the skip-link as the very first
line after `<body>` opens:

```html
<body>
<a class="skip-link" href="#main"><span class="nl">Ga naar inhoud</span><span class="en">Skip to content</span></a>
<!-- logo-definitie (onzichtbaar; nav & footer verwijzen ernaar) -->
```

Then change:

```html
<Nav />
{pond}
<Footer canonicalPath={canonicalPath} />
```

to:

```html
<Nav />
<main id="main">
{pond}
</main>
<Footer canonicalPath={canonicalPath} />
```

(Leave `<Nav />` as-is for now — Task 4 adds `canonicalPath` to it.)

- [ ] **Step 4: Add the skip-link CSS**

In `marketing/src/styles/partials/01-base.css`, add this after the existing
`p a:not(.btn):hover, p a:not(.btn):focus-visible { color: var(--wit) }`
rule and before the `h1, h2, h3, h4, ...` rule:

```css
.skip-link {
  position: absolute;
  top: -3rem;
  left: 1rem;
  z-index: var(--byz-z-tooltip);
  background: var(--rood);
  color: var(--wit);
  padding: 0.625rem 1.25rem;
  border-radius: 0.5rem;
  text-decoration: none;
  font-weight: 700;
  transition: top .2s
}

.skip-link:focus {
  top: 1rem
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd marketing && pnpm build && ./node_modules/.bin/vitest run src/smoke.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add marketing/src/layouts/Layout.wald marketing/src/styles/partials/01-base.css marketing/src/smoke.test.ts
git commit -m "marketing: add <main> landmark and skip-to-content link

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: Comparison table header scope

**Files:**
- Modify: `marketing/src/components/Vergelijking.wald`
- Modify: `marketing/src/smoke.test.ts`

- [ ] **Step 1: Write the failing test**

In `marketing/src/smoke.test.ts`, add:

```ts
  it('heeft scope="col" op alle th-cellen van de vergelijkingstabel', () => {
    const html = readFileSync(join(ROOT, 'dist/vs/astro/index.html'), 'utf-8')
    const ths = html.match(/<th[^>]*>/g) ?? []
    expect(ths.length).toBeGreaterThan(0)
    for (const th of ths) {
      expect(th, th).toContain('scope="col"')
    }
  })
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd marketing && pnpm build && ./node_modules/.bin/vitest run src/smoke.test.ts`
Expected: FAIL.

- [ ] **Step 3: Add `scope="col"`**

In `marketing/src/components/Vergelijking.wald`, change:

```html
    <tr><th>Feature</th><th>WaldJS</th><th>Astro</th><th>Eleventy</th></tr>
```

to:

```html
    <tr><th scope="col">Feature</th><th scope="col">WaldJS</th><th scope="col">Astro</th><th scope="col">Eleventy</th></tr>
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd marketing && pnpm build && ./node_modules/.bin/vitest run src/smoke.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add marketing/src/components/Vergelijking.wald marketing/src/smoke.test.ts
git commit -m "marketing: add scope=col to comparison table headers

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 4: `aria-current="page"` on the active nav link

**Files:**
- Modify: `marketing/src/layouts/Layout.wald`
- Modify: `marketing/src/components/Nav.wald`
- Modify: `marketing/src/smoke.test.ts`

- [ ] **Step 1: Write the failing tests**

In `marketing/src/smoke.test.ts`, add:

```ts
  it('zet aria-current="page" alleen op de nav-link van de huidige pagina', () => {
    const changelog = readFileSync(join(ROOT, 'dist/changelog/index.html'), 'utf-8')
    expect(changelog).toContain('href="/changelog" aria-current="page"')
    expect(changelog).not.toContain('href="/waarom" aria-current="page"')

    const home = readFileSync(join(ROOT, 'dist/index.html'), 'utf-8')
    expect(home).not.toContain('aria-current="page"')
  })
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd marketing && pnpm build && ./node_modules/.bin/vitest run src/smoke.test.ts`
Expected: FAIL.

- [ ] **Step 3: Pass `canonicalPath` from Layout to Nav**

In `marketing/src/layouts/Layout.wald`, change `<Nav />` to
`<Nav canonicalPath={canonicalPath} />`.

- [ ] **Step 4: Build the conditional attribute in Nav's frontmatter**

In `marketing/src/components/Nav.wald`, replace the empty frontmatter
(`---\n---`) with:

```
---
const { canonicalPath } = $$props
const changelogCurrent = canonicalPath === '/changelog' ? ' aria-current="page"' : ''
const waaromCurrent = canonicalPath === '/waarom' ? ' aria-current="page"' : ''
---
```

- [ ] **Step 5: Apply it to the desktop nav links**

Replace:

```html
    <li class="verberg"><a href="/changelog">Changelog</a></li>
    <li class="verberg"><a href="/waarom"><span class="nl">Waarom WaldJS</span><span class="en">Why WaldJS</span></a></li>
```

with:

```
    {new SafeHtml(`<li class="verberg"><a href="/changelog"${changelogCurrent}>Changelog</a></li>`)}
    {new SafeHtml(`<li class="verberg"><a href="/waarom"${waaromCurrent}><span class="nl">Waarom WaldJS</span><span class="en">Why WaldJS</span></a></li>`)}
```

- [ ] **Step 6: Apply it to the mobile menu links**

Replace:

```html
  <a href="/changelog" onclick="toggleMenu(false)">Changelog</a>
  <a href="/waarom" onclick="toggleMenu(false)"><span class="nl">Waarom WaldJS</span><span class="en">Why WaldJS</span></a>
```

with:

```
  {new SafeHtml(`<a href="/changelog" onclick="toggleMenu(false)"${changelogCurrent}>Changelog</a>`)}
  {new SafeHtml(`<a href="/waarom" onclick="toggleMenu(false)"${waaromCurrent}><span class="nl">Waarom WaldJS</span><span class="en">Why WaldJS</span></a>`)}
```

- [ ] **Step 7: Run the test to verify it passes**

Run: `cd marketing && pnpm build && ./node_modules/.bin/vitest run src/smoke.test.ts`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add marketing/src/layouts/Layout.wald marketing/src/components/Nav.wald marketing/src/smoke.test.ts
git commit -m "marketing: add aria-current=page to the active nav link

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 5: Mobile menu — dialog semantics + focus trap

**Files:**
- Modify: `marketing/src/components/Nav.wald`
- Modify: `marketing/src/assets/js/site.js`
- Modify: `marketing/src/smoke.test.ts`

This task's JS behavior (focus moving into/out of the menu) can't be
verified by a static HTML test alone — per this session's established
lesson from an earlier scroll-timing bug, trust a real headless-browser
check over "the code reads correctly." Step 5 covers that.

- [ ] **Step 1: Write the failing static test**

In `marketing/src/smoke.test.ts`, add:

```ts
  it('geeft het mobiele menu dialog-semantiek', () => {
    const html = readFileSync(join(ROOT, 'dist/index.html'), 'utf-8')
    expect(html).toContain('id="mobielmenu"')
    const mobielmenuTag = html.match(/<div id="mobielmenu"[^>]*>/)?.[0] ?? ''
    expect(mobielmenuTag).toContain('role="dialog"')
    expect(mobielmenuTag).toContain('aria-modal="true"')
  })
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd marketing && pnpm build && ./node_modules/.bin/vitest run src/smoke.test.ts`
Expected: FAIL.

- [ ] **Step 3: Add dialog attributes to the mobile menu markup**

In `marketing/src/components/Nav.wald`, change:

```html
<div id="mobielmenu" aria-hidden="true">
```

to:

```html
<div id="mobielmenu" role="dialog" aria-modal="true" aria-label="Menu" aria-hidden="true">
```

- [ ] **Step 4: Add focus-trap logic to `toggleMenu()`**

In `marketing/src/assets/js/site.js`, replace the existing `toggleMenu`
function:

```js
function toggleMenu(open){
  const menu = document.getElementById('mobielmenu');
  menu.classList.toggle('open', open);
  menu.setAttribute('aria-hidden', String(!open));
}
```

with:

```js
let vorigeFocusVoorMenu = null;

function toggleMenu(open){
  const menu = document.getElementById('mobielmenu');
  menu.classList.toggle('open', open);
  menu.setAttribute('aria-hidden', String(!open));
  if (open){
    vorigeFocusVoorMenu = document.activeElement;
    const sluitknop = menu.querySelector('.sluit');
    if (sluitknop) sluitknop.focus();
    document.addEventListener('keydown', vangFocusInMenu);
  } else {
    document.removeEventListener('keydown', vangFocusInMenu);
    if (vorigeFocusVoorMenu && typeof vorigeFocusVoorMenu.focus === 'function') vorigeFocusVoorMenu.focus();
  }
}

function vangFocusInMenu(e){
  if (e.key === 'Escape'){
    toggleMenu(false);
    return;
  }
  if (e.key !== 'Tab') return;
  const menu = document.getElementById('mobielmenu');
  const focusbaar = Array.from(menu.querySelectorAll('a, button'));
  if (focusbaar.length === 0) return;
  const eerste = focusbaar[0];
  const laatste = focusbaar[focusbaar.length - 1];
  if (e.shiftKey && document.activeElement === eerste){
    e.preventDefault();
    laatste.focus();
  } else if (!e.shiftKey && document.activeElement === laatste){
    e.preventDefault();
    eerste.focus();
  }
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd marketing && pnpm build && ./node_modules/.bin/vitest run src/smoke.test.ts`
Expected: PASS.

- [ ] **Step 6: Manual real-browser verification of the focus trap**

Write a small one-off script using `puppeteer-core` pointed at a real
installed Chrome (this repo has done this before this session — check for
an existing helper/pattern before writing a new one from scratch) that:
1. Launches headless Chrome, navigates to the local built `dist/index.html`
   (serve it, e.g. `npx serve dist` or `wald preview`, don't open the file
   directly — relative asset paths need a real server).
2. Clicks the hamburger button (`.hamburger`).
3. Asserts `document.activeElement` is now the `.sluit` button.
4. Simulates pressing `Tab` repeatedly and confirms focus cycles only
   among the menu's own links/buttons, never reaching something outside
   `#mobielmenu`.
5. Simulates pressing `Escape` and confirms the menu closes
   (`#mobielmenu` loses the `.open` class) and focus returns to the
   `.hamburger` button.

This is a manual verification step, not a committed test file, unless you
find it straightforward to fold into the existing Vitest setup with
`jsdom` — but `jsdom` does not implement real focus/Tab-order behavior
reliably, so a real-browser check is what actually proves this works, not
what a passing jsdom test would prove. Report the outcome in your summary;
don't skip this step just because the static test in Step 1 passed.

- [ ] **Step 7: Commit**

```bash
git add marketing/src/components/Nav.wald marketing/src/assets/js/site.js marketing/src/smoke.test.ts
git commit -m "marketing: give the mobile menu dialog semantics and a focus trap

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 6: Final verification + push + PR

**Files:** none (verification only)

- [ ] **Step 1: Run the full monorepo test suite**

Run (from the worktree root): `pnpm build && pnpm test`
Expected: PASS across every package.

- [ ] **Step 2: Manual checklist**

- [ ] `grep -o '<h[1-6][^>]*>' dist/waarom/index.html dist/changelog/index.html dist/changelog/roots/index.html` and eyeball each sequence — no jump greater than 1.
- [ ] `grep -c '<main id="main">' dist/index.html` is `1` for a sample of at least 3 different page types.
- [ ] Confirm the skip-link is visually hidden by default and appears when Tab-focused (can check via the CSS rule directly if a live browser check isn't convenient here — the earlier Task 5 step 6 already covered the one piece that truly needs a live browser).
- [ ] Re-confirm Task 5's focus-trap manual verification outcome is recorded/reported.

- [ ] **Step 3: Push and open a PR**

```bash
git push -u origin a11y/semantic-html-excellence
```

Open a PR against `main`. Note in the description: (1) this is sub-project
2 of 3 (sub-project 1, reduced-motion/high-contrast, is merged — PR #72;
sub-project 3, Dutch→English class renaming, comes next); (2) the two
structural heading-order fixes (Footer, changelog cards) resolve the issue
across every page type, not just the ones originally reported; (3) the
focus-trap behavior was verified with a real headless-browser check, not
just static markup, and summarize that outcome.
