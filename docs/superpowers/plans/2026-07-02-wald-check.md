# `wald check` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A `wald check` command (plus `wald build --check`) that type-checks `.wald` and `.ts` files, reporting errors at original `.wald` line/column positions.

**Architecture:** The compiler gains `transformWithMap`/`compileWithMap`, which return a line map (output line → original `.wald` line) alongside the code. A new checker module in the CLI builds a `ts.Program` with a custom `CompilerHost` that serves compiled `.wald` files as virtual `.wald.ts` files, collects diagnostics, and remaps positions. A citty `check` subcommand renders diagnostics in the existing WaldError caret style.

**Tech Stack:** TypeScript Compiler API (`typescript` package), citty, vitest. pnpm monorepo — run tests per package with `cd packages/<pkg> && pnpm test`.

---

## File Map

| File | Change |
|---|---|
| `packages/compiler/src/parser/frontmatter.ts` | Return `line` (1-based .wald line where frontmatter code starts) |
| `packages/compiler/src/parser/index.ts` | Pass `line` into the frontmatter AST node |
| `packages/compiler/src/ast/types.ts` | Add optional `line?: number` to the frontmatter node type |
| `packages/compiler/src/transform/index.ts` | Add `transformWithMap`; `transform` delegates to it |
| `packages/compiler/src/compile.ts` | Add `compileWithMap`; `compile` delegates to it |
| `packages/compiler/src/index.ts` | Export `transformWithMap`, `compileWithMap` |
| `packages/cli/src/checker.ts` | NEW — `checkProject(root)` with virtual CompilerHost |
| `packages/cli/src/commands/check.ts` | NEW — `checkCommand`, `runCheck`, `renderDiagnostic` |
| `packages/cli/src/cli.ts` | Register `check` subcommand |
| `packages/cli/src/commands/build.ts` | Add `--check` flag |
| `packages/cli/package.json` | Move `typescript` from devDependencies to dependencies |

---

## Task 1: Parser — frontmatter code start line

**Files:**
- Modify: `packages/compiler/src/parser/frontmatter.ts`
- Modify: `packages/compiler/src/parser/index.ts`
- Modify: `packages/compiler/src/ast/types.ts`
- Test: `packages/compiler/src/parser/frontmatter.test.ts`

### Context

`extractFrontmatter` currently returns `{ code, rest }`. The line map (Task 2) needs to know which `.wald` line the frontmatter code starts on. For the standard case (`---` on line 1, code from line 2) that is line 2, but leading blank lines before `---` or blank lines between `---` and the first code line shift it.

Current `packages/compiler/src/parser/frontmatter.ts`:

```typescript
export type FrontmatterResult = {
  code: string
  rest: string
}

const DELIMITER = '---'

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

- [ ] **Step 1: Write the failing tests**

Add to `packages/compiler/src/parser/frontmatter.test.ts`:

```typescript
describe('extractFrontmatter — code start line', () => {
  it('reports line 2 for standard frontmatter', () => {
    const result = extractFrontmatter('---\nconst x = 1\n---\n<p>hi</p>')
    expect(result.line).toBe(2)
  })

  it('accounts for blank lines before the opening delimiter', () => {
    const result = extractFrontmatter('\n\n---\nconst x = 1\n---\n<p>hi</p>')
    expect(result.line).toBe(4)
  })

  it('accounts for blank lines between delimiter and first code line', () => {
    const result = extractFrontmatter('---\n\n\nconst x = 1\n---\n<p>hi</p>')
    expect(result.line).toBe(4)
  })

  it('returns line 1 when there is no frontmatter', () => {
    const result = extractFrontmatter('<p>hi</p>')
    expect(result.line).toBe(1)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/compiler && pnpm test`
Expected: FAIL — `line` is `undefined`.

- [ ] **Step 3: Implement**

Replace `packages/compiler/src/parser/frontmatter.ts` with:

```typescript
export type FrontmatterResult = {
  code: string
  rest: string
  line: number
}

const DELIMITER = '---'

export function extractFrontmatter(source: string): FrontmatterResult {
  const trimmed = source.trimStart()

  if (!trimmed.startsWith(DELIMITER)) {
    return { code: '', rest: source, line: 1 }
  }

  const leadingNewlines = (source.slice(0, source.length - trimmed.length).match(/\n/g) ?? []).length

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

  const rawCode = afterFirst.slice(0, end)
  const codeLeadingNewlines = (rawCode.slice(0, rawCode.length - rawCode.trimStart().length).match(/\n/g) ?? []).length
  const line = leadingNewlines + 1 + codeLeadingNewlines

  const code = rawCode.trim()
  const rest = afterFirst.slice(end + DELIMITER.length + 1).trimStart()

  return { code, rest, line }
}
```

(The delimiter sits on line `leadingNewlines + 1`; each newline in the raw code's leading whitespace advances one line to the first code line.)

- [ ] **Step 4: Wire into the AST**

In `packages/compiler/src/ast/types.ts`, add `line?: number` to the frontmatter node type. Find the type that contains `type: 'frontmatter'` and `code: string`, and add the optional field:

```typescript
export type FrontmatterNode = {
  type: 'frontmatter'
  code: string
  line?: number
}
```

(If the frontmatter shape is declared inline inside `WaldDocument`, add `line?: number` there instead.)

In `packages/compiler/src/parser/index.ts`, find where the frontmatter node is constructed from `extractFrontmatter`'s result and include the line:

```typescript
frontmatter: { type: 'frontmatter', code: fm.code, line: fm.line },
```

(Adjust the variable name to whatever the file uses for the `extractFrontmatter` result.)

- [ ] **Step 5: Run all compiler tests**

Run: `cd packages/compiler && pnpm test`
Expected: all pass, including the 4 new ones. Existing tests that build `WaldDocument` literals without `line` still compile because the field is optional.

- [ ] **Step 6: Commit**

```bash
git add packages/compiler/src/parser/frontmatter.ts packages/compiler/src/parser/frontmatter.test.ts packages/compiler/src/parser/index.ts packages/compiler/src/ast/types.ts
git commit -m "feat(compiler): track frontmatter code start line in parser"
```

---

## Task 2: Compiler — `transformWithMap`

**Files:**
- Modify: `packages/compiler/src/transform/index.ts`
- Test: `packages/compiler/src/transform/index.test.ts`

### Context

`transform(ast)` currently builds the output by joining a `parts` array where some entries are multi-line strings (hoisted blocks, body, template). `transformWithMap` must emit line-by-line, producing `lineMap` where `lineMap[i]` is the original 1-based `.wald` line for output line `i + 1`, or `null` for generated lines.

**Output identity is a hard requirement:** `transform(ast)` must return byte-identical output to today. The existing exact-output test (`produces correct full output for a single-line Props type`) pins this. The current quirks to reproduce:

- Body is `.trim()`ed as a whole joined string: leading/trailing whitespace-only lines drop, the first kept line loses leading whitespace, the last kept line loses trailing whitespace.
- Non-Props with empty body: `bodyContent` is `''`, which still produces one empty output line.
- Props with empty body: `filter(Boolean)` removes the empty body, leaving only the alias line.
- Hoisted section only appears (with trailing blank line) when non-empty.
- The template line `  return renderTemplate\`...\`` can span multiple physical lines when the template contains newlines — every one of those lines maps to `null`.

Original line computation: `extractExports`'s routing loop processes frontmatter code line-by-line with index `i`; the frontmatter-relative line is `i + 1`, and the `.wald` line is `i + 1 + (ast.frontmatter.line ?? 2) - 1` = `i + (ast.frontmatter.line ?? 2)`.

- [ ] **Step 1: Write the failing tests**

Add to `packages/compiler/src/transform/index.test.ts`:

```typescript
import { transformWithMap } from './index.js'

describe('transformWithMap', () => {
  const doc = (code: string, line = 2): WaldDocument => ({
    type: 'document',
    frontmatter: { type: 'frontmatter', code, line },
    template: [],
  })

  it('returns the same code as transform', () => {
    const ast = doc('type Props = { title: string }\nconst { title } = $props')
    expect(transformWithMap(ast).code).toBe(transform(ast))
  })

  it('maps hoisted type Props to its original line', () => {
    const ast = doc('type Props = { title: string }\nconst { title } = $props')
    const { code, lineMap } = transformWithMap(ast)
    const lines = code.split('\n')
    const propsIdx = lines.findIndex(l => l.startsWith('type Props'))
    expect(lineMap[propsIdx]).toBe(2)
  })

  it('maps body lines to their original lines, after the injected alias', () => {
    const ast = doc('type Props = { title: string }\nconst { title } = $props')
    const { code, lineMap } = transformWithMap(ast)
    const lines = code.split('\n')
    const bodyIdx = lines.findIndex(l => l.includes('const { title } = $props'))
    expect(lineMap[bodyIdx]).toBe(3)
  })

  it('maps generated lines (import, signature, alias, return) to null', () => {
    const ast = doc('type Props = { title: string }\nconst { title } = $props')
    const { code, lineMap } = transformWithMap(ast)
    const lines = code.split('\n')
    expect(lineMap[0]).toBe(null) // runtime import
    expect(lineMap[lines.findIndex(l => l.startsWith('export default createTree'))]).toBe(null)
    expect(lineMap[lines.findIndex(l => l.includes('const $props = $$props'))]).toBe(null)
    expect(lineMap[lines.findIndex(l => l.includes('return renderTemplate'))]).toBe(null)
  })

  it('maps multi-line type Props line by line', () => {
    const ast = doc('type Props = {\n  title: string\n}\nconst x = 1')
    const { code, lineMap } = transformWithMap(ast)
    const lines = code.split('\n')
    const start = lines.findIndex(l => l.startsWith('type Props'))
    expect(lineMap[start]).toBe(2)
    expect(lineMap[start + 1]).toBe(3)
    expect(lineMap[start + 2]).toBe(4)
  })

  it('respects a custom frontmatter start line', () => {
    const ast = doc('const x = 1', 5)
    const { code, lineMap } = transformWithMap(ast)
    const lines = code.split('\n')
    const idx = lines.findIndex(l => l.includes('const x = 1'))
    expect(lineMap[idx]).toBe(5)
  })

  it('lineMap has exactly one entry per output line', () => {
    const ast = doc('type Props = { title: string }\nconst { title } = $props')
    const { code, lineMap } = transformWithMap(ast)
    expect(lineMap.length).toBe(code.split('\n').length)
  })
})
```

Also add identity tests against the existing suite's fixtures:

```typescript
describe('transformWithMap — output identity with transform', () => {
  it.each([
    ['empty frontmatter', ''],
    ['plain body', 'const title = "Hello"'],
    ['import + body', "import Card from './Card.wald'\nconst t = 'x'"],
    ['export + body', 'export async function getStaticPaths() {\n  return []\n}\nconst x = 1'],
    ['props + body', 'type Props = { title: string }\nconst { title } = $props'],
    ['props only', 'type Props = { title: string }'],
  ])('%s', (_name, code) => {
    const ast: WaldDocument = {
      type: 'document',
      frontmatter: { type: 'frontmatter', code },
      template: [{ type: 'element', tag: 'h1', attrs: [], children: [{ type: 'expression', code: 'title' }] }],
    }
    expect(transformWithMap(ast).code).toBe(transform(ast))
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/compiler && pnpm test`
Expected: FAIL — `transformWithMap` is not exported.

- [ ] **Step 3: Implement**

In `packages/compiler/src/transform/index.ts`, replace `transform` and `extractExports` with:

```typescript
type MappedLine = { text: string; srcLine: number }

export function transform(ast: WaldDocument): string {
  return transformWithMap(ast).code
}

export function transformWithMap(ast: WaldDocument): { code: string; lineMap: (number | null)[] } {
  const templateCode = renderNodes(ast.template)
  const code = ast.frontmatter.code ?? ''
  const fmStart = ast.frontmatter.line ?? 2
  const { hoisted, body, hasProps } = splitFrontmatter(code)

  const out: string[] = []
  const map: (number | null)[] = []
  const push = (text: string, src: number | null) => {
    out.push(text)
    map.push(src)
  }
  const pushGenerated = (text: string) => {
    for (const line of text.split('\n')) push(line, null)
  }

  push(`import { createTree, renderTemplate, SafeHtml } from '@waldjs/runtime'`, null)
  push(``, null)

  if (hoisted.length > 0) {
    for (const l of hoisted) push(l.text, l.srcLine + fmStart - 1)
    push(``, null)
  }

  push(
    hasProps
      ? `export default createTree<Props>(async ($$result, $$props: Props) => {`
      : `export default createTree(async ($$result, $$props) => {`,
    null,
  )

  if (hasProps) {
    push(`  const $props = $$props`, null)
    for (const l of body) push(`  ${l.text}`, l.srcLine + fmStart - 1)
  } else if (body.length > 0) {
    for (const l of body) push(`  ${l.text}`, l.srcLine + fmStart - 1)
  } else {
    push(``, null)
  }

  push(``, null)
  pushGenerated(`  return renderTemplate\`${templateCode}\``)
  push(`})`, null)

  return { code: out.join('\n'), lineMap: map }
}

function splitFrontmatter(code: string): { hoisted: MappedLine[]; body: MappedLine[]; hasProps: boolean } {
  const lines = code.split('\n')
  const hoisted: MappedLine[] = []
  const body: MappedLine[] = []
  let hasProps = false
  let i = 0

  while (i < lines.length) {
    const trimmed = lines[i].trimStart()
    if (trimmed.startsWith('import ')) {
      // import statements are always single-line in frontmatter
      hoisted.push({ text: lines[i], srcLine: i + 1 })
      i++
    } else if (/^(?:export\s+)?type Props\s*=/.test(trimmed)) {
      // collect until balanced braces, or just the first line if no braces present
      let depth = 0
      do {
        const line = lines[i]
        hoisted.push({ text: line, srcLine: i + 1 })
        depth += (line.match(/\{/g) ?? []).length - (line.match(/\}/g) ?? []).length
        i++
      } while (depth > 0 && i < lines.length)
      hasProps = true
    } else if (trimmed.startsWith('export ')) {
      // export blocks may span multiple lines — collect until balanced braces
      let depth = 0
      do {
        const line = lines[i]
        hoisted.push({ text: line, srcLine: i + 1 })
        depth += (line.match(/\{/g) ?? []).length - (line.match(/\}/g) ?? []).length
        i++
      } while (depth > 0 && i < lines.length)
    } else {
      body.push({ text: lines[i], srcLine: i + 1 })
      i++
    }
  }

  // Reproduce the old body.join('\n').trim() behavior line-by-line:
  // drop whitespace-only lines at both ends, strip edge whitespace of the
  // first and last kept line.
  while (body.length > 0 && body[0].text.trim() === '') body.shift()
  while (body.length > 0 && body[body.length - 1].text.trim() === '') body.pop()
  if (body.length > 0) {
    body[0] = { ...body[0], text: body[0].text.trimStart() }
    const last = body.length - 1
    body[last] = { ...body[last], text: body[last].text.trimEnd() }
  }

  return { hoisted, body, hasProps }
}
```

Leave `renderNodes` and everything below it unchanged.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/compiler && pnpm test`
Expected: ALL tests pass — including every pre-existing transform test (exact-output test included) and the new map tests. If any pre-existing test fails, the output is not identical: fix `transformWithMap`, do not touch the old tests.

- [ ] **Step 5: Commit**

```bash
git add packages/compiler/src/transform/index.ts packages/compiler/src/transform/index.test.ts
git commit -m "feat(compiler): add transformWithMap with output line map"
```

---

## Task 3: Compiler — `compileWithMap` + exports

**Files:**
- Modify: `packages/compiler/src/compile.ts`
- Modify: `packages/compiler/src/index.ts`
- Test: `packages/compiler/src/compile.test.ts`

- [ ] **Step 1: Write the failing tests**

Add to `packages/compiler/src/compile.test.ts`:

```typescript
import { compileWithMap } from './compile.js'

describe('compileWithMap', () => {
  it('returns code identical to compile plus a line map', () => {
    const source = `---
type Props = { title: string }
const { title } = $props
---
<h1>{title}</h1>`
    const result = compileWithMap(source, '/src/page.wald')
    expect(result.code).toBe(compile(source, '/src/page.wald'))
    expect(result.lineMap.length).toBe(result.code.split('\n').length)
  })

  it('maps a body line back to its .wald source line', () => {
    const source = `---
type Props = { title: string }
const { title } = $props
---
<h1>{title}</h1>`
    const { code, lineMap } = compileWithMap(source, '/src/page.wald')
    const lines = code.split('\n')
    const idx = lines.findIndex(l => l.includes('const { title } = $props'))
    expect(lineMap[idx]).toBe(3)
  })

  it('sets file on WaldError like compile does', () => {
    let caught: unknown
    try {
      compileWithMap('---\n---\n{unclosed', '/src/page.wald')
    } catch (e) {
      caught = e
    }
    expect((caught as { file?: string }).file).toBe('/src/page.wald')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/compiler && pnpm test`
Expected: FAIL — `compileWithMap` not exported.

- [ ] **Step 3: Implement**

Replace `packages/compiler/src/compile.ts` with:

```typescript
import { parse } from './parser/index.js'
import { transformWithMap } from './transform/index.js'
import { WaldError } from './errors.js'

export function compile(source: string, id: string): string {
  return compileWithMap(source, id).code
}

export function compileWithMap(
  source: string,
  id: string,
): { code: string; lineMap: (number | null)[] } {
  try {
    const ast = parse(source)
    return transformWithMap(ast)
  } catch (e) {
    if (e instanceof WaldError) {
      e.file = id
    }
    throw e
  }
}
```

Update `packages/compiler/src/index.ts`:

```typescript
export { parse } from './parser/index.js'
export { transform, transformWithMap } from './transform/index.js'
export { compile, compileWithMap } from './compile.js'
export { WaldError } from './errors.js'
export type * from './ast/types.js'
```

- [ ] **Step 4: Run tests + build**

Run: `cd packages/compiler && pnpm test && pnpm build`
Expected: all tests pass, `tsc` build clean.

- [ ] **Step 5: Commit**

```bash
git add packages/compiler/src/compile.ts packages/compiler/src/compile.test.ts packages/compiler/src/index.ts
git commit -m "feat(compiler): add compileWithMap and export map APIs"
```

---

## Task 4: CLI — checker module

**Files:**
- Create: `packages/cli/src/checker.ts`
- Modify: `packages/cli/package.json` (move `typescript` to dependencies)
- Test: `packages/cli/src/checker.test.ts`

### Context

`checkProject(root)` builds a `ts.Program` over `<root>/src/**/*.{wald,ts}`. `.wald` files are compiled in-memory with `compileWithMap` and served as virtual `<path>.wald.ts` files through CompilerHost overrides. An ambient `declare module 'wald:content'` shim (added as a virtual `.d.ts` root file) makes `wald:content` imports typecheck. `@waldjs/runtime` types are resolved from the CLI's own dependency via `createRequire`, so fixture projects in tests need no `node_modules`.

Relative `.wald` imports (`import Card from './Card.wald'`) resolve because TypeScript tries appending `.ts` — `./Card.wald.ts` — which the overridden `fileExists`/`readFile` report as existing.

Column remapping: body lines are emitted with a 2-space indent the original doesn't have. The checker compares leading whitespace of the output line and the original line and shifts the column by the difference.

**Prerequisite:** the compiler must be rebuilt so `compileWithMap` is available in `dist`: run `cd packages/compiler && pnpm build` first (turbo usually handles this, but do it explicitly).

- [ ] **Step 1: Move `typescript` to dependencies**

In `packages/cli/package.json`, move `"typescript": "^5.5.0"` from `devDependencies` to `dependencies`, then run `pnpm install` from the repo root.

- [ ] **Step 2: Write the failing tests**

Create `packages/cli/src/checker.test.ts`:

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { checkProject } from './checker.js'

function makeProject(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), 'wald-check-'))
  for (const [rel, content] of Object.entries(files)) {
    const full = join(root, rel)
    mkdirSync(join(full, '..'), { recursive: true })
    writeFileSync(full, content)
  }
  return root
}

const roots: string[] = []
afterAll(() => {
  for (const r of roots) rmSync(r, { recursive: true, force: true })
})

describe('checkProject', () => {
  it('returns empty array for a clean project', () => {
    const root = makeProject({
      'src/pages/index.wald': `---
type Props = { title: string }
const { title } = $props
---
<h1>{title}</h1>`,
    })
    roots.push(root)
    expect(checkProject(root)).toEqual([])
  })

  it('reports a props type error at the original .wald line', () => {
    const root = makeProject({
      'src/pages/index.wald': `---
type Props = { title: string }
const { subtitle } = $props
---
<h1>{subtitle}</h1>`,
    })
    roots.push(root)
    const diags = checkProject(root)
    expect(diags.length).toBeGreaterThan(0)
    expect(diags[0].file).toBe(join(root, 'src/pages/index.wald'))
    expect(diags[0].line).toBe(3)
    expect(diags[0].message).toContain('subtitle')
  })

  it('reports errors in plain .ts files untouched', () => {
    const root = makeProject({
      'src/util.ts': `export const n: number = 'not a number'\n`,
    })
    roots.push(root)
    const diags = checkProject(root)
    expect(diags.length).toBe(1)
    expect(diags[0].file).toBe(join(root, 'src/util.ts'))
    expect(diags[0].line).toBe(1)
  })

  it('resolves .wald-to-.wald imports', () => {
    const root = makeProject({
      'src/components/Card.wald': `---
type Props = { label: string }
const { label } = $props
---
<span>{label}</span>`,
      'src/pages/index.wald': `---
import Card from '../components/Card.wald'
---
<Card label="hi" />`,
    })
    roots.push(root)
    expect(checkProject(root)).toEqual([])
  })

  it('accepts wald:content imports via the shim', () => {
    const root = makeProject({
      'src/pages/blog.wald': `---
import { getCollection } from 'wald:content'
const posts = await getCollection('blog')
---
<p>{posts.length}</p>`,
    })
    roots.push(root)
    expect(checkProject(root)).toEqual([])
  })
})
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd packages/cli && pnpm test`
Expected: FAIL — `./checker.js` does not exist.

- [ ] **Step 4: Implement**

Create `packages/cli/src/checker.ts`:

```typescript
import ts from 'typescript'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { compileWithMap } from '@waldjs/compiler'

export interface CheckDiagnostic {
  file: string
  line: number
  column: number
  message: string
}

const CONTENT_SHIM = `declare module 'wald:content' {
  export type Entry = {
    slug: string
    data: Record<string, unknown>
    body: string
  }
  export function getCollection(name: string): Promise<Entry[]>
  export function getEntry(collection: string, slug: string): Promise<Entry>
}
`

type VirtualFile = {
  code: string
  lineMap: (number | null)[]
  original: string
  originalSource: string
}

export function checkProject(root: string): CheckDiagnostic[] {
  const srcDir = join(root, 'src')
  const waldFiles = existsSync(srcDir) ? findFiles(srcDir, '.wald') : []
  const tsFiles = existsSync(srcDir) ? findFiles(srcDir, '.ts') : []

  const virtuals = new Map<string, VirtualFile>()
  for (const file of waldFiles) {
    const source = readFileSync(file, 'utf-8')
    const { code, lineMap } = compileWithMap(source, file)
    virtuals.set(`${file}.ts`, { code, lineMap, original: file, originalSource: source })
  }

  const shimPath = join(root, '__wald_content__.d.ts')
  const options = loadTsOptions(root)
  const host = createVirtualHost(options, virtuals, shimPath)

  const rootNames = [...virtuals.keys(), ...tsFiles, shimPath]
  const program = ts.createProgram({ rootNames, options, host })

  const rootSet = new Set(rootNames.filter(f => f !== shimPath))
  const diagnostics: CheckDiagnostic[] = []

  for (const sf of program.getSourceFiles()) {
    if (!rootSet.has(sf.fileName)) continue
    const fileDiags = [
      ...program.getSyntacticDiagnostics(sf),
      ...program.getSemanticDiagnostics(sf),
    ]
    for (const diag of fileDiags) {
      if (diag.file === undefined || diag.start === undefined) continue
      diagnostics.push(remapDiagnostic(diag, virtuals))
    }
  }

  return diagnostics
}

function remapDiagnostic(
  diag: ts.Diagnostic,
  virtuals: Map<string, VirtualFile>,
): CheckDiagnostic {
  const sf = diag.file!
  const { line, character } = ts.getLineAndCharacterOfPosition(sf, diag.start!)
  const message = ts.flattenDiagnosticMessageText(diag.messageText, '\n')
  const virtual = virtuals.get(sf.fileName)

  if (!virtual) {
    return { file: sf.fileName, line: line + 1, column: character + 1, message }
  }

  const originalLine = virtual.lineMap[line]
  if (originalLine === null || originalLine === undefined) {
    return { file: virtual.original, line: 1, column: 1, message }
  }

  const outputLineText = virtual.code.split('\n')[line] ?? ''
  const originalLineText = virtual.originalSource.split('\n')[originalLine - 1] ?? ''
  const outIndent = outputLineText.length - outputLineText.trimStart().length
  const origIndent = originalLineText.length - originalLineText.trimStart().length
  const column = Math.max(1, character + 1 - (outIndent - origIndent))

  return { file: virtual.original, line: originalLine, column, message }
}

function createVirtualHost(
  options: ts.CompilerOptions,
  virtuals: Map<string, VirtualFile>,
  shimPath: string,
): ts.CompilerHost {
  const host = ts.createCompilerHost(options)

  const origReadFile = host.readFile.bind(host)
  host.readFile = (fileName) => {
    const v = virtuals.get(fileName)
    if (v) return v.code
    if (fileName === shimPath) return CONTENT_SHIM
    return origReadFile(fileName)
  }

  const origFileExists = host.fileExists.bind(host)
  host.fileExists = (fileName) =>
    virtuals.has(fileName) || fileName === shimPath || origFileExists(fileName)

  const origGetSourceFile = host.getSourceFile.bind(host)
  host.getSourceFile = (fileName, languageVersionOrOptions, onError, shouldCreate) => {
    const v = virtuals.get(fileName)
    if (v) return ts.createSourceFile(fileName, v.code, languageVersionOrOptions)
    if (fileName === shimPath) return ts.createSourceFile(fileName, CONTENT_SHIM, languageVersionOrOptions)
    return origGetSourceFile(fileName, languageVersionOrOptions, onError, shouldCreate)
  }

  return host
}

// Locate @waldjs/runtime's type declarations by walking node_modules upward
// from this file. require.resolve is not usable here: the runtime's exports
// map has no "require" condition, so createRequire().resolve throws.
function resolveRuntimeTypes(): string | undefined {
  let dir = dirname(fileURLToPath(import.meta.url))
  while (true) {
    const candidate = join(dir, 'node_modules', '@waldjs', 'runtime', 'dist', 'index.d.ts')
    if (existsSync(candidate)) return candidate
    const parent = dirname(dir)
    if (parent === dir) return undefined
    dir = parent
  }
}

function loadTsOptions(root: string): ts.CompilerOptions {
  const runtimeTypes = resolveRuntimeTypes()

  let options: ts.CompilerOptions
  const configPath = join(root, 'tsconfig.json')
  if (existsSync(configPath)) {
    const cfg = ts.readConfigFile(configPath, ts.sys.readFile)
    const parsed = ts.parseJsonConfigFileContent(cfg.config ?? {}, ts.sys, root)
    options = parsed.options
  } else {
    options = {
      strict: true,
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ESNext,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      skipLibCheck: true,
    }
  }

  return {
    ...options,
    noEmit: true,
    baseUrl: options.baseUrl ?? root,
    ...(runtimeTypes
      ? { paths: { ...options.paths, '@waldjs/runtime': [runtimeTypes] } }
      : {}),
  }
}

function findFiles(dir: string, ext: string): string[] {
  const results: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist') continue
    const full = join(dir, entry.name)
    if (entry.isDirectory()) results.push(...findFiles(full, ext))
    else if (entry.name.endsWith(ext)) results.push(full)
  }
  return results
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd packages/compiler && pnpm build && cd ../cli && pnpm test`
Expected: all checker tests pass plus existing CLI tests.

If the `wald:content` test fails on `posts.length` with a top-level-await error: top-level `await` inside the generated async callback is fine, but if TS complains adjust nothing — the body lands inside `async (...) => {}`. If it fails on module resolution instead, verify the shim source file is included in `rootNames`.

- [ ] **Step 6: Commit**

```bash
git add packages/cli/src/checker.ts packages/cli/src/checker.test.ts packages/cli/package.json pnpm-lock.yaml
git commit -m "feat(cli): add type checker with virtual .wald compilation"
```

---

## Task 5: CLI — `check` command

**Files:**
- Create: `packages/cli/src/commands/check.ts`
- Modify: `packages/cli/src/cli.ts`
- Test: `packages/cli/src/commands/check.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `packages/cli/src/commands/check.test.ts`:

```typescript
import { describe, it, expect, vi, afterEach } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { renderDiagnostic, runCheck } from './check.js'

function makeProject(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), 'wald-check-cmd-'))
  for (const [rel, content] of Object.entries(files)) {
    const full = join(root, rel)
    mkdirSync(join(full, '..'), { recursive: true })
    writeFileSync(full, content)
  }
  return root
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('renderDiagnostic', () => {
  it('renders file:line:column, source context and caret', () => {
    const source = 'type Props = { title: string }\nconst { subtitle } = $props'
    const out = renderDiagnostic(
      { file: 'src/pages/index.wald', line: 2, column: 9, message: "Property 'subtitle' does not exist" },
      source,
    )
    expect(out).toContain('[waldjs] src/pages/index.wald:2:9')
    expect(out).toContain("Property 'subtitle' does not exist")
    expect(out).toContain('2 | const { subtitle } = $props')
    const caretLine = out.split('\n').find(l => l.includes('^'))!
    expect(caretLine.indexOf('^')).toBeGreaterThan(0)
  })
})

describe('runCheck', () => {
  it('returns true and reports success for a clean project', async () => {
    const root = makeProject({
      'src/pages/index.wald': `---
const title = 'hi'
---
<h1>{title}</h1>`,
    })
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    const ok = await runCheck(root)
    expect(ok).toBe(true)
    expect(log).toHaveBeenCalledWith(expect.stringContaining('No type errors'))
    rmSync(root, { recursive: true, force: true })
  })

  it('returns false and prints diagnostics for a broken project', async () => {
    const root = makeProject({
      'src/pages/index.wald': `---
type Props = { title: string }
const { subtitle } = $props
---
<h1>{subtitle}</h1>`,
    })
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    const ok = await runCheck(root)
    expect(ok).toBe(false)
    expect(err).toHaveBeenCalledWith(expect.stringContaining('index.wald:3:'))
    rmSync(root, { recursive: true, force: true })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/cli && pnpm test`
Expected: FAIL — `./check.js` does not exist.

- [ ] **Step 3: Implement**

Create `packages/cli/src/commands/check.ts`:

```typescript
import { readFileSync } from 'node:fs'
import { relative } from 'node:path'
import { defineCommand } from 'citty'
import { checkProject, type CheckDiagnostic } from '../checker.js'

export function renderDiagnostic(diag: CheckDiagnostic, source: string): string {
  const lines = source.split('\n')
  const current = lines[diag.line - 1] ?? ''
  const previous = diag.line >= 2 ? lines[diag.line - 2] : undefined
  const gutter = String(diag.line).length

  let out = `[waldjs] ${diag.file}:${diag.line}:${diag.column} — ${diag.message}\n\n`
  if (previous !== undefined) {
    out += `  ${String(diag.line - 1).padStart(gutter)} | ${previous}\n`
  }
  out += `  ${String(diag.line).padStart(gutter)} | ${current}\n`
  out += `  ${' '.repeat(gutter)} | ${' '.repeat(Math.max(0, diag.column - 1))}^\n`
  return out
}

export async function runCheck(root: string): Promise<boolean> {
  const diagnostics = checkProject(root)

  for (const diag of diagnostics) {
    let source = ''
    try {
      source = readFileSync(diag.file, 'utf-8')
    } catch {
      // file unreadable — render header without source context
    }
    const display = { ...diag, file: relative(root, diag.file) || diag.file }
    console.error(renderDiagnostic(display, source))
  }

  if (diagnostics.length > 0) {
    console.error(`✖ ${diagnostics.length} type error${diagnostics.length === 1 ? '' : 's'}`)
    return false
  }

  console.log('✓ No type errors')
  return true
}

export const checkCommand = defineCommand({
  meta: { name: 'check', description: 'Type-check .wald and .ts files' },
  async run() {
    const ok = await runCheck(process.cwd())
    if (!ok) process.exitCode = 1
  },
})
```

Update `packages/cli/src/cli.ts`:

```typescript
import { defineCommand, runMain } from 'citty'
import { plantCommand } from './commands/plant.js'
import { growCommand } from './commands/grow.js'
import { buildCommand } from './commands/build.js'
import { previewCommand } from './commands/preview.js'
import { checkCommand } from './commands/check.js'

const main = defineCommand({
  meta: {
    name: 'wald',
    version: '0.1.0',
    description: 'WaldJS — a content-first web framework',
  },
  subCommands: {
    plant: plantCommand,
    grow: growCommand,
    build: buildCommand,
    preview: previewCommand,
    check: checkCommand,
  },
})

runMain(main)
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/cli && pnpm test`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add packages/cli/src/commands/check.ts packages/cli/src/commands/check.test.ts packages/cli/src/cli.ts
git commit -m "feat(cli): add wald check command with caret-style diagnostics"
```

---

## Task 6: CLI — `wald build --check`

**Files:**
- Modify: `packages/cli/src/commands/build.ts`
- Test: `packages/cli/src/commands/build.test.ts`

### Context

`buildCommand`'s `run()` currently takes no parameters. citty passes `{ args }` to `run`; adding an `args` declaration makes `--check` available. The check must run before any build work and abort via `process.exitCode = 1` (not `process.exit`, which would kill the test runner).

- [ ] **Step 1: Write the failing test**

Add to `packages/cli/src/commands/build.test.ts` (adapt import style to match the file's existing mocks — the vite mock already present must stay untouched):

```typescript
import { runCheck } from './check.js'

vi.mock('./check.js', () => ({
  runCheck: vi.fn(),
}))

describe('build --check', () => {
  it('aborts the build when the check fails', async () => {
    vi.mocked(runCheck).mockResolvedValue(false)
    const prevExitCode = process.exitCode
    await (buildCommand.run as Function)({ args: { check: true } })
    expect(process.exitCode).toBe(1)
    process.exitCode = prevExitCode
  })

  it('runs the check before building when --check passed', async () => {
    vi.mocked(runCheck).mockResolvedValue(false)
    await (buildCommand.run as Function)({ args: { check: true } })
    expect(runCheck).toHaveBeenCalledWith(process.cwd())
  })

  it('skips the check without --check', async () => {
    vi.mocked(runCheck).mockClear()
    await (buildCommand.run as Function)({ args: {} })
    expect(runCheck).not.toHaveBeenCalled()
  })
})
```

Note for the implementer: the existing tests in this file mock `vite` — check the top of the file and keep those mocks intact. If the last test (`skips the check`) fails because the real build runs and throws, that is acceptable to wrap in try/catch — the assertion is only that `runCheck` was not called.

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/cli && pnpm test`
Expected: FAIL — build has no `check` arg handling.

- [ ] **Step 3: Implement**

In `packages/cli/src/commands/build.ts`, add the import at the top:

```typescript
import { runCheck } from './check.js'
```

Replace the `buildCommand` definition:

```typescript
export const buildCommand = defineCommand({
  meta: { description: 'Build your forest for production' },
  args: {
    check: {
      type: 'boolean',
      description: 'Type-check .wald and .ts files before building',
    },
  },
  async run({ args }) {
    const cwd = process.cwd()

    if (args.check) {
      const ok = await runCheck(cwd)
      if (!ok) {
        console.error('✖ Type errors found — build aborted')
        process.exitCode = 1
        return
      }
    }

    const config = await loadWaldConfig(cwd)
    const pagesDir = join(cwd, 'src', 'pages')
    const publicDir = join(cwd, 'public')
    const contentDir = join(cwd, 'content')

    const spinner = ora('Building your forest...').start()
    try {
      await buildPages(pagesDir, config, publicDir, contentDir)
      spinner.succeed(`Build complete → ${config.outDir}/`)
    } catch (e) {
      spinner.fail(`Build failed: ${e}`)
      throw e
    }
  },
})
```

- [ ] **Step 4: Run all tests**

Run: `cd packages/cli && pnpm test`, then `pnpm test` from the repo root.
Expected: all pass across all packages.

- [ ] **Step 5: Commit**

```bash
git add packages/cli/src/commands/build.ts packages/cli/src/commands/build.test.ts
git commit -m "feat(cli): add --check flag to wald build"
```
