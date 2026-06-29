# Phase 4a — Vite Plugin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the existing Vite plugin from `@waldjs/compiler` into `@waldjs/cli` (internal), and add structured error handling with line-number reporting.

**Architecture:** The compiler already contains a `waldPlugin()` in `packages/compiler/src/vite/`. That plugin transforms `.wald` files and provides a virtual `wald:content` module. We move it to `packages/cli/src/vite-plugin.ts`, add try/catch with `this.error()` to surface compiler errors in Vite's overlay, and remove the `vite` dependency from the compiler. The compiler separately gains a `line` property on its frontmatter error so the overlay can show the exact line.

**Tech Stack:** TypeScript (NodeNext modules), Vite 5, Vitest, pnpm workspaces

---

## File Map

| Action | Path | Responsibility |
|---|---|---|
| Create | `packages/cli/src/vite-plugin.ts` | Vite plugin: `.wald` transform + `wald:content` virtual module |
| Create | `packages/cli/src/vite-plugin.test.ts` | Unit tests for both plugins |
| Modify | `packages/compiler/src/parser/frontmatter.ts` | Add `line` property to thrown error |
| Modify | `packages/compiler/src/parser/frontmatter.test.ts` | Test `line` property |
| Modify | `packages/compiler/src/index.ts` | Remove `waldPlugin` export |
| Modify | `packages/compiler/package.json` | Remove `vite` dependency |
| Delete | `packages/compiler/src/vite/plugin.ts` | Moved to CLI |
| Delete | `packages/compiler/src/vite/plugin.test.ts` | Moved to CLI |

---

## Task 1: Add `line` property to frontmatter errors

**Files:**
- Modify: `packages/compiler/src/parser/frontmatter.ts`
- Modify: `packages/compiler/src/parser/frontmatter.test.ts`

- [ ] **Step 1: Write the failing test**

Add this test at the end of the `describe('extractFrontmatter', ...)` block in `packages/compiler/src/parser/frontmatter.test.ts`:

```ts
it('includes a line property on the thrown error for unclosed frontmatter', () => {
  const source = `---\nconst title = "Hello"\n<h1>{title}</h1>`
  let caught: unknown
  try {
    extractFrontmatter(source)
  } catch (e) {
    caught = e
  }
  expect(caught).toBeInstanceOf(Error)
  expect(caught).toHaveProperty('line')
  expect(typeof (caught as { line: unknown }).line).toBe('number')
})
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
pnpm --filter "@waldjs/compiler" test
```

Expected: FAIL — `expect(caught).toHaveProperty('line')` — the current error has no `line` property.

- [ ] **Step 3: Implement — add `line` to the thrown error**

In `packages/compiler/src/parser/frontmatter.ts`, replace lines 18–19:

```ts
// Before:
if (end === -1) {
  throw new Error('Unclosed frontmatter block — missing closing ---')
}
```

```ts
// After:
if (end === -1) {
  const line = (afterFirst.match(/\n/g) ?? []).length + 1
  const err = Object.assign(
    new Error('Unclosed frontmatter block — missing closing ---'),
    { line }
  )
  throw err
}
```

The complete updated `extractFrontmatter` function:

```ts
export function extractFrontmatter(source: string): FrontmatterResult {
  const trimmed = source.trimStart()

  if (!trimmed.startsWith(DELIMITER)) {
    return { code: '', rest: source }
  }

  const afterFirst = trimmed.slice(DELIMITER.length)
  const end = afterFirst.indexOf('\n' + DELIMITER)

  if (end === -1) {
    const line = (afterFirst.match(/\n/g) ?? []).length + 1
    const err = Object.assign(
      new Error('Unclosed frontmatter block — missing closing ---'),
      { line }
    )
    throw err
  }

  const code = afterFirst.slice(0, end).trim()
  const rest = afterFirst.slice(end + DELIMITER.length + 1).trimStart()

  return { code, rest }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
pnpm --filter "@waldjs/compiler" test
```

Expected: all tests pass including the new one.

- [ ] **Step 5: Commit**

```bash
git add packages/compiler/src/parser/frontmatter.ts packages/compiler/src/parser/frontmatter.test.ts
git commit -m "feat(compiler): add line number to frontmatter parse error"
```

---

## Task 2: Move the Vite plugin from compiler to CLI

**Files:**
- Create: `packages/cli/src/vite-plugin.ts`
- Create: `packages/cli/src/vite-plugin.test.ts`
- Modify: `packages/compiler/src/index.ts`
- Modify: `packages/compiler/package.json`
- Delete: `packages/compiler/src/vite/plugin.ts`
- Delete: `packages/compiler/src/vite/plugin.test.ts`

- [ ] **Step 1: Write tests for the CLI plugin**

Create `packages/cli/src/vite-plugin.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { waldPlugin } from './vite-plugin.js'
import type { Plugin } from 'vite'

function callHook(pluginName: string, hookName: keyof Plugin, ...args: unknown[]) {
  const plugin = waldPlugin().find(p => p.name === pluginName)!
  return (plugin[hookName] as Function).call({}, ...args)
}

describe('vite-plugin-wald', () => {
  it('resolves .wald file ids to themselves', () => {
    const result = callHook('vite-plugin-wald', 'resolveId', 'src/pages/index.wald', undefined, {})
    expect(result).toBe('src/pages/index.wald')
  })

  it('returns undefined for non-.wald ids in resolveId', () => {
    const result = callHook('vite-plugin-wald', 'resolveId', 'src/index.ts', undefined, {})
    expect(result).toBeUndefined()
  })

  it('transforms .wald source into compiled JS', () => {
    const result = callHook('vite-plugin-wald', 'transform', '---\n---\n<h1>Hi</h1>', 'test.wald')
    expect(result.code).toContain('createTree')
  })

  it('returns undefined for non-.wald files in transform', () => {
    const result = callHook('vite-plugin-wald', 'transform', 'export default {}', 'test.ts')
    expect(result).toBeUndefined()
  })
})

describe('vite-plugin-wald-content', () => {
  it('resolves wald:content to a virtual module id', () => {
    const result = callHook('vite-plugin-wald-content', 'resolveId', 'wald:content', undefined, {})
    expect(result).toBe('\0wald:content')
  })

  it('returns undefined for other ids in resolveId', () => {
    const result = callHook('vite-plugin-wald-content', 'resolveId', 'other:module', undefined, {})
    expect(result).toBeUndefined()
  })

  it('loads wald:content with getCollection and getEntry exports', () => {
    const code = callHook('vite-plugin-wald-content', 'load', '\0wald:content')
    expect(code).toContain('export const getCollection')
    expect(code).toContain('export const getEntry')
  })

  it('returns undefined for other virtual ids in load', () => {
    const code = callHook('vite-plugin-wald-content', 'load', '\0other:module')
    expect(code).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm --filter "@waldjs/cli" test
```

Expected: FAIL — `Cannot find module './vite-plugin.js'`

- [ ] **Step 3: Create `packages/cli/src/vite-plugin.ts`**

```ts
import { compile } from '@waldjs/compiler'
import { join } from 'node:path'
import type { Plugin } from 'vite'

const VIRTUAL_CONTENT_ID = '\0wald:content'

export function waldPlugin(): Plugin[] {
  return [
    {
      name: 'vite-plugin-wald',

      resolveId(id) {
        if (id.endsWith('.wald')) return id
      },

      transform(code, id) {
        if (!id.endsWith('.wald')) return
        return { code: compile(code, id), map: null }
      },
    },
    {
      name: 'vite-plugin-wald-content',

      resolveId(id) {
        if (id === 'wald:content') return VIRTUAL_CONTENT_ID
      },

      load(id) {
        if (id !== VIRTUAL_CONTENT_ID) return
        const contentDir = JSON.stringify(join(process.cwd(), 'content'))
        return [
          `import { readCollection as _rc, readEntry as _re } from '@waldjs/content'`,
          `const contentDir = ${contentDir}`,
          `export const getCollection = (name) => _rc(name, contentDir)`,
          `export const getEntry = (collection, slug) => _re(collection, slug, contentDir)`,
        ].join('\n')
      },
    },
  ]
}
```

- [ ] **Step 4: Run CLI tests to verify they pass**

```bash
pnpm --filter "@waldjs/cli" test
```

Expected: the 8 new plugin tests pass.

- [ ] **Step 5: Delete the compiler's vite directory**

```bash
git rm packages/compiler/src/vite/plugin.ts packages/compiler/src/vite/plugin.test.ts
```

Git removes both files from the working tree; the now-empty `vite/` directory is ignored by git automatically.

- [ ] **Step 6: Remove `waldPlugin` export from compiler index**

In `packages/compiler/src/index.ts`, remove this line:

```ts
export { waldPlugin } from './vite/plugin.js'
```

The file after the change:

```ts
export { parse } from './parser/index.js'
export { transform } from './transform/index.js'
export { compile } from './compile.js'
export type * from './ast/types.js'
```

- [ ] **Step 7: Remove `vite` from compiler dependencies**

In `packages/compiler/package.json`, remove `"vite": "^5.0.0"` from `dependencies`:

```json
{
  "name": "@waldjs/compiler",
  "version": "0.1.0",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  },
  "scripts": {
    "build": "tsc",
    "test": "vitest run"
  },
  "dependencies": {
    "@waldjs/runtime": "workspace:*"
  },
  "devDependencies": {
    "typescript": "^5.5.0",
    "vitest": "^2.0.0"
  }
}
```

- [ ] **Step 8: Run pnpm install and all tests**

```bash
pnpm install && pnpm --filter "@waldjs/compiler" test && pnpm --filter "@waldjs/cli" test
```

Expected: all tests pass, no references to the deleted plugin.

- [ ] **Step 9: Commit**

```bash
git add packages/cli/src/vite-plugin.ts packages/cli/src/vite-plugin.test.ts
git add packages/compiler/src/index.ts packages/compiler/package.json
git commit -m "refactor: move Vite plugin from compiler to cli (internal)"
```

---

## Task 3: Add error handling to the CLI plugin

**Files:**
- Modify: `packages/cli/src/vite-plugin.ts`
- Modify: `packages/cli/src/vite-plugin.test.ts`

- [ ] **Step 1: Write the failing tests**

Add to `packages/cli/src/vite-plugin.test.ts` — a new helper that passes a mock `this` with an `error` spy, and two new tests inside `describe('vite-plugin-wald', ...)`:

```ts
function callTransformWithMock(code: string, id: string) {
  const plugin = waldPlugin().find(p => p.name === 'vite-plugin-wald')!
  const mockError = vi.fn()
  ;(plugin.transform as Function).call({ error: mockError }, code, id)
  return mockError
}

// Add inside describe('vite-plugin-wald', ...):

it('calls this.error with [waldjs] prefix when compiler throws', () => {
  const mockError = callTransformWithMock('---\nno closing', 'bad.wald')
  expect(mockError).toHaveBeenCalledWith(
    expect.objectContaining({ message: expect.stringContaining('[waldjs]') })
  )
})

it('passes line number to this.error when compiler provides it', () => {
  const mockError = callTransformWithMock('---\nno closing', 'bad.wald')
  expect(mockError).toHaveBeenCalledWith(
    expect.objectContaining({ loc: expect.objectContaining({ line: expect.any(Number) }) })
  )
})
```

Also add `import { vi } from 'vitest'` to the imports at the top of the test file.

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm --filter "@waldjs/cli" test
```

Expected: FAIL — the two new tests fail because `this.error` is never called (the error propagates as an exception instead).

- [ ] **Step 3: Add error handling to the transform hook**

In `packages/cli/src/vite-plugin.ts`, replace the `transform` hook:

```ts
// Before:
transform(code, id) {
  if (!id.endsWith('.wald')) return
  return { code: compile(code, id), map: null }
},
```

```ts
// After:
transform(code, id) {
  if (!id.endsWith('.wald')) return
  try {
    return { code: compile(code, id), map: null }
  } catch (e) {
    const message = `[waldjs] ${e instanceof Error ? e.message : String(e)}`
    const loc = typeof e === 'object' && e !== null && 'line' in e
      ? { line: (e as { line: number }).line, column: 0 }
      : undefined
    this.error({ message, loc })
  }
},
```

The complete `packages/cli/src/vite-plugin.ts` after this change:

```ts
import { compile } from '@waldjs/compiler'
import { join } from 'node:path'
import type { Plugin } from 'vite'

const VIRTUAL_CONTENT_ID = '\0wald:content'

export function waldPlugin(): Plugin[] {
  return [
    {
      name: 'vite-plugin-wald',

      resolveId(id) {
        if (id.endsWith('.wald')) return id
      },

      transform(code, id) {
        if (!id.endsWith('.wald')) return
        try {
          return { code: compile(code, id), map: null }
        } catch (e) {
          const message = `[waldjs] ${e instanceof Error ? e.message : String(e)}`
          const loc = typeof e === 'object' && e !== null && 'line' in e
            ? { line: (e as { line: number }).line, column: 0 }
            : undefined
          this.error({ message, loc })
        }
      },
    },
    {
      name: 'vite-plugin-wald-content',

      resolveId(id) {
        if (id === 'wald:content') return VIRTUAL_CONTENT_ID
      },

      load(id) {
        if (id !== VIRTUAL_CONTENT_ID) return
        const contentDir = JSON.stringify(join(process.cwd(), 'content'))
        return [
          `import { readCollection as _rc, readEntry as _re } from '@waldjs/content'`,
          `const contentDir = ${contentDir}`,
          `export const getCollection = (name) => _rc(name, contentDir)`,
          `export const getEntry = (collection, slug) => _re(collection, slug, contentDir)`,
        ].join('\n')
      },
    },
  ]
}
```

- [ ] **Step 4: Run all tests to verify they pass**

```bash
pnpm --filter "@waldjs/compiler" test && pnpm --filter "@waldjs/cli" test
```

Expected: all tests pass — 52 compiler tests, 45+ CLI tests.

- [ ] **Step 5: Commit**

```bash
git add packages/cli/src/vite-plugin.ts packages/cli/src/vite-plugin.test.ts
git commit -m "feat(cli): add error handling to Vite plugin with line number support"
```
