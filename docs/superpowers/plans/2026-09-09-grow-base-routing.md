# wald grow Base-Aware Page Routing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `wald grow`'s page routing respect `config.base`, closing issue [#45](https://github.com/Stefan-Espant/WaldJS/issues/45).

**Architecture:** A new exported `stripBase(url, base)` in `packages/cli/src/commands/grow.ts` strips `config.base` from the incoming request URL before route matching; `handleRequest` gains an optional `routePath` parameter (defaulting to `url`, so every existing call site is unaffected) used for matching, while the original `url` still goes to `vite.transformIndexHtml`.

**Tech Stack:** TypeScript, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-09-grow-base-routing-design.md`

---

## Before you start

This plan assumes you're already in the isolated worktree at `/Users/stefan/Desktop/semantique-agency/repositories/waldjs/.worktrees/feat-issue-45-grow-base-routing` on branch `feat/issue-45-grow-base-routing`, with dependencies installed and the workspace built. If starting fresh, from the repo root:

```bash
git fetch origin main
git worktree add .worktrees/feat-issue-45-grow-base-routing -b feat/issue-45-grow-base-routing origin/main
cd .worktrees/feat-issue-45-grow-base-routing
pnpm install --frozen-lockfile
pnpm -r build
```

All tasks below assume the working directory is this worktree.

**Important context for whoever implements this:** the previous issue in this series (#41, also touching `grow.ts`'s base-handling) shipped a bug that every unit test missed and was only caught by a live server + real HTTP requests during a final review. Task 2 of this plan requires an actual live-server verification, not just passing unit tests, before this is considered done — do not skip it or treat it as optional.

---

### Task 1: `stripBase` + wire into `wald grow`

**Files:**
- Modify: `packages/cli/src/commands/grow.ts`
- Test: `packages/cli/src/commands/grow.test.ts`

- [ ] **Step 1: Write the failing tests**

In `packages/cli/src/commands/grow.test.ts`, change the import line:

```ts
import { handleRequest } from './grow.js'
```

to:

```ts
import { handleRequest, stripBase } from './grow.js'
```

Add this new `describe` block (anywhere in the file, e.g. right after the imports, before `describe('handleRequest', ...)`):

```ts
describe('stripBase', () => {
  it('passes the url through unchanged for the root base', () => {
    expect(stripBase('/about', '/')).toBe('/about')
  })

  it('strips a non-root base from a prefixed path', () => {
    expect(stripBase('/my-forest/about', '/my-forest/')).toBe('/about')
  })

  it('resolves the base root itself to /', () => {
    expect(stripBase('/my-forest/', '/my-forest/')).toBe('/')
  })

  it('resolves the base root without a trailing slash to /', () => {
    expect(stripBase('/my-forest', '/my-forest/')).toBe('/')
  })

  it('works the same whether base is configured with or without a trailing slash', () => {
    expect(stripBase('/my-forest/about', '/my-forest')).toBe('/about')
  })

  it('preserves a query string after stripping', () => {
    expect(stripBase('/my-forest/about?x=1', '/my-forest/')).toBe('/about?x=1')
  })

  it('returns null for a request that does not start with the configured base', () => {
    expect(stripBase('/about', '/my-forest/')).toBeNull()
  })

  it('does not false-match a path that only shares a text prefix with base', () => {
    expect(stripBase('/my-forest-extra/about', '/my-forest/')).toBeNull()
  })
})
```

Add this test inside the existing `describe('handleRequest', ...)` block, after the last test (`'leaves the component-styles link root-relative...'`):

```ts
  it('matches the route using a base-stripped routePath while still passing the real url to transformIndexHtml', async () => {
    const routes = [{ pattern: '/about', file: '/pages/about.wald', params: [] }]
    const capturedUrls: string[] = []
    const fakeVite = {
      ssrLoadModule: async (_file: string) => ({
        default: { render: async () => '<p>About</p>' },
      }),
      transformIndexHtml: async (url: string, html: string) => {
        capturedUrls.push(url)
        return html
      },
    }

    const result = await handleRequest(routes, '/my-forest/about', fakeVite as any, '/about')
    expect(result.status).toBe(200)
    expect(result.body).toContain('<p>About</p>')
    expect(capturedUrls[0]).toBe('/my-forest/about')
  })
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @waldjs/cli exec vitest run grow.test.ts`
Expected: FAIL — `stripBase` doesn't exist yet, and `handleRequest` ignores a 4th argument (still matches on `url` directly, so passing a `routePath` that doesn't match the pattern by itself does nothing different from today — the new test fails because `/my-forest/about` doesn't match `/about`'s pattern without stripping).

- [ ] **Step 3: Implement**

In `packages/cli/src/commands/grow.ts`:

1. Add `stripBase`, placed right after the `ViteLike` type definition and before `printGrowReady`:

```ts
// Strips config.base from an incoming request URL before route matching —
// wald grow's own routing (unlike Vite's own dev-server middleware, which
// already handles base correctly) otherwise has no idea a non-default base
// is configured, so a browser's base-prefixed request never matches any
// route. Returns null (not the unchanged url) when the request doesn't
// start with the configured base at all, so the caller can 404 it instead
// of accidentally matching against a still-prefixed path.
export function stripBase(url: string, base: string): string | null {
  const queryIndex = url.indexOf('?')
  const pathname = queryIndex === -1 ? url : url.slice(0, queryIndex)
  const query = queryIndex === -1 ? '' : url.slice(queryIndex)

  const normalizedBase = base.replace(/\/$/, '')
  if (normalizedBase === '') return url
  if (pathname === normalizedBase) return '/' + query
  if (pathname.startsWith(normalizedBase + '/')) return pathname.slice(normalizedBase.length) + query
  return null
}
```

2. Update `handleRequest`'s signature and match call:

```ts
export async function handleRequest(
  routes: Route[],
  url: string,
  vite: ViteLike | undefined,
  routePath = url
): Promise<{ status: number; body: string }> {
  const match = matchRoute(routes, routePath)
  if (!match) return { status: 404, body: 'Page not found' }

  const mod = await vite!.ssrLoadModule(match.route.file)
  const html = await mod.default.render(match.params)
  // Deliberately NOT passing config.base here: injectComponentStyles's link
  // stays root-relative, and vite.transformIndexHtml() below already
  // base-prefixes every root-relative href/src in the page exactly once
  // (the same way it already handles the Vite HMR client and everything
  // else) — baking base in here too would double-prefix it.
  let body = injectComponentStyles(injectPrefetchRuntime(hoistScripts(maybeWrap(html))))
  if (vite!.transformIndexHtml) {
    body = await vite!.transformIndexHtml(url, body)
  }
  return { status: 200, body }
}
```

(Only the added `routePath = url` parameter and the `matchRoute(routes, routePath)` line change — everything else in the function, including the pre-existing comment about `injectComponentStyles`, is unchanged.)

3. In `growCommand`'s `run()`, update the routing decision from:

```ts
        const routes = scanRoutes(pagesDir)
        const match = matchRoute(routes, url)

        if (!match) {
          vite.middlewares(req, res, () => {
            if (!res.headersSent && !res.writableEnded) {
              res.writeHead(404, { 'Content-Type': 'text/plain' })
              res.end('Page not found')
            }
          })
          return
        }

        try {
          const { status, body } = await handleRequest(routes, url, vite as unknown as ViteLike)
```

to:

```ts
        const routes = scanRoutes(pagesDir)
        const routePath = stripBase(url, config.base)
        const match = routePath !== null ? matchRoute(routes, routePath) : null

        if (!match) {
          vite.middlewares(req, res, () => {
            if (!res.headersSent && !res.writableEnded) {
              res.writeHead(404, { 'Content-Type': 'text/plain' })
              res.end('Page not found')
            }
          })
          return
        }

        try {
          const { status, body } = await handleRequest(routes, url, vite as unknown as ViteLike, routePath!)
```

(The `routePath!` non-null assertion is safe and consistent with this file's existing style — `match` is only non-null when `routePath` was non-null, by construction of the line above it. Everything else in this block, including the `catch` clause below it, is unchanged.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @waldjs/cli exec vitest run grow.test.ts`
Expected: PASS (all tests in the file, including every pre-existing one — they don't pass a 4th argument, so `routePath` defaults to `url` and behaves exactly as before).

- [ ] **Step 5: Commit**

```bash
git add packages/cli/src/commands/grow.ts packages/cli/src/commands/grow.test.ts
git commit -m "cli: make wald grow's page routing base-aware"
```

---

### Task 2: Live verification, changeset, and PR

**Files:**
- Create: `.changeset/wald-grow-base-routing.md`

- [ ] **Step 1: Full workspace verification**

Run: `pnpm --filter @waldjs/cli exec vitest run`
Expected: PASS — every test in the package.

Run: `pnpm --filter @waldjs/cli exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 2: Live server verification — REQUIRED, do not skip**

Rebuild the CLI so the fix is in the built output the live server actually runs:

```bash
pnpm -r build
```

Scaffold a scratch project outside the repo (e.g. `/tmp/wald-grow-base-check`) with:
- `wald.config.ts`: `export default { base: '/my-forest/' }` (a plain object — avoid importing `@waldjs/cli`'s `defineConfig` in a scratch project with no `node_modules`, since `defineConfig` is a no-op identity function anyway).
- `src/pages/index.wald`: any simple page.
- `src/pages/about.wald`: a second page, to verify a non-root route too.

Start `wald grow` against it using this worktree's built CLI directly:

```bash
node /Users/stefan/Desktop/semantique-agency/repositories/waldjs/.worktrees/feat-issue-45-grow-base-routing/packages/cli/bin/wald.js grow
```

(Run it in the background/a separate terminal — it doesn't exit on its own.)

With the server running, verify with real HTTP requests (`curl`):
- `GET http://localhost:7233/my-forest/` → expect `200`, the actual page content (not a 404).
- `GET http://localhost:7233/my-forest/about` → expect `200`, the about page's content.
- `GET http://localhost:7233/about` (unprefixed, under a non-default base) → expect `404` (confirms the "doesn't silently still match" acceptance criterion).
- `GET http://localhost:7233/my-forest/nonexistent-page` → expect `404` (a real unmatched route, correctly still 404s, not silently matching or crashing).

Stop the server and delete the scratch project when done. Report the exact `curl` output for each of the four checks above — a status code alone is not sufficient evidence, include the actual response body/headers you observed.

If any of these checks fail, STOP and report BLOCKED with the exact failure — do not mark this task done on unit tests alone.

- [ ] **Step 3: Write the changeset**

Create `.changeset/wald-grow-base-routing.md`:

```md
---
"@waldjs/cli": patch
---

Fix `wald grow` to respect `config.base` when routing incoming requests — previously, a non-default `base` (e.g. `/my-forest/`) made every page 404 in dev, since the dev server's routing never accounted for the prefix Vite itself was already correctly adding everywhere else.
```

- [ ] **Step 4: Commit**

```bash
git add .changeset/wald-grow-base-routing.md
git commit -m "Add changeset for wald grow base-aware routing"
```

- [ ] **Step 5: Push the branch and open the PR**

```bash
git push -u origin feat/issue-45-grow-base-routing
```

```bash
gh pr create --repo Stefan-Espant/WaldJS \
  --title "Make wald grow's page routing base-aware (#45)" \
  --body "Closes #45.

wald grow's raw HTTP handler passed the incoming request URL straight into `matchRoute()` with no `config.base` stripping, so a non-default base made every page 404 in dev (Vite's own middleware already handled base correctly — this was specific to wald grow's own routing logic, which runs before that fallback).

Fix: a new \`stripBase(url, base)\` strips the configured base before matching; \`handleRequest\` gains an optional \`routePath\` param (defaulting to \`url\`, so every existing call site is unaffected) used for matching, while the original \`url\` still goes to \`vite.transformIndexHtml\` as before.

Verified live: a real \`wald grow\` server under \`base: '/my-forest/'\` correctly serves \`/my-forest/\` and \`/my-forest/about\`, 404s the unprefixed \`/about\`, and still 404s a genuinely unmatched route — not just unit tests on the extracted function (see docs/superpowers/specs/2026-09-09-grow-base-routing-design.md for why that distinction matters here, given #41's history).

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```

- [ ] **Step 6: Report the PR URL back to the user.**

---

## Plan self-review notes

- **Spec coverage:** `stripBase`'s root-base passthrough, prefix-stripping (with/without trailing slash, with query string), false-positive-prefix rejection, `handleRequest`'s `routePath`/`url` split, and the required live-server verification are each covered by a task step above.
- **Placeholder scan:** none found.
- **Type consistency:** `stripBase` (Task 1) is the exact name and signature (`(url: string, base: string): string | null`) used in `run()`'s wiring and in `grow.test.ts`. `handleRequest`'s new `routePath` parameter name matches between its definition and both call sites (the test and `run()`).
