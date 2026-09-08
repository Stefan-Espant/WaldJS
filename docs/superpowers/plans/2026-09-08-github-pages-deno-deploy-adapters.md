# GitHub Pages and Deno Deploy Adapters Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `githubPagesAdapter()` and `denoDeployAdapter()` to `@waldjs/cli`, closing issue [#28](https://github.com/Stefan-Espant/WaldJS/issues/28).

**Architecture:** Both follow the existing `defineAdapter({ name, adapt({ outDir }) {...} })` pattern already used by `staticAdapter`/`netlifyAdapter`/`cloudflarePagesAdapter`/`vercelAdapter` in `packages/cli/src/adapters.ts`. `githubPagesAdapter` writes `.nojekyll` and a `404.html` fallback; `denoDeployAdapter` needs no `adapt` hook at all (researched: Deno Deploy has no special static-output requirement).

**Tech Stack:** TypeScript, Vitest, Node's `node:fs`/`node:path`.

**Spec:** `docs/superpowers/specs/2026-09-08-github-pages-deno-deploy-adapters-design.md`

---

## Before you start

This plan assumes you're already in the isolated worktree at `/Users/stefan/Desktop/semantique-agency/repositories/waldjs/.worktrees/feat-issue-28-adapters` on branch `feat/issue-28-adapters`, with dependencies installed and the workspace built. If starting fresh, from the repo root:

```bash
git fetch origin main
git worktree add .worktrees/feat-issue-28-adapters -b feat/issue-28-adapters origin/main
cd .worktrees/feat-issue-28-adapters
pnpm install --frozen-lockfile
pnpm -r build
```

All tasks below assume the working directory is this worktree.

---

### Task 1: `adapters.ts` — the two new adapters, with tests

**Files:**
- Modify: `packages/cli/src/adapters.ts`
- Create: `packages/cli/src/adapters.test.ts`

This file has no existing test file — the other four adapters are only exercised indirectly today (one assertion on `vercelAdapter()`'s `config.json` inside `build.test.ts`). This task creates direct unit tests for the two new adapters only.

- [ ] **Step 1: Write the failing tests**

Create `packages/cli/src/adapters.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { githubPagesAdapter, denoDeployAdapter, type WaldAdapterContext } from './adapters.js'

let tmpDir: string

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'wald-adapters-'))
})

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true })
})

function makeContext(outDir: string, overrides: Partial<WaldAdapterContext> = {}): WaldAdapterContext {
  return {
    rootDir: tmpDir,
    outDir,
    outDirRelative: 'dist',
    base: '/',
    staticRoutes: 1,
    dynamicRoutes: 0,
    dynamicPages: 0,
    canopyEntries: 0,
    ...overrides,
  }
}

describe('githubPagesAdapter', () => {
  it('writes an empty .nojekyll file', async () => {
    const outDir = join(tmpDir, 'dist')
    mkdirSync(outDir, { recursive: true })

    await githubPagesAdapter().adapt?.(makeContext(outDir))

    expect(existsSync(join(outDir, '.nojekyll'))).toBe(true)
    expect(readFileSync(join(outDir, '.nojekyll'), 'utf8')).toBe('')
  })

  it('copies index.html to 404.html when index.html exists', async () => {
    const outDir = join(tmpDir, 'dist')
    mkdirSync(outDir, { recursive: true })
    writeFileSync(join(outDir, 'index.html'), '<h1>Home</h1>')

    await githubPagesAdapter().adapt?.(makeContext(outDir))

    expect(readFileSync(join(outDir, '404.html'), 'utf8')).toBe('<h1>Home</h1>')
  })

  it('does not write a 404.html when index.html is absent', async () => {
    const outDir = join(tmpDir, 'dist')
    mkdirSync(outDir, { recursive: true })

    await githubPagesAdapter().adapt?.(makeContext(outDir))

    expect(existsSync(join(outDir, '404.html'))).toBe(false)
  })

  it('produces the same output regardless of base', async () => {
    const outDir = join(tmpDir, 'dist')
    mkdirSync(outDir, { recursive: true })
    writeFileSync(join(outDir, 'index.html'), '<h1>Home</h1>')

    await githubPagesAdapter().adapt?.(makeContext(outDir, { base: '/my-repo/' }))

    expect(existsSync(join(outDir, '.nojekyll'))).toBe(true)
    expect(readFileSync(join(outDir, '404.html'), 'utf8')).toBe('<h1>Home</h1>')
  })
})

describe('denoDeployAdapter', () => {
  it('has the expected name and no adapt hook', () => {
    const adapter = denoDeployAdapter()
    expect(adapter.name).toBe('deno-deploy')
    expect(adapter.adapt).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @waldjs/cli exec vitest run adapters.test.ts`
Expected: FAIL with "Cannot find module... no matching export" for `githubPagesAdapter`/`denoDeployAdapter` (they don't exist yet).

- [ ] **Step 3: Implement**

In `packages/cli/src/adapters.ts`:

1. Change the `node:fs` import at the top to add `existsSync` and `cpSync`:

```ts
import { mkdirSync, writeFileSync, existsSync, cpSync } from 'node:fs'
```

2. Insert these two new adapters right after `vercelAdapter()` and before the `writeFile` helper function at the bottom of the file:

```ts
export function githubPagesAdapter(): WaldAdapter {
  return defineAdapter({
    name: 'github-pages',
    adapt({ outDir }) {
      writeFile(join(outDir, '.nojekyll'), '')
      const indexPath = join(outDir, 'index.html')
      if (existsSync(indexPath)) {
        cpSync(indexPath, join(outDir, '404.html'))
      }
    },
  })
}

// Deno Deploy has no adapter-specific output shape to produce — a plain
// static directory (`deployctl deploy --static-dir=dist`, or the GitHub
// integration's zero-config detection) is exactly what staticAdapter()
// already produces. This exists as its own named export so a project's
// wald.config.ts can say what it's deploying to explicitly, rather than
// silently relying on staticAdapter()'s default for a platform that in
// fact needs nothing special.
export function denoDeployAdapter(): WaldAdapter {
  return defineAdapter({ name: 'deno-deploy' })
}
```

(The existing `function writeFile(filePath: string, contents: string) {...}` helper at the very end of the file is unchanged — both new adapters reuse it, same as `netlifyAdapter`/`cloudflarePagesAdapter` already do.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @waldjs/cli exec vitest run adapters.test.ts`
Expected: PASS (all 5 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/cli/src/adapters.ts packages/cli/src/adapters.test.ts
git commit -m "cli: add githubPagesAdapter and denoDeployAdapter"
```

---

### Task 2: Export the new adapters and update the README

**Files:**
- Modify: `packages/cli/src/index.ts`
- Modify: `README.md`

- [ ] **Step 1: Export from the package's public API**

In `packages/cli/src/index.ts`, change:

```ts
export {
  defineAdapter,
  staticAdapter,
  netlifyAdapter,
  cloudflarePagesAdapter,
  vercelAdapter,
} from './adapters.js'
```

to:

```ts
export {
  defineAdapter,
  staticAdapter,
  netlifyAdapter,
  cloudflarePagesAdapter,
  vercelAdapter,
  githubPagesAdapter,
  denoDeployAdapter,
} from './adapters.js'
```

- [ ] **Step 2: Update the README's adapter table**

In `README.md`, find this table (search for `| Adapter | Output |`):

```md
| Adapter | Output |
|---|---|
| `staticAdapter()` | Plain static files (default) |
| `netlifyAdapter()` | Adds a `_headers` file with cache rules |
| `cloudflarePagesAdapter()` | Adds a `_headers` file with cache rules |
| `vercelAdapter()` | Builds to `.vercel/output/` with a `config.json` (Build Output API v3) |

Write your own with `defineAdapter({ name, adapt({ outDir }) { … } })`.
```

Add two rows before the "Write your own" line, so it reads:

```md
| Adapter | Output |
|---|---|
| `staticAdapter()` | Plain static files (default) |
| `netlifyAdapter()` | Adds a `_headers` file with cache rules |
| `cloudflarePagesAdapter()` | Adds a `_headers` file with cache rules |
| `vercelAdapter()` | Builds to `.vercel/output/` with a `config.json` (Build Output API v3) |
| `githubPagesAdapter()` | Adds a `.nojekyll` file and a `404.html` fallback (a copy of `index.html`) |
| `denoDeployAdapter()` | Plain static files — Deno Deploy needs no special output shape |

Write your own with `defineAdapter({ name, adapt({ outDir }) { … } })`.
```

- [ ] **Step 3: Verify the package still builds and typechecks**

Run: `pnpm --filter @waldjs/cli exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add packages/cli/src/index.ts README.md
git commit -m "cli: export new adapters and document them in the README"
```

---

### Task 3: Changeset, verification, and PR

**Files:**
- Create: `.changeset/wald-github-pages-deno-deploy-adapters.md`

- [ ] **Step 1: Full workspace verification**

Run: `pnpm --filter @waldjs/cli exec vitest run`
Expected: PASS — every test in the package (163 pre-existing + 5 new = 168).

Run: `pnpm --filter @waldjs/cli exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 2: Write the changeset**

Create `.changeset/wald-github-pages-deno-deploy-adapters.md`:

```md
---
"@waldjs/cli": minor
---

Add `githubPagesAdapter()` (writes `.nojekyll` and a `404.html` fallback) and `denoDeployAdapter()` (Deno Deploy needs no special static-output shape, so this is a named alias documenting the deploy target) alongside the existing `staticAdapter`/`netlifyAdapter`/`cloudflarePagesAdapter`/`vercelAdapter`.
```

- [ ] **Step 3: Commit**

```bash
git add .changeset/wald-github-pages-deno-deploy-adapters.md
git commit -m "Add changeset for GitHub Pages and Deno Deploy adapters"
```

- [ ] **Step 4: Push the branch and open the PR**

```bash
git push -u origin feat/issue-28-adapters
```

```bash
gh pr create --repo Stefan-Espant/WaldJS \
  --title "Add GitHub Pages and Deno Deploy adapters (#28)" \
  --body "Closes #28.

- \`githubPagesAdapter()\`: writes an empty \`.nojekyll\` (disables GitHub Pages' default Jekyll processing) and copies \`index.html\` to \`404.html\` as a fallback when one exists. \`base\` needs no adapter-specific handling — it's already a general, adapter-independent build setting applied before \`adapt()\` ever runs.
- \`denoDeployAdapter()\`: researched deployctl/Deno Deploy's static-site docs — a plain static directory is exactly what's expected, no special output shape. This is a named, documented alias with no \`adapt\` hook, matching \`staticAdapter()\`'s own shape.
- New \`packages/cli/src/adapters.test.ts\` (didn't exist before) with direct unit tests for both.

See docs/superpowers/specs/2026-09-08-github-pages-deno-deploy-adapters-design.md for the full design.

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```

- [ ] **Step 5: Report the PR URL back to the user.**

---

## Plan self-review notes

- **Spec coverage:** `.nojekyll`, `404.html` fallback, base-independence, `denoDeployAdapter`'s no-op shape, exports, README table, and the "no retroactive tests for the other four adapters" scope boundary are all covered by name in Task 1/2, with the scope boundary restated explicitly there.
- **Placeholder scan:** none found.
- **Type consistency:** `githubPagesAdapter`/`denoDeployAdapter` names match between Task 1 (implementation), Task 2 (exports/README), and Task 3 (changeset/PR body) exactly.
