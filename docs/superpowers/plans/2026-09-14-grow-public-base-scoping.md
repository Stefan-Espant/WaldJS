# wald grow: public/ Assets Base-Scoping Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix `wald grow` so a `public/`-dir file (e.g. `public/robots.txt`) is reachable ONLY at its `config.base`-prefixed URL, not also unprefixed — the last of the `#41 → #45 → #47 → #51` series of `config.base` gaps in `wald grow`.

**Architecture:** `stripBase()` (already correct, unchanged) already returns `null` for any request that doesn't start with `config.base`. The bug is purely in `grow.ts`'s request-dispatch wiring: when `routePath === null`, the handler currently still falls through to `vite.middlewares`, and — per live-testing done during design — Vite's own dev-server middleware serves `publicDir` files at the unprefixed path regardless of `base` (confirmed empirically, not assumed). The fix: never call `vite.middlewares` at all when `routePath === null`; respond 404 immediately instead. No change to `stripBase`, `handleRequest`, the component-styles branch, or the `#47` `/assets/*` branch.

**Tech Stack:** TypeScript, Node `http`, Vite (middlewareMode), `sirv`, Vitest.

**Design doc:** `docs/superpowers/specs/2026-09-14-grow-public-base-design.md`

---

## Testing approach for this plan

Unlike `stripBase` and `handleRequest` (pure exported functions with full unit coverage in `grow.test.ts`), the code this plan touches is the inline HTTP dispatch closure inside `growCommand`'s `run()` — it is not extracted into a testable function, matching the precedent set by `#47`'s `/assets/*` branch (also inline, also not unit-tested directly; its correctness is covered by `stripBase`'s existing tests plus live-server verification). `stripBase` already has full test coverage for the "outside base" case (`returns null for a request that does not start with the configured base`), so no new `stripBase` tests are needed for `#51` — the routing *decision* was already correct and tested; only the *wiring* that acts on it was wrong.

This plan therefore has one implementation task (the wiring fix), followed by running the full existing test suite (regression check, no new unit tests expected to be added), and a **mandatory** live-server verification task — required by this repo's established practice for any `config.base`/URL-handling change in `wald grow` (see design doc's "Getest" table, which this task reproduces and extends).

---

### Task 1: Gate the `vite.middlewares` fallback on `routePath !== null`

**Files:**
- Modify: `packages/cli/src/commands/grow.ts:118-154`
- Test: `packages/cli/src/commands/grow.test.ts` (run existing suite; no new tests added — see "Testing approach" above)

- [ ] **Step 1: Read the current handler to confirm line numbers match**

Run: `sed -n '95,155p' packages/cli/src/commands/grow.ts`

Confirm this exact structure is present before editing (it should match the file as of the `#47` merge, commit `1bd6d02`):

```ts
    const server = createHttpServer((req, res) => {
      const url = req.url ?? '/'
      const routePath = stripBase(url, config.base)

      if (url === componentStylesPath) {
        res.writeHead(200, { 'Content-Type': 'text/css' })
        res.end(collectComponentStyles(srcDir))
        return
      }

      if (routePath !== null && routePath.startsWith('/assets/')) {
        req.url = routePath
        serveSrc(req, res, () => {
          if (!res.headersSent && !res.writableEnded) {
            res.writeHead(404, { 'Content-Type': 'text/plain' })
            res.end('Asset not found')
          }
        })
        return
      }

      servePublic(req, res, async () => {
        if (res.headersSent || res.writableEnded) return

        const routes = scanRoutes(pagesDir)
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
          res.writeHead(status, { 'Content-Type': 'text/html' })
          res.end(body)
        } catch (e) {
          const error = e as Error & { loc?: { file?: string; line?: number; column?: number } }
          vite.ssrFixStacktrace(error)
          console.error(`[waldjs] Render failed for ${url}`)
          console.error(error.stack ?? String(error))
          if (error.loc && !error.loc.file) error.loc.file = match.route.file
          if (!res.headersSent && !res.writableEnded) {
            let body = renderErrorPage(error)
            if (vite.transformIndexHtml) {
              body = await vite.transformIndexHtml(url, body)
            }
            res.writeHead(500, { 'Content-Type': 'text/html' })
            res.end(body)
          }
        }
      })
    })
```

If the file has drifted from this (e.g. due to other merged work), stop and report — do not proceed with the edit blind.

- [ ] **Step 2: Extract the `servePublic` callback body into a named `afterPublic` function, and gate on `routePath === null`**

Replace the `servePublic(req, res, async () => { ... })` block (everything from `servePublic(req, res, async () => {` down to its matching closing `})`) with:

```ts
      const afterPublic = async () => {
        if (res.headersSent || res.writableEnded) return

        const routes = scanRoutes(pagesDir)
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
          res.writeHead(status, { 'Content-Type': 'text/html' })
          res.end(body)
        } catch (e) {
          const error = e as Error & { loc?: { file?: string; line?: number; column?: number } }
          vite.ssrFixStacktrace(error)
          console.error(`[waldjs] Render failed for ${url}`)
          console.error(error.stack ?? String(error))
          if (error.loc && !error.loc.file) error.loc.file = match.route.file
          if (!res.headersSent && !res.writableEnded) {
            let body = renderErrorPage(error)
            if (vite.transformIndexHtml) {
              body = await vite.transformIndexHtml(url, body)
            }
            res.writeHead(500, { 'Content-Type': 'text/html' })
            res.end(body)
          }
        }
      }

      // A request outside config.base (routePath === null) must never reach
      // servePublic OR vite.middlewares: Vite's own dev-server middleware
      // serves publicDir files at the unprefixed path too, regardless of
      // base (confirmed by live-testing during design — this is why the
      // fallback itself is skipped entirely here, not just servePublic).
      if (routePath === null) {
        res.writeHead(404, { 'Content-Type': 'text/plain' })
        res.end('Not found')
        return
      }

      req.url = routePath
      servePublic(req, res, () => {
        req.url = url
        afterPublic()
      })
    })
```

The full handler (`const server = createHttpServer((req, res) => { ... })`) should now read, in full:

```ts
    const server = createHttpServer((req, res) => {
      const url = req.url ?? '/'
      const routePath = stripBase(url, config.base)

      if (url === componentStylesPath) {
        res.writeHead(200, { 'Content-Type': 'text/css' })
        res.end(collectComponentStyles(srcDir))
        return
      }

      if (routePath !== null && routePath.startsWith('/assets/')) {
        req.url = routePath
        serveSrc(req, res, () => {
          if (!res.headersSent && !res.writableEnded) {
            res.writeHead(404, { 'Content-Type': 'text/plain' })
            res.end('Asset not found')
          }
        })
        return
      }

      const afterPublic = async () => {
        if (res.headersSent || res.writableEnded) return

        const routes = scanRoutes(pagesDir)
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
          res.writeHead(status, { 'Content-Type': 'text/html' })
          res.end(body)
        } catch (e) {
          const error = e as Error & { loc?: { file?: string; line?: number; column?: number } }
          vite.ssrFixStacktrace(error)
          console.error(`[waldjs] Render failed for ${url}`)
          console.error(error.stack ?? String(error))
          if (error.loc && !error.loc.file) error.loc.file = match.route.file
          if (!res.headersSent && !res.writableEnded) {
            let body = renderErrorPage(error)
            if (vite.transformIndexHtml) {
              body = await vite.transformIndexHtml(url, body)
            }
            res.writeHead(500, { 'Content-Type': 'text/html' })
            res.end(body)
          }
        }
      }

      // A request outside config.base (routePath === null) must never reach
      // servePublic OR vite.middlewares: Vite's own dev-server middleware
      // serves publicDir files at the unprefixed path too, regardless of
      // base (confirmed by live-testing during design — this is why the
      // fallback itself is skipped entirely here, not just servePublic).
      if (routePath === null) {
        res.writeHead(404, { 'Content-Type': 'text/plain' })
        res.end('Not found')
        return
      }

      req.url = routePath
      servePublic(req, res, () => {
        req.url = url
        afterPublic()
      })
    })
```

- [ ] **Step 3: Type-check and run the existing test suite**

Run: `cd packages/cli && pnpm build && pnpm test grow.test.ts`

Expected: `tsc` succeeds with no errors, and all existing tests in `grow.test.ts` pass unchanged (the `stripBase` and `handleRequest` suites are untouched by this edit — confirms no regression).

- [ ] **Step 4: Commit**

```bash
git add packages/cli/src/commands/grow.ts
git commit -m "$(cat <<'EOF'
fix: scope wald grow public/ serving to config.base

routePath === null (a request outside config.base) no longer falls
through to vite.middlewares, which was independently serving
publicDir files at the unprefixed path regardless of base.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Live-server verification (mandatory)

This repo's established practice (see memory: "base/URL-fixes in wald grow altijd live verifiëren") requires an actual running `wald grow` server and real HTTP requests for any `config.base` change — unit tests alone have missed regressions before (`#41`). This task reproduces the design doc's verification table against the **built** code from Task 1, plus one additional check (a real page route, to confirm nothing about page-routing regressed).

**Files:**
- None (verification only, no code changes)

- [ ] **Step 1: Build the CLI package**

Run: `cd packages/cli && pnpm build`

Expected: succeeds with no errors.

- [ ] **Step 2: Reuse (or recreate) the test fixture project with a non-default base and a public/ file**

A fixture from this issue's design-phase prototyping already exists at `/tmp/wald-51-check` with `wald.config.ts` containing `export default { base: '/my-forest/' }` and `public/robots.txt` present. If it's still there, reuse it as-is — skip straight to Step 3.

If it does not exist (fresh environment), recreate it:

```bash
cd /tmp
node /path/to/worktree/packages/cli/bin/wald.js plant wald-51-check
cd wald-51-check
mkdir -p public
cat > public/robots.txt << 'EOF'
User-agent: *
Disallow:
EOF
cat > wald.config.ts << 'EOF'
export default { base: '/my-forest/' }
EOF
```

(`wald plant <name>` scaffolds into `./<name>` and installs dependencies automatically — see `packages/cli/src/commands/plant.ts`.)

- [ ] **Step 3: Start the dev server against the fixed build**

```bash
cd /tmp/wald-51-check
node /path/to/worktree/packages/cli/bin/wald.js grow &
sleep 3
```

Expected console output includes `Base:    /my-forest/` and `Dev server ready`.

- [ ] **Step 4: Run the verification requests**

```bash
echo "unprefixed public file (expect 404 — this is the bug being fixed):"
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:7233/robots.txt

echo "prefixed public file (expect 200, correct content):"
curl -s http://localhost:7233/my-forest/robots.txt

echo "unprefixed root (expect 404, unchanged since #45):"
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:7233/

echo "prefixed root / a real page (expect 200):"
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:7233/my-forest/

echo "prefixed HMR client (expect 200 — must not regress):"
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:7233/my-forest/@vite/client

echo "prefixed nonexistent src/assets path, #47 regression check (expect 404):"
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:7233/my-forest/assets/does-not-exist.png
```

Expected results (must match exactly, in order): `404`, robots.txt content + implicit `200`, `404`, `200`, `200`, `404`.

If any result differs, stop — do not proceed to Task 3. Re-check Task 1's edit against the design doc's before/after diff.

- [ ] **Step 5: Stop the server**

```bash
kill %1 2>/dev/null
lsof -ti:7233 | xargs -r kill -9 2>/dev/null
```

- [ ] **Step 6: Report results**

Record the actual curl output for each of the 6 checks in the task's completion notes (for the final holistic reviewer to reference, and for the PR description's test plan).

---

### Task 3: Changeset

**Files:**
- Create: `.changeset/wald-grow-public-base-scoping.md`

- [ ] **Step 1: Write the changeset**

```markdown
---
"@waldjs/cli": patch
---

Fix `wald grow` to serve `public/` directory files (e.g. `robots.txt`, `favicon.ico`) only at their `config.base`-prefixed URL — previously, a non-default `base` still made these files reachable unprefixed as well, because Vite's own dev-server middleware serves `publicDir` files regardless of `base`.
```

- [ ] **Step 2: Commit**

```bash
git add .changeset/wald-grow-public-base-scoping.md
git commit -m "$(cat <<'EOF'
Add changeset for wald grow public/ base-scoping fix

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Plan self-review notes

- **Spec coverage:** the design's single requirement (unprefixed `public/` requests must 404, prefixed ones must keep working, no regression to HMR/`#47`'s `/assets/*`/page-routing) is covered by Task 1 (the fix) + Task 2 (verification of all five scenarios from the design's test table, plus one extra page-route check).
- **No placeholders:** all code shown is complete and copy-pasteable; Task 2's fixture-scaffolding command has a documented fallback/verification instruction rather than a vague "set up a project" step, since the exact `wald plant` invocation should be confirmed against the live codebase rather than guessed.
- **Type consistency:** `afterPublic`, `routePath`, `url`, `vite`, `servePublic` names match exactly what's already declared earlier in `grow.ts`'s `run()` — no new identifiers introduced beyond `afterPublic`.
- **Scope:** single-file fix (`grow.ts`) plus its changeset; no new exported functions, no changes to `stripBase`/`handleRequest`/other branches.
