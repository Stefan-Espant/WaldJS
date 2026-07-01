# DX Error Messages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Throw `WaldError` (with file, line, column) from the WaldJS scanner for the three most common template mistakes — unclosed `{expression}`, unclosed `"string attribute`, and unclosed `<tag` — so Vite renders a caret-highlighted error instead of a silent failure or raw stack trace.

**Architecture:** A new `WaldError` class (extends `Error`, adds `line`, `column`, `file`) lives in `packages/compiler/src/errors.ts`. The scanner throws it at the exact character offset of the mistake; `offsetToLineCol()` converts that offset to 1-based line/column at throw time. `compile()` catches the error, sets `file`, and re-throws. The Vite plugin already checks for `line` on caught errors — we extend it to also pass `column` (converted from 1-based to Vite's 0-based).

**Tech Stack:** TypeScript, Vitest, Vite plugin API (`this.error({ message, loc })`), pnpm monorepo (Turborepo).

---

## File map

| File | Action |
|---|---|
| `packages/compiler/src/errors.ts` | **Create** — `WaldError` class + `offsetToLineCol` helper |
| `packages/compiler/src/errors.test.ts` | **Create** — unit tests for both exports |
| `packages/compiler/src/index.ts` | **Modify** — export `WaldError` |
| `packages/compiler/src/parser/scanner.ts` | **Modify** — throw `WaldError` in 3 error paths |
| `packages/compiler/src/parser/scanner.test.ts` | **Modify** — add 3 error test cases |
| `packages/compiler/src/compile.ts` | **Modify** — catch and re-throw `WaldError` with `file` |
| `packages/compiler/src/compile.test.ts` | **Modify** — test error propagation |
| `packages/cli/src/vite-plugin.ts` | **Modify** — extract `column` from caught error |
| `packages/cli/src/vite-plugin.test.ts` | **Modify** — test `column` is passed to `this.error` |

---

## Task 1: WaldError class + offsetToLineCol

**Files:**
- Create: `packages/compiler/src/errors.ts`
- Create: `packages/compiler/src/errors.test.ts`
- Modify: `packages/compiler/src/index.ts`

- [ ] **Step 1: Write the failing tests**

Create `packages/compiler/src/errors.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { WaldError, offsetToLineCol } from './errors.js'

describe('WaldError', () => {
  it('is an instance of Error', () => {
    const err = new WaldError('oops', 3, 7)
    expect(err).toBeInstanceOf(Error)
  })

  it('has name WaldError', () => {
    const err = new WaldError('oops', 3, 7)
    expect(err.name).toBe('WaldError')
  })

  it('exposes line and column', () => {
    const err = new WaldError('oops', 3, 7)
    expect(err.line).toBe(3)
    expect(err.column).toBe(7)
  })

  it('file is undefined by default', () => {
    const err = new WaldError('oops', 1, 1)
    expect(err.file).toBeUndefined()
  })

  it('file can be set after construction', () => {
    const err = new WaldError('oops', 1, 1)
    err.file = '/src/page.wald'
    expect(err.file).toBe('/src/page.wald')
  })
})

describe('offsetToLineCol', () => {
  it('returns line 1 column 1 for offset 0', () => {
    expect(offsetToLineCol('hello', 0)).toEqual({ line: 1, column: 1 })
  })

  it('returns line 1 column 4 for offset 3 on first line', () => {
    expect(offsetToLineCol('hello', 3)).toEqual({ line: 1, column: 4 })
  })

  it('returns line 2 column 1 for character after first newline', () => {
    expect(offsetToLineCol('line1\nline2', 6)).toEqual({ line: 2, column: 1 })
  })

  it('returns line 2 column 4 for offset into second line', () => {
    expect(offsetToLineCol('abc\ndef', 7)).toEqual({ line: 2, column: 4 })
  })

  it('handles offset at end of source', () => {
    const src = 'ab\ncd'
    expect(offsetToLineCol(src, src.length)).toEqual({ line: 2, column: 3 })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm --filter @waldjs/compiler test
```

Expected: FAIL — `Cannot find module './errors.js'`

- [ ] **Step 3: Create errors.ts**

Create `packages/compiler/src/errors.ts`:

```typescript
export class WaldError extends Error {
  readonly line: number
  readonly column: number
  file?: string

  constructor(message: string, line: number, column: number) {
    super(message)
    this.name = 'WaldError'
    this.line = line
    this.column = column
  }
}

export function offsetToLineCol(source: string, offset: number): { line: number; column: number } {
  const before = source.slice(0, offset)
  const lines = before.split('\n')
  return {
    line: lines.length,
    column: lines[lines.length - 1].length + 1,
  }
}
```

- [ ] **Step 4: Export WaldError from compiler index**

Modify `packages/compiler/src/index.ts`:

```typescript
export { parse } from './parser/index.js'
export { transform } from './transform/index.js'
export { compile } from './compile.js'
export { WaldError } from './errors.js'
export type * from './ast/types.js'
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
pnpm --filter @waldjs/compiler test
```

Expected: all existing tests + new errors tests PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/compiler/src/errors.ts packages/compiler/src/errors.test.ts packages/compiler/src/index.ts
git commit -m "feat(compiler): add WaldError class and offsetToLineCol helper"
```

---

## Task 2: Scanner — throw on unclosed expression `{`

**Files:**
- Modify: `packages/compiler/src/parser/scanner.ts`
- Modify: `packages/compiler/src/parser/scanner.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `packages/compiler/src/parser/scanner.test.ts` (at the end of the file):

```typescript
import { WaldError } from '../errors.js'

describe('scanTemplate — errors', () => {
  it('throws WaldError for unclosed expression {', () => {
    expect(() => scanTemplate('{title')).toThrow(WaldError)
  })

  it('unclosed expression error points to the opening {', () => {
    let caught: WaldError | undefined
    try { scanTemplate('{title') } catch (e) { caught = e as WaldError }
    expect(caught?.message).toContain("Unclosed expression")
    expect(caught?.message).toContain("'}'")
    expect(caught?.line).toBe(1)
    expect(caught?.column).toBe(1)
  })

  it('unclosed expression on line 2 reports correct line', () => {
    let caught: WaldError | undefined
    try { scanTemplate('<p>ok</p>\n<h1>{oops') } catch (e) { caught = e as WaldError }
    expect(caught?.line).toBe(2)
    expect(caught?.column).toBe(5)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm --filter @waldjs/compiler test
```

Expected: FAIL — the scanner does not throw, tests asserting `toThrow` fail.

- [ ] **Step 3: Implement the throw in scanExpression()**

In `packages/compiler/src/parser/scanner.ts`, add the import at the top:

```typescript
import { WaldError, offsetToLineCol } from '../errors.js'
```

Then modify `scanExpression()`:

```typescript
scanExpression(): TemplateNode {
  const openPos = this.pos
  this.advance() // consume {
  let code = ''
  let depth = 1
  while (this.pos < this.source.length && depth > 0) {
    const ch = this.advance()
    if (ch === '{') depth++
    else if (ch === '}') depth--
    if (depth > 0) code += ch
  }
  if (depth > 0) {
    const { line, column } = offsetToLineCol(this.source, openPos)
    throw new WaldError(`Unclosed expression: expected '}'`, line, column)
  }
  return { type: 'expression', code: code.trim() }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm --filter @waldjs/compiler test
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/compiler/src/parser/scanner.ts packages/compiler/src/parser/scanner.test.ts
git commit -m "feat(compiler): throw WaldError on unclosed expression"
```

---

## Task 3: Scanner — throw on unclosed attribute string `"`

**Files:**
- Modify: `packages/compiler/src/parser/scanner.ts`
- Modify: `packages/compiler/src/parser/scanner.test.ts`

- [ ] **Step 1: Write the failing tests**

Add inside the existing `describe('scanTemplate — errors', ...)` block in `packages/compiler/src/parser/scanner.test.ts`:

```typescript
  it('throws WaldError for unclosed string attribute', () => {
    expect(() => scanTemplate('<div class="oops')).toThrow(WaldError)
  })

  it('unclosed string attribute error points to the opening quote', () => {
    let caught: WaldError | undefined
    try { scanTemplate('<div class="oops') } catch (e) { caught = e as WaldError }
    expect(caught?.message).toContain("Unclosed string attribute")
    expect(caught?.message).toContain("'\"'")
    expect(caught?.line).toBe(1)
    expect(caught?.column).toBe(12)
  })
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm --filter @waldjs/compiler test
```

Expected: FAIL — scanner silently returns without throwing.

- [ ] **Step 3: Implement the throw in scanAttribute()**

In `packages/compiler/src/parser/scanner.ts`, modify the `"` branch of `scanAttribute()`:

```typescript
if ((this.current as string) === '"') {
  const quotePos = this.pos
  this.advance() // consume opening "
  let value = ''
  while (this.pos < this.source.length && (this.current as string) !== '"') {
    value += this.advance()
  }
  if (this.pos >= this.source.length) {
    const { line, column } = offsetToLineCol(this.source, quotePos)
    throw new WaldError(`Unclosed string attribute: expected '"'`, line, column)
  }
  this.advance() // consume closing "
  return { type: 'attribute', name, value }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm --filter @waldjs/compiler test
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/compiler/src/parser/scanner.ts packages/compiler/src/parser/scanner.test.ts
git commit -m "feat(compiler): throw WaldError on unclosed string attribute"
```

---

## Task 4: Scanner — throw on unclosed tag `<tag`

**Files:**
- Modify: `packages/compiler/src/parser/scanner.ts`
- Modify: `packages/compiler/src/parser/scanner.test.ts`

- [ ] **Step 1: Write the failing tests**

Add inside `describe('scanTemplate — errors', ...)` in `packages/compiler/src/parser/scanner.test.ts`:

```typescript
  it('throws WaldError for unclosed element tag', () => {
    expect(() => scanTemplate('<div')).toThrow(WaldError)
  })

  it('unclosed tag error includes the tag name and points to <', () => {
    let caught: WaldError | undefined
    try { scanTemplate('<div') } catch (e) { caught = e as WaldError }
    expect(caught?.message).toContain("<div>")
    expect(caught?.message).toContain("'>'")
    expect(caught?.line).toBe(1)
    expect(caught?.column).toBe(1)
  })

  it('unclosed tag on line 3 reports correct position', () => {
    let caught: WaldError | undefined
    try { scanTemplate('<p>ok</p>\n<span>ok</span>\n<section') } catch (e) { caught = e as WaldError }
    expect(caught?.line).toBe(3)
    expect(caught?.column).toBe(1)
  })
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm --filter @waldjs/compiler test
```

Expected: FAIL — scanner does not throw on `<div` without `>`.

- [ ] **Step 3: Implement the throw in scanElement()**

In `packages/compiler/src/parser/scanner.ts`, modify `scanElement()` to save `openPos` and throw when end-of-source is reached after scanning attributes:

```typescript
private scanElement(): ElementNode | ComponentNode {
  const openPos = this.pos
  this.advance() // consume <
  const tag = this.scanIdentifier()
  const attrs = this.scanAttributes()

  if (this.pos >= this.source.length) {
    const { line, column } = offsetToLineCol(this.source, openPos)
    throw new WaldError(`Unclosed tag '<${tag}>': expected '>' or '/>'`, line, column)
  }

  if (this.current === '/' && this.peek(1) === '>') {
    this.advance() // /
    this.advance() // >
    if (/^[A-Z]/.test(tag)) {
      return { type: 'component', name: tag, attrs, children: [] }
    }
    return { type: 'element', tag, attrs, children: [] }
  }

  if (this.current === '>') this.advance()

  const children = this.scanNodes()

  if (this.current === '<' && this.peek(1) === '/') {
    this.advance() // <
    this.advance() // /
    while (this.pos < this.source.length && (this.current as string) !== '>') this.advance()
    this.advance() // >
  }

  if (/^[A-Z]/.test(tag)) {
    return { type: 'component', name: tag, attrs, children }
  }
  return { type: 'element', tag, attrs, children }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm --filter @waldjs/compiler test
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/compiler/src/parser/scanner.ts packages/compiler/src/parser/scanner.test.ts
git commit -m "feat(compiler): throw WaldError on unclosed element tag"
```

---

## Task 5: compile() re-throw + Vite plugin column

**Files:**
- Modify: `packages/compiler/src/compile.ts`
- Modify: `packages/compiler/src/compile.test.ts`
- Modify: `packages/cli/src/vite-plugin.ts`
- Modify: `packages/cli/src/vite-plugin.test.ts`

- [ ] **Step 1: Write failing tests for compile()**

Add to `packages/compiler/src/compile.test.ts`:

```typescript
import { WaldError } from './errors.js'

describe('compile — error propagation', () => {
  it('throws WaldError with file set when scanner fails', () => {
    let caught: WaldError | undefined
    try {
      compile('---\n---\n{unclosed', '/src/page.wald')
    } catch (e) {
      caught = e as WaldError
    }
    expect(caught).toBeInstanceOf(WaldError)
    expect(caught?.file).toBe('/src/page.wald')
  })

  it('preserves line and column from scanner', () => {
    let caught: WaldError | undefined
    try {
      compile('---\n---\n{unclosed', '/src/page.wald')
    } catch (e) {
      caught = e as WaldError
    }
    expect(caught?.line).toBeGreaterThan(0)
    expect(caught?.column).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 2: Write failing test for Vite plugin column**

Add to `packages/cli/src/vite-plugin.test.ts` (inside `describe('vite-plugin-wald', ...)`):

```typescript
  it('passes column to this.error when compiler throws WaldError', () => {
    const mockError = callTransformWithMock('---\n---\n{unclosed', 'bad.wald')
    expect(mockError).toHaveBeenCalledWith(
      expect.objectContaining({
        loc: expect.objectContaining({
          line: expect.any(Number),
          column: expect.any(Number),
        }),
      })
    )
  })
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
pnpm --filter @waldjs/compiler test && pnpm --filter @waldjs/cli test
```

Expected: compiler tests FAIL (file is undefined on error), CLI tests FAIL (column not in loc).

- [ ] **Step 4: Update compile.ts**

Replace `packages/compiler/src/compile.ts` entirely:

```typescript
import { parse } from './parser/index.js'
import { transform } from './transform/index.js'
import { WaldError } from './errors.js'

export function compile(source: string, id: string): string {
  try {
    const ast = parse(source)
    return transform(ast)
  } catch (e) {
    if (e instanceof WaldError) {
      e.file = id
    }
    throw e
  }
}
```

- [ ] **Step 5: Update vite-plugin.ts**

In `packages/cli/src/vite-plugin.ts`, replace the `loc` extraction inside `transform()`:

```typescript
transform(code, id) {
  if (!id.endsWith('.wald')) return
  try {
    return { code: compile(code, id), map: null }
  } catch (e) {
    const message = `[waldjs] ${e instanceof Error ? e.message : String(e)}`
    const loc = typeof e === 'object' && e !== null && 'line' in e
      ? {
          line: (e as { line: number }).line,
          column: 'column' in e ? (e as { column: number }).column - 1 : 0,
        }
      : undefined
    this.error({ message, loc })
  }
},
```

- [ ] **Step 6: Run all tests**

```bash
pnpm test
```

Expected: all packages PASS. Check the count includes the new tests:
- `@waldjs/compiler`: errors.test.ts (7) + scanner errors (6) + compile errors (2) + existing passing
- `@waldjs/cli`: column test (1) + existing passing

- [ ] **Step 7: Commit**

```bash
git add packages/compiler/src/compile.ts packages/compiler/src/compile.test.ts packages/cli/src/vite-plugin.ts packages/cli/src/vite-plugin.test.ts
git commit -m "feat: wire WaldError through compile() and Vite plugin with column support"
```
