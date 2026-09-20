# Base-Aware Component Styles + Canopy Regression Test Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the injected `wald-components.css` stylesheet link (and `wald grow`'s route serving it) respect `config.base`, and add a regression test proving a component using both `<style>` and `canopy:*` keeps its scope attribute — closing issue [#41](https://github.com/Stefan-Espant/WaldJS/issues/41).

**Architecture:** One new shared function, `componentStylesHref(base)`, replaces two independent hardcoded `/assets/wald-components.css` literals (one in the injected `<link>`, one in `wald grow`'s route match) — the actual bug was that those two copies could drift out of sync; a single shared computation makes that structurally impossible going forward.

**Tech Stack:** TypeScript, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-08-base-aware-component-styles-design.md`

---

## Before you start

This plan assumes you're already in the isolated worktree at `/Users/stefan/Desktop/semantique-agency/repositories/waldjs/.worktrees/feat-issue-41-base-path` on branch `feat/issue-41-base-path`, with dependencies installed and the workspace built. If starting fresh, from the repo root:

```bash
git fetch origin main
git worktree add .worktrees/feat-issue-41-base-path -b feat/issue-41-base-path origin/main
cd .worktrees/feat-issue-41-base-path
pnpm install --frozen-lockfile
pnpm -r build
```

All tasks below assume the working directory is this worktree.

---

### Task 1: `component-styles.ts` — the shared, base-aware path function

**Files:**
- Modify: `packages/cli/src/canopy-build.ts`
- Modify: `packages/cli/src/component-styles.ts`
- Modify: `packages/cli/src/component-styles.test.ts`

- [ ] **Step 1: Write the failing tests**

In `packages/cli/src/component-styles.test.ts`, change the import line:

```ts
import { injectComponentStyles, needsComponentStyles } from './component-styles.js'
```

to:

```ts
import { componentStylesHref, injectComponentStyles, needsComponentStyles } from './component-styles.js'
```

Add this new `describe` block (anywhere in the file, e.g. right after the `needsComponentStyles` block):

```ts
describe('componentStylesHref', () => {
  it('returns the root-relative path under the default base', () => {
    expect(componentStylesHref('/')).toBe('/assets/wald-components.css')
  })

  it('joins a non-root base', () => {
    expect(componentStylesHref('/my-forest/')).toBe('/my-forest/assets/wald-components.css')
  })
})
```

Add this test inside the existing `describe('injectComponentStyles', ...)` block, alongside the other two:

```ts
  it('builds the link from a non-default base', () => {
    const html = '<html><head></head><body><div data-wald-ab12cd34>Hi</div></body></html>'
    const result = injectComponentStyles(html, '/my-forest/')
    expect(result).toContain('<link rel="stylesheet" href="/my-forest/assets/wald-components.css">')
  })
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @waldjs/cli exec vitest run component-styles.test.ts`
Expected: FAIL — `componentStylesHref` doesn't exist yet, and `injectComponentStyles` doesn't accept a second argument.

- [ ] **Step 3: Implement**

1. In `packages/cli/src/canopy-build.ts`, change:

```ts
function joinUrl(base: string, fileName: string): string {
  return `${base.replace(/\/$/, '')}/${fileName}`
}
```

to:

```ts
export function joinUrl(base: string, fileName: string): string {
  return `${base.replace(/\/$/, '')}/${fileName}`
}
```

(Only the `function` → `export function` keyword changes. Nothing else in `canopy-build.ts` changes — it's still used internally there exactly as before.)

2. Replace the full contents of `packages/cli/src/component-styles.ts` with:

```ts
import { joinUrl } from './canopy-build.js'

// Mirrors the `NO_HOIST_ATTR` pattern in shell.ts and the `wald:prefetch`
// detection in prefetch-runtime.ts: rather than tracking which pages use
// which components, just check the rendered HTML for the marker a styled
// component's own scoping already leaves behind.
const SCOPE_ATTR_PATTERN = /\sdata-wald-[0-9a-f]{8}(?=[\s=/>])/

export function needsComponentStyles(html: string): boolean {
  return SCOPE_ATTR_PATTERN.test(html)
}

// The one place the component-styles bundle's URL is computed — used both
// to build the injected <link> below and by wald grow's dev-server route
// for that same bundle (see grow.ts), so the two can never drift out of
// sync with each other or with config.base the way they used to.
export function componentStylesHref(base: string): string {
  return joinUrl(base, 'assets/wald-components.css')
}

export function injectComponentStyles(html: string, base = '/'): string {
  if (!needsComponentStyles(html)) return html
  const link = `<link rel="stylesheet" href="${componentStylesHref(base)}">`
  return html.includes('</head>') ? html.replace('</head>', `${link}\n</head>`) : html + link
}
```

(`base = '/'` defaults so every existing call site that doesn't pass one — including the two pre-existing tests in this same file — keeps compiling and passing unchanged: `componentStylesHref('/')` produces the exact same `/assets/wald-components.css` string the old hardcoded version always did.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @waldjs/cli exec vitest run component-styles.test.ts`
Expected: PASS (all 7 tests: 2 pre-existing `needsComponentStyles` + 2 new `componentStylesHref` + 3 `injectComponentStyles`, 2 pre-existing + 1 new).

- [ ] **Step 5: Commit**

```bash
git add packages/cli/src/canopy-build.ts packages/cli/src/component-styles.ts packages/cli/src/component-styles.test.ts
git commit -m "cli: add base-aware componentStylesHref, export joinUrl"
```

---

### Task 2: Wire the base-aware path into `wald grow`

**Files:**
- Modify: `packages/cli/src/commands/grow.ts`
- Test: `packages/cli/src/commands/grow.test.ts`

- [ ] **Step 1: Write the failing test**

In `packages/cli/src/commands/grow.test.ts`, add this test right after the existing `'does not inject the component-styles link for a page with no styled components'` test (inside the same `describe('handleRequest', ...)` block):

```ts
  it('injects a base-prefixed component-styles link when a non-default base is passed', async () => {
    const routes = [{ pattern: '/about', file: '/pages/about.wald', params: [] }]
    const fakeVite = {
      ssrLoadModule: async (_file: string) => ({
        default: { render: async () => '<div class="card" data-wald-ab12cd34>Hi</div>' },
      }),
    }

    const result = await handleRequest(routes, '/about', fakeVite as any, '/my-forest/')
    expect(result.body).toContain('<link rel="stylesheet" href="/my-forest/assets/wald-components.css">')
  })
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @waldjs/cli exec vitest run grow.test.ts`
Expected: FAIL — `handleRequest` ignores the 4th argument, still injects the root-relative link.

- [ ] **Step 3: Implement**

In `packages/cli/src/commands/grow.ts`:

1. Change the import line:

```ts
import { injectComponentStyles } from '../component-styles.js'
```

to:

```ts
import { injectComponentStyles, componentStylesHref } from '../component-styles.js'
```

2. Update `handleRequest`'s signature and injection call:

```ts
export async function handleRequest(
  routes: Route[],
  url: string,
  vite: ViteLike | undefined,
  base = '/'
): Promise<{ status: number; body: string }> {
  const match = matchRoute(routes, url)
  if (!match) return { status: 404, body: 'Page not found' }

  const mod = await vite!.ssrLoadModule(match.route.file)
  const html = await mod.default.render(match.params)
  let body = injectComponentStyles(injectPrefetchRuntime(hoistScripts(maybeWrap(html))), base)
  if (vite!.transformIndexHtml) {
    body = await vite!.transformIndexHtml(url, body)
  }
  return { status: 200, body }
}
```

3. In `growCommand`'s `run()`, right after `const config = await loadWaldConfig(cwd)`, add:

```ts
    const config = await loadWaldConfig(cwd)
    const componentStylesPath = componentStylesHref(config.base)
    const start = Date.now()
```

(Only the `const componentStylesPath = componentStylesHref(config.base)` line is new, inserted between the existing `const config = ...` and `const start = ...` lines.)

4. Change the route-matching branch from a literal string comparison to comparing against the computed path:

```ts
      if (url === componentStylesPath) {
        res.writeHead(200, { 'Content-Type': 'text/css' })
        res.end(collectComponentStyles(srcDir))
        return
      }
```

(Only the condition changes, from `url === '/assets/wald-components.css'` to `url === componentStylesPath`. The body of the branch is unchanged.)

5. Update the `handleRequest` call site to pass the base:

```ts
          const { status, body } = await handleRequest(routes, url, vite as unknown as ViteLike, config.base)
```

(Only this one line changes — adding `, config.base` as the 4th argument. Everything else in that `try` block is unchanged.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @waldjs/cli exec vitest run grow.test.ts`
Expected: PASS (all tests in the file, including the pre-existing ones — they don't pass a 4th argument, so `base` defaults to `'/'` and their expected `/assets/wald-components.css` links are unaffected).

- [ ] **Step 5: Commit**

```bash
git add packages/cli/src/commands/grow.ts packages/cli/src/commands/grow.test.ts
git commit -m "cli: make wald grow's component-styles route and injected link base-aware"
```

---

### Task 3: Wire the base-aware path into `wald build`

**Files:**
- Modify: `packages/cli/src/commands/build.ts`
- Test: `packages/cli/src/commands/build.test.ts`

- [ ] **Step 1: Write the failing test**

Add this test to `packages/cli/src/commands/build.test.ts`, inside `describe('buildPages', ...)`, near the other component-styles tests from #25 (search for `'bundles scoped component styles'`):

```ts
  it('links the component-styles bundle with a base-prefixed href under a non-root base', async () => {
    const pagesDir = join(tmpDir, 'src', 'pages')
    const componentsDir = join(tmpDir, 'src', 'components')
    const distDir = join(tmpDir, 'dist')
    mkdirSync(pagesDir, { recursive: true })
    mkdirSync(componentsDir, { recursive: true })
    writeFileSync(
      join(componentsDir, 'Card.wald'),
      '---\n---\n<div class="card">Hi</div>\n<style>.card { color: red }</style>',
    )
    writeFileSync(
      join(pagesDir, 'index.wald'),
      "---\nimport Card from '../components/Card.wald'\n---\n<Card />",
    )

    await buildPages(pagesDir, { ...makeConfig(distDir), base: '/my-forest/' })

    const html = readFileSync(join(distDir, 'index.html'), 'utf8')
    expect(html).toContain('<link rel="stylesheet" href="/my-forest/assets/wald-components.css">')

    // The physical bundle file's location on disk is unaffected by base —
    // only how it's *referenced* from HTML changes, same as every other
    // build asset (canopy chunks, images, etc.).
    expect(existsSync(join(distDir, 'assets', 'wald-components.css'))).toBe(true)
  })
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @waldjs/cli exec vitest run build.test.ts`
Expected: FAIL — the new test's `<link>` assertion fails (still gets the root-relative `/assets/wald-components.css` href).

- [ ] **Step 3: Implement**

In `packages/cli/src/commands/build.ts`, change both html-assembly lines from:

```ts
      const html = injectComponentStyles(injectPrefetchRuntime(applyCanopyAssets(hoistScripts(maybeWrap(rendered)), canopyAssets)))
```

to:

```ts
      const html = injectComponentStyles(injectPrefetchRuntime(applyCanopyAssets(hoistScripts(maybeWrap(rendered)), canopyAssets)), config.base)
```

(This line appears twice — once in the static-routes rendering loop, once in the dynamic-routes rendering loop. Apply the identical change to both. No import changes needed — `injectComponentStyles` is already imported in this file from Task 10 of the previous plan.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @waldjs/cli exec vitest run build.test.ts`
Expected: PASS (all tests in the file, including every pre-existing test — they all use `makeConfig`'s default `base: '/'`, so `componentStylesHref('/')` produces the same `/assets/wald-components.css` they already expect).

- [ ] **Step 5: Commit**

```bash
git add packages/cli/src/commands/build.ts packages/cli/src/commands/build.test.ts
git commit -m "cli: make wald build's component-styles link base-aware"
```

---

### Task 4: Canopy + scoped-CSS regression test

**Files:**
- Test: `packages/cli/src/commands/build.test.ts`

No production code changes in this task — purely a regression test confirming behavior that's already correct (verified during #25's final review by tracing `canopy/src/index.ts` and `renderComponent`).

- [ ] **Step 1: Write the test**

Add this test to `packages/cli/src/commands/build.test.ts`, inside `describe('buildPages', ...)`, near the other canopy tests (search for `'replaces canopy placeholder data-src'`):

```ts
  it('keeps the scope attribute on a component that also uses canopy:load', async () => {
    const pagesDir = join(tmpDir, 'src', 'pages')
    const componentsDir = join(tmpDir, 'src', 'components')
    const distDir = join(tmpDir, 'dist')
    mkdirSync(pagesDir, { recursive: true })
    mkdirSync(componentsDir, { recursive: true })

    writeFileSync(
      join(componentsDir, 'Counter.wald'),
      [
        '---',
        'const { initial } = $$props',
        '---',
        '<button class="counter">{initial}</button>',
        '<script>export default function(root) { root.dataset.ready = "yes" }</script>',
        '<style>.counter { color: red }</style>',
      ].join('\n')
    )

    writeFileSync(
      join(pagesDir, 'index.wald'),
      ["---", "import Counter from '../components/Counter.wald'", '---', '<Counter canopy:load initial={3} />'].join('\n')
    )

    await buildPages(pagesDir, makeConfig(distDir))

    const html = readFileSync(join(distDir, 'index.html'), 'utf8')
    expect(html).toMatch(/<wald-canopy[\s\S]*?<button class="counter" data-wald-[0-9a-f]{8}>3<\/button>/)
    expect(html).toContain('<link rel="stylesheet" href="/assets/wald-components.css">')

    const css = readFileSync(join(distDir, 'assets', 'wald-components.css'), 'utf8')
    expect(css).toMatch(/\.counter\[data-wald-[0-9a-f]{8}\]\{ color: red \}/)
  })
```

- [ ] **Step 2: Run the test**

Run: `pnpm --filter @waldjs/cli exec vitest run build.test.ts`
Expected: PASS — this confirms existing behavior, it isn't expected to fail first. If it does fail, STOP and report BLOCKED rather than changing production code to force it to pass — that would mean the design's "no special handling needed" claim was wrong, which needs a human decision, not a quick fix.

- [ ] **Step 3: Commit**

```bash
git add packages/cli/src/commands/build.test.ts
git commit -m "cli: add regression test for scoped CSS + canopy:load on the same component"
```

---

### Task 5: Changeset, verification, and PR

**Files:**
- Create: `.changeset/wald-base-aware-component-styles.md`

- [ ] **Step 1: Full workspace verification**

Run: `pnpm --filter @waldjs/cli exec vitest run`
Expected: PASS — every test in the package (169 pre-existing + 7 new = 176).

Run: `pnpm --filter @waldjs/cli exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 2: Write the changeset**

Create `.changeset/wald-base-aware-component-styles.md`:

```md
---
"@waldjs/cli": patch
---

Fix the scoped-component-CSS stylesheet link (`/assets/wald-components.css`) to respect `config.base` in both `wald build` output and `wald grow`'s dev-server route — previously hardcoded to the root path, it 404'd under a non-default `base` (e.g. a GitHub Pages project page). Also adds a regression test confirming a component using both `<style>` and `canopy:*` keeps its scope attribute.
```

(`patch`, not `minor` — this is a bugfix to already-shipped #25 behavior, not new functionality.)

- [ ] **Step 3: Commit**

```bash
git add .changeset/wald-base-aware-component-styles.md
git commit -m "Add changeset for base-aware component styles fix"
```

- [ ] **Step 4: Push the branch and open the PR**

```bash
git push -u origin feat/issue-41-base-path
```

```bash
gh pr create --repo Stefan-Espant/WaldJS \
  --title "Fix scoped-CSS link to respect config.base (#41)" \
  --body "Closes #41.

Root cause: the injected \`<link>\` href and \`wald grow\`'s dev-server route each hardcoded their own separate copy of \`/assets/wald-components.css\`, neither base-aware, with nothing keeping them in sync with each other or with \`config.base\`.

Fix: one shared \`componentStylesHref(base)\` (built on \`canopy-build.ts\`'s existing \`joinUrl\`, now exported) — both \`injectComponentStyles()\` and \`wald grow\`'s route match call it, so there's only one implementation left to drift.

Also adds a regression test confirming a component using both \`<style>\` and \`canopy:load\` keeps its scope attribute in the final HTML (the design's 'no special handling needed' claim, verified but previously untested).

See docs/superpowers/specs/2026-09-08-base-aware-component-styles-design.md for the full design.

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```

- [ ] **Step 5: Report the PR URL back to the user.**

---

## Plan self-review notes

- **Spec coverage:** the shared `componentStylesHref` function, both call sites (grow + build), the "test the real route by testing the shared logic it calls" reasoning, and the canopy+style regression test are each covered by a task above.
- **Placeholder scan:** none found.
- **Type consistency:** `componentStylesHref` (Task 1) is the exact name imported and called in Task 2 (`grow.ts`) and referenced conceptually in Task 3 (`build.ts` doesn't call it directly — `injectComponentStyles` calls it internally — confirmed this is correct: `build.ts` only ever calls `injectComponentStyles(html, config.base)`, never `componentStylesHref` itself, matching how the pre-existing code already only imports `injectComponentStyles`). `joinUrl` (exported in Task 1) is the exact name imported in `component-styles.ts`.
