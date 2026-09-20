# wald grow src/assets/* Base-Aware Serving Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `wald grow`'s `src/assets/*` static-file serving respect `config.base`, closing issue [#47](https://github.com/Stefan-Espant/WaldJS/issues/47).

**Architecture:** `stripBase(url, base)` (already added in #45) gets computed once per request at the top of `growCommand`'s raw HTTP handler and shared by both the `/assets/*` branch (new) and the page-routing branch (existing, currently computes it separately — that duplicate call is removed). The `/assets/*` branch rewrites `req.url` to the stripped path before delegating to `sirv`, since `sirv` reads `req.url` directly with no other way to pass it a path.

**Tech Stack:** TypeScript, Vitest, `wald plant`/`wald grow` for live verification.

**Spec:** `docs/superpowers/specs/2026-09-14-grow-assets-base-routing-design.md`

---

## Before you start

This plan assumes you're already in the isolated worktree at `/Users/stefan/Desktop/semantique-agency/repositories/waldjs/.worktrees/fix-issue-47-grow-assets` on branch `fix/issue-47-grow-assets`, with dependencies installed and the workspace built. If starting fresh, from the repo root:

```bash
git fetch origin main
git worktree add .worktrees/fix-issue-47-grow-assets -b fix/issue-47-grow-assets origin/main
cd .worktrees/fix-issue-47-grow-assets
pnpm install --frozen-lockfile
pnpm -r build
```

All tasks below assume the working directory is this worktree.

**Important context for whoever implements this:** the two previous issues in this series (#41, #45) both touched `grow.ts`'s base-handling and both shipped something unit tests alone didn't fully catch — only a live server + real HTTP requests caught the real bugs. Task 2 of this plan requires an actual live-server verification using a real `wald plant`-scaffolded project, not just passing unit tests, before this is considered done. Do not skip it or treat it as optional.

---

### Task 1: Base-aware `/assets/*` serving

**Files:**
- Modify: `packages/cli/src/commands/grow.ts`
- Test: `packages/cli/src/commands/grow.test.ts`

- [ ] **Step 1: Write the failing tests**

In `packages/cli/src/commands/grow.test.ts`, add these two tests inside the existing `describe('stripBase', ...)` block, after the last test (`'does not false-match a path that only shares a text prefix with base'`):

```ts
  it('strips a base prefix from a src/assets/* request', () => {
    expect(stripBase('/my-forest/assets/css/global.css', '/my-forest/')).toBe('/assets/css/global.css')
  })

  it('returns null for an unprefixed src/assets/* request under a non-default base', () => {
    expect(stripBase('/assets/css/global.css', '/my-forest/')).toBeNull()
  })
```

(These pin down the exact computation the fix below relies on — `stripBase` already exists from #45, these are just two more input cases for it.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @waldjs/cli exec vitest run grow.test.ts`
Expected: Both new tests already PASS — `stripBase` itself doesn't need any code change, only its caller does. (This is expected and fine: the failing-first requirement applies to the *feature*, which Step 4's manual/live check below covers; these two tests document `stripBase`'s existing correct behavior for asset-shaped paths as a safety net before you touch the caller.)

- [ ] **Step 3: Implement**

In `packages/cli/src/commands/grow.ts`, change:

```ts
    const server = createHttpServer((req, res) => {
      const url = req.url ?? '/'

      if (url === componentStylesPath) {
        res.writeHead(200, { 'Content-Type': 'text/css' })
        res.end(collectComponentStyles(srcDir))
        return
      }

      if (url.startsWith('/assets/')) {
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
        const routePath = stripBase(url, config.base)
        const match = routePath !== null ? matchRoute(routes, routePath) : null

        if (!match) {
```

to:

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
```

Three changes, in order: (1) `routePath` is now computed once, right after `url`, before any branch; (2) the `/assets/*` branch's condition changes from `url.startsWith('/assets/')` to `routePath !== null && routePath.startsWith('/assets/')`, and gains `req.url = routePath` as its first line — `sirv` (called via `serveSrc`) reads `req.url` directly with no other way to hand it a path, so this reassignment is how it ends up serving the right file; (3) the page-routing branch's own `const routePath = stripBase(url, config.base)` line is deleted (it now reuses the one computed at the top). Everything else — the `componentStylesPath` branch, the 404 fallback bodies, the rest of the `servePublic` callback — is unchanged.

- [ ] **Step 4: Run tests to verify nothing broke**

Run: `pnpm --filter @waldjs/cli exec vitest run grow.test.ts`
Expected: PASS (all tests in the file, including every pre-existing one — root-base behavior is unaffected since `stripBase(url, '/')` returns `url` unchanged, making `req.url = routePath` a no-op reassignment to its own value for every project not using a custom `base`).

Run: `pnpm --filter @waldjs/cli exec vitest run`
Expected: PASS — the full CLI package suite, no regressions elsewhere.

- [ ] **Step 5: Commit**

```bash
git add packages/cli/src/commands/grow.ts packages/cli/src/commands/grow.test.ts
git commit -m "cli: make wald grow's src/assets/* serving base-aware"
```

---

### Task 2: Live verification, changeset, and PR

**Files:**
- Create: `.changeset/wald-grow-assets-base-routing.md`

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

Scaffold a REAL project with the real `wald plant` command (this matters — issue #47's own acceptance criterion is specifically about a `wald plant`-scaffolded project, which has a real `src/assets/css/global.css` referenced from its layout):

```bash
mkdir -p /tmp/wald-assets-base-check && cd /tmp/wald-assets-base-check
node /Users/stefan/Desktop/semantique-agency/repositories/waldjs/.worktrees/fix-issue-47-grow-assets/packages/cli/bin/wald.js plant .
```

After scaffolding, add a `wald.config.ts` with a non-default base (overwrite or create it — the scaffold may or may not include one by default, check first):

```bash
cat > wald.config.ts << 'EOF'
export default { base: '/my-forest/' }
EOF
```

Start `wald grow` against it using this worktree's built CLI directly (run in the background — it doesn't exit on its own):

```bash
node /Users/stefan/Desktop/semantique-agency/repositories/waldjs/.worktrees/fix-issue-47-grow-assets/packages/cli/bin/wald.js grow
```

With the server running, verify with real HTTP requests (`curl`) — note that per issue #45's own documented, separate, still-open gap (#47's own issue body references this), `wald grow`'s page routing doesn't strip base from the request URL itself, so request the PAGE at its unprefixed path (`/`) and check what asset URL IT references, then request THAT (which will be base-prefixed, since `vite.transformIndexHtml` rewrites it):

```bash
# Get the real page HTML and find its stylesheet link
curl -s http://localhost:7233/ -o /tmp/page.html
grep -o 'href="[^"]*\.css"' /tmp/page.html
```

- The href found should be base-prefixed, e.g. `/my-forest/assets/css/global.css`.

```bash
# Request that exact base-prefixed asset URL
curl -sD - "http://localhost:7233/my-forest/assets/css/global.css" -o /tmp/asset.css
head -c 200 /tmp/asset.css
```

- Expect: `200 OK`, and the response body is real CSS content (not a 404 plain-text body).

Also verify the unprefixed version still 404s under this non-default base (confirms the fix is genuinely base-aware, not just "serves everything regardless"):

```bash
curl -s -o /dev/null -w "unprefixed status: %{http_code}\n" "http://localhost:7233/assets/css/global.css"
```

- Expect: `404` (this exact scenario didn't 404 before the fix only because it was the WRONG, unprefixed URL happening to work by accident — under a non-default base it should NOT be what a real browser requests, and shouldn't be treated as valid).

Stop the server and delete the scratch project when done. Report the exact `curl` output for each check above — a status code alone is not sufficient evidence, include the actual response body/headers you observed, and the actual href string found in the page HTML.

If any of these checks fail, STOP and report BLOCKED with the exact failure — do not mark this task done on unit tests alone.

- [ ] **Step 3: Write the changeset**

Create `.changeset/wald-grow-assets-base-routing.md`:

```md
---
"@waldjs/cli": patch
---

Fix `wald grow` to serve `src/assets/*` files (a project's own global stylesheet, images, etc.) at their `config.base`-prefixed URL — previously, a non-default `base` made a freshly-scaffolded project's global stylesheet link 404 in dev, loading the site completely unstyled.
```

- [ ] **Step 4: Commit**

```bash
git add .changeset/wald-grow-assets-base-routing.md
git commit -m "Add changeset for wald grow src/assets/* base-aware serving"
```

- [ ] **Step 5: Push the branch and open the PR**

```bash
git push -u origin fix/issue-47-grow-assets
```

```bash
gh pr create --repo Stefan-Espant/WaldJS \
  --title "Make wald grow's src/assets/* serving base-aware (#47)" \
  --body "Closes #47.

wald grow's raw HTTP handler served \`src/assets/*\` files via a literal \`url.startsWith('/assets/')\` check, so a non-default \`base\` made every scaffolded project's global stylesheet (and any other \`src/assets/*\` reference) 404 in dev — \`vite.transformIndexHtml\` correctly rewrites those links to the base-prefixed URL, but that URL doesn't literally start with \`/assets/\`, and \`vite.middlewares\` (the fallback) has no knowledge of this custom \`srcDir\` → \`/assets/\` mapping.

Fix: reuse \`stripBase\` (from #45), computed once per request and shared with the page-routing check. The \`/assets/*\` branch rewrites \`req.url\` to the stripped path before delegating to \`sirv\` — verified against sirv's actual source that this is the correct, cache-safe way to hand it a different path (there's no other API for it).

Verified live with a real \`wald plant\`-scaffolded project under \`base: '/my-forest/'\` (not just unit tests, per #41/#45's history): the scaffold's real global stylesheet link resolves and loads correctly at its base-prefixed URL, and the unprefixed URL correctly 404s under the same non-default base.

See docs/superpowers/specs/2026-09-14-grow-assets-base-routing-design.md for the full design.

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```

- [ ] **Step 6: Report the PR URL back to the user.**

---

## Plan self-review notes

- **Spec coverage:** the shared `routePath` computation, the `req.url` rewrite (with the sirv-source rationale), root-base no-op safety, false-prefix protection (inherited from `stripBase` itself, no new code needed), and the mandatory `wald plant`-based live verification are each covered by a task step above.
- **Placeholder scan:** none found.
- **Type consistency:** `stripBase(url, base): string | null` (already defined in #45, unchanged here) is used identically in both the new `/assets/*` branch and the existing page-routing branch — same variable name (`routePath`), same null-check shape (`routePath !== null`).
