# Marketing Site — Defer Render-Blocking Scripts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate render-blocking script execution on the WaldJS marketing site by adding `defer` to all six external `<script src>` tags, with zero behavior change.

**Architecture:** All six scripts (`three.min.js`, `gsap.min.js`, `ScrollTrigger.min.js` in `<head>`; `site.js`, `forest.js`, `animations.js` at the end of `<body>`) get `defer` together, preserving their relative execution order (which today only works because the `<head>` ones run synchronously before the parser reaches the body-end ones). The inline language-detection script stays blocking on purpose.

**Spec:** `docs/superpowers/specs/2026-09-23-marketing-performance-defer-scripts-design.md`

**Tech Stack:** Plain HTML attribute change, Vitest for the regression test.

---

## Before you start

This plan assumes you're already in the isolated worktree at
`/Users/stefan/Desktop/semantique-agency/repositories/waldjs/.worktrees/marketing-perf-defer`
on branch `feat/marketing-perf-defer-scripts`, which is stacked on top of the
not-yet-merged `feat/marketing-seo-technical-basics` branch (PR #61) — this
branch already has that PR's `canonical`/`og:image`/JSON-LD/`robots.txt`/
`sitemap.xml` changes. If starting fresh:

```bash
git fetch origin main
git fetch origin feat/marketing-seo-technical-basics
git worktree add .worktrees/marketing-perf-defer -b feat/marketing-perf-defer-scripts origin/feat/marketing-seo-technical-basics
cd .worktrees/marketing-perf-defer
export NVM_DIR="$HOME/.nvm" && \. "$NVM_DIR/nvm.sh" && nvm use 22
pnpm install
pnpm build
```

Run all commands from `marketing/` inside this worktree unless a step says
otherwise. Use `./node_modules/.bin/vitest` (not `../node_modules/.bin/vitest`
— that path doesn't exist, a mistake from an earlier plan in this series).

---

### Task 1: Add `defer` to all six render-blocking scripts

**Files:**
- Modify: `marketing/src/pages/index.wald`
- Modify: `marketing/src/smoke.test.ts`

- [ ] **Step 1: Write the failing test**

In `marketing/src/smoke.test.ts`, add a new `it` block inside the existing
`describe('marketing site build', ...)` (after the last existing `it` block,
before the closing `})`):

```ts
  it('laadt alle externe scripts met defer, behalve de inline taal-bootstrap', () => {
    const html = readFileSync(join(ROOT, 'dist/index.html'), 'utf-8')
    for (const src of [
      'three.min.js',
      'gsap.min.js',
      'ScrollTrigger.min.js',
      '/assets/js/site.js',
      '/assets/js/forest.js',
      '/assets/js/animations.js',
    ]) {
      const match = html.match(new RegExp(`<script[^>]*src="[^"]*${src.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[^>]*>`))
      expect(match, `script tag for ${src} not found`).not.toBeNull()
      expect(match![0], `${src} should have defer`).toContain('defer')
    }

    const inlineLangScript = html.match(/<script data-wald-no-hoist[^>]*>/)
    expect(inlineLangScript).not.toBeNull()
    expect(inlineLangScript![0]).not.toContain('defer')
  })
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd marketing && ./node_modules/.bin/vitest run src/smoke.test.ts`
Expected: FAIL — the new `it` block's assertions fail because none of the
six `<script src>` tags have `defer` yet (the other, pre-existing tests in
this file should still pass).

- [ ] **Step 3: Add `defer` to the three `<head>` scripts**

In `marketing/src/pages/index.wald`, change:

```html
<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/ScrollTrigger.min.js"></script>
```

to:

```html
<script defer src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
<script defer src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js"></script>
<script defer src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/ScrollTrigger.min.js"></script>
```

- [ ] **Step 4: Add `defer` to the three `<body>`-end scripts**

In the same file, change:

```html
<script src="/assets/js/site.js"></script>
<script src="/assets/js/forest.js"></script>
<script src="/assets/js/animations.js"></script>
```

to:

```html
<script defer src="/assets/js/site.js"></script>
<script defer src="/assets/js/forest.js"></script>
<script defer src="/assets/js/animations.js"></script>
```

Do NOT add `defer` to the inline `<script data-wald-no-hoist>...</script>`
language-detection script (a few lines earlier in `<head>`) — that one must
stay blocking on purpose (see the design doc's "What stays as-is" section).

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd marketing && ./node_modules/.bin/vitest run src/smoke.test.ts`
Expected: PASS — all tests, including the new one.

- [ ] **Step 6: Manually confirm the visual behavior is unchanged**

This can't be fully automated (Vitest confirms the HTML output is correct,
not that the browser actually renders the same way) — but you can get strong
confidence without a real browser: `defer` scripts execute in document
order, all before `DOMContentLoaded`, which is functionally equivalent to
today's synchronous execution order for this specific case (see the design
doc's explanation of why order is preserved). Confirm this reasoning holds by
re-reading `marketing/src/assets/js/forest.js`'s guard clause (`if (!canvas
|| typeof THREE === 'undefined') return;`) and confirming nothing else in
`site.js`/`animations.js`/`forest.js` assumes scripts ran *during* parsing
rather than after it (e.g. no code that expects `document.readyState` to be
`'loading'`, no assumption about running before other deferred content
loads). If you want an even higher-confidence check and have a way to render
the built `dist/index.html` (e.g. open it directly in a browser, or use
`npx serve dist` and open `http://localhost:PORT`), do that and confirm the
3D forest background and scroll animations still work — but this is optional
given the test above already locks in the correct HTML output; note clearly
in your report whether you did this or not.

- [ ] **Step 7: Rebuild and spot-check the output**

Run: `cd marketing && pnpm build`
Expected: no errors.
```bash
grep -o '<script[^>]*src="[^"]*\(three\.min\|gsap\.min\|ScrollTrigger\.min\|site\.js\|forest\.js\|animations\.js\)[^"]*"[^>]*>' dist/index.html
```
All six lines printed should contain `defer`.

- [ ] **Step 8: Commit**

```bash
git add marketing/src/pages/index.wald marketing/src/smoke.test.ts
git commit -m "marketing: defer render-blocking three.js/GSAP/site scripts"
```

- [ ] **Step 9: Run the full verification pass**

Run (from the repo root): `pnpm build && pnpm test`
Expected: PASS across every package.

- [ ] **Step 10: Push and open a PR**

```bash
git push -u origin feat/marketing-perf-defer-scripts
```

Open a PR against `main` — note in the description that this branch is
stacked on top of the not-yet-merged `feat/marketing-seo-technical-basics`
(PR #61), so its diff will include that PR's changes until #61 merges; once
#61 merges, rebase this branch onto `main` and the diff will narrow to just
this task's change.
