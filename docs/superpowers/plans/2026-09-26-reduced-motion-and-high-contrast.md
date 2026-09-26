# Reduced Motion & High Contrast Support Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `prefers-reduced-motion` and `prefers-contrast: more` media-query support to the marketing site, without altering its existing visual identity for users who haven't requested either.

**Architecture:** One blanket CSS kill-switch rule for reduced motion (the JS side already respects the preference); targeted custom-property overrides for high contrast, reusing the codebase's existing design-token system so the boost propagates everywhere those tokens are already used.

**Spec:** `docs/superpowers/specs/2026-09-26-reduced-motion-and-high-contrast-design.md`

**Tech Stack:** WaldJS (CSS partials bundled by `marketing/scripts/build-css.js`), Vitest.

---

## Before you start

This plan assumes you're already in the isolated worktree at
`/Users/stefan/Desktop/semantique-agency/repositories/waldjs/.worktrees/a11y-motion-contrast`
on branch `a11y/reduced-motion-and-high-contrast`. If starting fresh:

```bash
git fetch origin main
git worktree add .worktrees/a11y-motion-contrast -b a11y/reduced-motion-and-high-contrast origin/main
cd .worktrees/a11y-motion-contrast
export NVM_DIR="$HOME/.nvm" && \. "$NVM_DIR/nvm.sh" && nvm use 22
pnpm install
```

Run all commands from `marketing/` inside this worktree unless noted.

**Important:** don't touch `marketing/src/assets/js/forest.js`, `animations.js`,
or `site.js` — they already correctly gate every GSAP/three.js/firefly-cursor
animation on `prefers-reduced-motion`. This plan is CSS-only.

---

### Task 1: Reduced-motion kill-switch

**Files:**
- Modify: `marketing/src/styles/partials/01-base.css`
- Modify: `marketing/src/smoke.test.ts`

- [ ] **Step 1: Write the failing test**

In `marketing/src/smoke.test.ts`, add a new `it` block inside the existing
`describe('marketing site build', ...)` (after the last existing `it` block,
before the closing `})`):

```ts
  it('bevat een prefers-reduced-motion regel die transitions/animaties uitzet', () => {
    const css = readFileSync(join(ROOT, 'dist/assets/css/site.css'), 'utf-8')
    expect(css).toContain('@media (prefers-reduced-motion: reduce)')
    expect(css).toContain('scroll-behavior:auto')
  })
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd marketing && ./node_modules/.bin/vitest run src/smoke.test.ts`
Expected: FAIL — the media query doesn't exist yet in the built CSS.

- [ ] **Step 3: Add the reduced-motion rule**

In `marketing/src/styles/partials/01-base.css`, add this block at the end
of the file (after the existing `h1, h2, h3, h4, header p.sub, .sectiekop p { text-wrap: balance }` rule):

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd marketing && pnpm build && ./node_modules/.bin/vitest run src/smoke.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add marketing/src/styles/partials/01-base.css marketing/src/smoke.test.ts
git commit -m "marketing: add prefers-reduced-motion kill-switch for CSS transitions

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: High-contrast token overrides + final verification

**Files:**
- Modify: `marketing/src/styles/partials/00-tokens.css`
- Modify: `marketing/src/styles/partials/13-benchmarks.css`
- Modify: `marketing/src/smoke.test.ts`

- [ ] **Step 1: Write the failing test**

In `marketing/src/smoke.test.ts`, add another `it` block right after the one
added in Task 1:

```ts
  it('bevat een prefers-contrast:more boost voor randen, gedempte tekst en het benchmark-label', () => {
    const css = readFileSync(join(ROOT, 'dist/assets/css/site.css'), 'utf-8')
    expect(css).toContain('@media (prefers-contrast: more)')
    expect(css).toContain('--rand:rgba(255, 255, 255, 0.4)')
    expect(css).toContain('--wit-zacht:rgba(255, 255, 255, 0.92)')
  })
```

Note: the exact whitespace of the minified custom-property declarations
depends on the CSS bundler's minifier — if this exact string doesn't match
after Step 4's build, inspect `dist/assets/css/site.css` directly (`grep -o
"prefers-contrast[^}]*}[^}]*}" dist/assets/css/site.css`) and adjust the
assertion to match the bundler's actual minified output rather than
guessing further.

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd marketing && ./node_modules/.bin/vitest run src/smoke.test.ts`
Expected: FAIL — the media query doesn't exist yet.

- [ ] **Step 3: Add the high-contrast token overrides**

In `marketing/src/styles/partials/00-tokens.css`, add this block after the
closing `}` of the existing `:root { ... }` block (i.e. as a new top-level
block at the end of the file):

```css
@media (prefers-contrast: more) {
  :root {
    --rand: rgba(255, 255, 255, 0.4);
    --wit-zacht: rgba(255, 255, 255, 0.92)
  }
}
```

- [ ] **Step 4: Add the scoped benchmark-label override**

In `marketing/src/styles/partials/13-benchmarks.css`, right after the
existing `.staaf.wald .label b { color: #FF6676 }` rule, add:

```css
@media (prefers-contrast: more) {
  .staaf.wald .label b {
    color: var(--wit)
  }
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd marketing && pnpm build && ./node_modules/.bin/vitest run src/smoke.test.ts`
Expected: PASS — if the exact minified-string assertion from Step 1 doesn't
match, fix the assertion (per the note in Step 1), not the CSS.

- [ ] **Step 6: Run the full test suite**

Run (from the repo root): `pnpm build && pnpm test`
Expected: PASS across every package — this change only touches CSS, so
nothing outside the marketing package should be affected.

- [ ] **Step 7: Manual sanity check**

Run: `grep -c "prefers-reduced-motion\|prefers-contrast" marketing/dist/assets/css/site.css`
Expected: `2` (one occurrence of each media query in the bundled output).

- [ ] **Step 8: Commit**

```bash
git add marketing/src/styles/partials/00-tokens.css marketing/src/styles/partials/13-benchmarks.css marketing/src/smoke.test.ts
git commit -m "marketing: add prefers-contrast:more token overrides

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

- [ ] **Step 9: Push and open a PR**

```bash
git push -u origin a11y/reduced-motion-and-high-contrast
```

Open a PR against `main`. Note in the description: (1) this is sub-project
1 of 3 in a broader accessibility/semantics/i18n-naming effort (semantic
HTML fixes and Dutch→English class renaming follow separately); (2) the
JS-side reduced-motion handling (GSAP/three.js/firefly cursor) was already
correct before this PR — this only closes the pure-CSS gap; (3) the
high-contrast change is a deliberate targeted token boost, not a new theme.
