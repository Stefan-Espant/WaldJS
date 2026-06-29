# Phase 4a — Vite Plugin Design

## Overview

Add an internal Vite plugin to `@waldjs/cli` that transforms `.wald` files using the existing WaldJS compiler. This is the foundational piece for Phase 4b (wiring Vite into `wald grow` and `wald build`). Phase 4a delivers an isolated, tested unit with no changes to CLI commands.

## Scope

**In scope:**
- `packages/cli/src/vite-plugin.ts` — Vite plugin with `transform` hook
- `packages/cli/src/vite-plugin.test.ts` — unit tests
- `packages/compiler/src/parser/frontmatter.ts` — extend thrown error with `line` property
- `packages/compiler/src/parser/frontmatter.test.ts` — test for `line` on error

**Out of scope:**
- Wiring the plugin into `wald grow` or `wald build` (Phase 4b)
- `wald.config.ts` support (Phase 4b)
- CSS bundling, HMR, asset pipeline (Phase 4b, depends on grow/build wiring)
- No new monorepo packages

## Architecture

The plugin lives in `packages/cli/src/vite-plugin.ts` and is not exported from the package's public API — it is internal to the CLI. `vite` is added as a devDependency of `@waldjs/cli` for the `Plugin` type.

```
packages/cli/
  src/
    vite-plugin.ts      ← new
    vite-plugin.test.ts ← new

packages/compiler/
  src/
    parser/
      frontmatter.ts    ← extend error with `line`
      frontmatter.test.ts ← new assertion
```

## The Plugin

```ts
import { compile } from '@waldjs/compiler'
import type { Plugin } from 'vite'

export function waldPlugin(): Plugin {
  return {
    name: 'waldjs',
    transform(code, id) {
      if (!id.endsWith('.wald')) return
      try {
        return { code: compile(code, id), map: null }
      } catch (e) {
        this.error({
          message: `[waldjs] ${e instanceof Error ? e.message : String(e)}`,
          loc: 'line' in (e as object) ? { line: (e as { line: number }).line, column: 0 } : undefined,
        })
      }
    }
  }
}
```

- Non-`.wald` files return `undefined` — Vite skips them
- Source maps: `null` — the compiler does not generate them; Vite accepts this
- Errors: caught and re-emitted via `this.error()` so Vite shows them in the terminal and browser overlay with filename and (when available) line number

## Compiler Error Enhancement

`packages/compiler/src/parser/frontmatter.ts` currently throws:
```ts
throw new Error('Unclosed frontmatter block — missing closing ---')
```

Extended to carry `line`. The parser splits on `\n` to find the closing `---`, so the current line index is already available:

```ts
const lines = source.split('\n')
let lineIndex = 1
for (; lineIndex < lines.length; lineIndex++) {
  if (lines[lineIndex].trimEnd() === '---') break
}
if (lineIndex === lines.length) {
  const err = Object.assign(
    new Error('Unclosed frontmatter block — missing closing ---'),
    { line: lineIndex }
  )
  throw err
}
```

## Testing

The `transform` hook is a plain function — tests call it directly with a mocked plugin context. No Vite server is needed.

```ts
import { waldPlugin } from './vite-plugin.js'
import type { Plugin } from 'vite'

function callTransform(code: string, id: string, ctx: object = {}) {
  const plugin = waldPlugin() as Plugin & { transform: Function }
  return plugin.transform.call(ctx, code, id)
}

describe('waldPlugin — transform', () => {
  it('transforms .wald source into compiled JS', () => {
    const result = callTransform('---\n---\n<h1>Hi</h1>', 'test.wald')
    expect(result.code).toContain('createTree')
  })

  it('returns undefined for non-.wald files', () => {
    const result = callTransform('export default {}', 'test.ts')
    expect(result).toBeUndefined()
  })

  it('calls this.error with [waldjs] prefix when compiler throws', () => {
    const mockError = vi.fn()
    callTransform('---\nno closing', 'bad.wald', { error: mockError })
    expect(mockError).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining('[waldjs]') })
    )
  })

  it('passes line number to this.error when compiler provides it', () => {
    const mockError = vi.fn()
    callTransform('---\nno closing', 'bad.wald', { error: mockError })
    expect(mockError).toHaveBeenCalledWith(
      expect.objectContaining({ loc: expect.objectContaining({ line: expect.any(Number) }) })
    )
  })
})
```

Compiler test addition in `frontmatter.test.ts`:
```ts
it('includes line number on thrown error for unclosed frontmatter', () => {
  expect(() => parseFrontmatter('---\nconst x = 1\n')).toThrow(
    expect.objectContaining({ line: expect.any(Number) })
  )
})
```

## Acceptance Criteria

- `waldPlugin()` returns a Vite plugin with `name: 'waldjs'`
- `.wald` files are compiled and returned as `{ code, map: null }`
- All other file extensions are ignored (return `undefined`)
- Compiler errors surface via `this.error()` with `[waldjs]` prefix
- Compiler includes `line` on frontmatter errors; plugin passes it as `loc`
- All existing tests continue to pass
- New tests: 4 plugin tests + 1 compiler test
