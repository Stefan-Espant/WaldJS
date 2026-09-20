# TypeScript `$props` Inference — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Users declare `type Props = { ... }` in `.wald` frontmatter and get TypeScript type-checking for `$props` usage.

**Architecture:** Two packages change: (1) `@waldjs/runtime` — `createTree` and `Tree` become generic; (2) `@waldjs/compiler` — `extractExports` hoists `type Props` and signals its presence; `transform()` injects the generic type parameter and a `const $props = $$props` alias.

**Tech Stack:** TypeScript 5.5, Vitest 2, pnpm monorepo (run tests with `pnpm test` per package).

---

## File Map

| File | Change |
|---|---|
| `packages/runtime/src/index.ts` | Make `RenderFn`, `Tree`, `createTree` generic with `TProps` |
| `packages/runtime/src/index.test.ts` | Add tests for typed `createTree<Props>` |
| `packages/compiler/src/transform/index.ts` | `extractExports` returns `hasProps`; hoists `type Props`; `transform()` injects generic + alias |
| `packages/compiler/src/transform/index.test.ts` | Tests for Props hoisting, generic injection, alias |
| `packages/compiler/src/compile.test.ts` | End-to-end test: `.wald` source with `type Props` → correct compiled output |

---

## Task 1: Runtime — Generic `createTree` and `Tree`

**Files:**
- Modify: `packages/runtime/src/index.ts:1-16`
- Test: `packages/runtime/src/index.test.ts`

### Context

Current `packages/runtime/src/index.ts` (full file):
```typescript
type RenderFn = (
  $$result: BuildContext,
  $$props: Record<string, unknown>
) => Promise<string>

type BuildContext = Record<string, never>

export type Tree = {
  render: (props?: Record<string, unknown>) => Promise<string>
}

export function createTree(fn: RenderFn): Tree {
  return {
    render: (props = {}) => fn({}, props),
  }
}

export class SafeHtml {
  constructor(public readonly value: string) {}
}

const escapeMap: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}

function escapeHtml(value: unknown): string {
  if (value == null) return ''
  return String(value).replace(/[&<>"']/g, (char) => escapeMap[char])
}

export function renderTemplate(
  strings: TemplateStringsArray,
  ...values: unknown[]
): string {
  let result = strings[0]
  for (let i = 0; i < values.length; i++) {
    const value = values[i]
    result += (value instanceof SafeHtml ? value.value : escapeHtml(value)) + strings[i + 1]
  }
  return result
}
```

- [ ] **Step 1: Write the failing test**

Add to `packages/runtime/src/index.test.ts`, inside the existing `describe('createTree', ...)` block:

```typescript
  it('accepts a typed TProps generic and passes typed props to the function', async () => {
    type Props = { greeting: string; count: number }
    const tree = createTree<Props>(async (_result, props) => {
      return renderTemplate`${props.greeting} ${props.count}`
    })
    const html = await tree.render({ greeting: 'hello', count: 42 })
    expect(html).toBe('hello 42')
  })

  it('defaults to Record<string, unknown> when no generic is provided', async () => {
    const tree = createTree(async (_result, props) => {
      return renderTemplate`${props['name']}`
    })
    const html = await tree.render({ name: 'Wald' })
    expect(html).toBe('Wald')
  })
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd packages/runtime && pnpm test
```

Expected: The new tests fail because `createTree` does not yet accept a type parameter (TypeScript error or runtime mismatch).

- [ ] **Step 3: Update `packages/runtime/src/index.ts`**

Replace only the `RenderFn`, `Tree`, and `createTree` declarations (lines 1–16). Leave `SafeHtml`, `escapeMap`, `escapeHtml`, and `renderTemplate` unchanged:

```typescript
type RenderFn<TProps extends Record<string, unknown> = Record<string, unknown>> = (
  $$result: BuildContext,
  $$props: TProps
) => Promise<string>

type BuildContext = Record<string, never>

export type Tree<TProps extends Record<string, unknown> = Record<string, unknown>> = {
  render: (props?: TProps) => Promise<string>
}

export function createTree<TProps extends Record<string, unknown> = Record<string, unknown>>(
  fn: RenderFn<TProps>
): Tree<TProps> {
  return {
    render: (props = {} as TProps) => fn({}, props),
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd packages/runtime && pnpm test
```

Expected: All tests pass, including the two new ones.

- [ ] **Step 5: Commit**

```bash
git add packages/runtime/src/index.ts packages/runtime/src/index.test.ts
git commit -m "feat(runtime): make createTree and Tree generic with TProps"
```

---

## Task 2: Compiler Transform — Props Hoisting, Generic Injection, `$props` Alias

**Files:**
- Modify: `packages/compiler/src/transform/index.ts`
- Test: `packages/compiler/src/transform/index.test.ts`

### Context

The `transform/index.ts` file has two relevant functions:

**`extractExports(code: string)`** (lines 38–71) — splits frontmatter code into hoisted (`import`/`export`) and body lines. Currently returns `{ hoisted: string; body: string }`.

**`transform(ast: WaldDocument)`** (lines 8–36) — calls `extractExports`, builds the output module string, emits `export default createTree(async ($$result, $$props) => {`.

Changes needed:
1. `extractExports` must detect `type Props` lines, hoist them alongside imports, and return `hasProps: boolean`
2. `transform` must use `hasProps` to emit `createTree<Props>(async ($$result, $$props: Props) => {` and inject `const $props = $$props` as first body line

- [ ] **Step 1: Write the failing tests**

Add to `packages/compiler/src/transform/index.test.ts`, after the existing `describe('transform', ...)` block:

```typescript
describe('transform — type Props support', () => {
  it('hoists type Props to module level before export default', () => {
    const ast: WaldDocument = {
      type: 'document',
      frontmatter: { type: 'frontmatter', code: 'type Props = { title: string }' },
      template: [],
    }
    const output = transform(ast)
    const propsPos = output.indexOf('type Props = { title: string }')
    const exportDefaultPos = output.indexOf('export default createTree')
    expect(propsPos).toBeGreaterThanOrEqual(0)
    expect(propsPos).toBeLessThan(exportDefaultPos)
  })

  it('injects Props generic when type Props is present', () => {
    const ast: WaldDocument = {
      type: 'document',
      frontmatter: { type: 'frontmatter', code: 'type Props = { title: string }' },
      template: [],
    }
    const output = transform(ast)
    expect(output).toContain('export default createTree<Props>(async ($$result, $$props: Props) => {')
  })

  it('injects const $props = $$props alias inside the callback when Props present', () => {
    const ast: WaldDocument = {
      type: 'document',
      frontmatter: { type: 'frontmatter', code: 'type Props = { title: string }' },
      template: [],
    }
    const output = transform(ast)
    const exportDefaultPos = output.indexOf('export default createTree<Props>')
    const aliasPos = output.indexOf('const $props = $$props')
    expect(aliasPos).toBeGreaterThan(exportDefaultPos)
  })

  it('does not inject Props generic when no type Props in frontmatter', () => {
    const ast: WaldDocument = {
      type: 'document',
      frontmatter: { type: 'frontmatter', code: 'const x = 1' },
      template: [],
    }
    const output = transform(ast)
    expect(output).toContain('export default createTree(async ($$result, $$props) => {')
    expect(output).not.toContain('createTree<Props>')
    expect(output).not.toContain('const $props = $$props')
  })

  it('hoists multi-line type Props', () => {
    const code = 'type Props = {\n  title: string\n  count?: number\n}'
    const ast: WaldDocument = {
      type: 'document',
      frontmatter: { type: 'frontmatter', code },
      template: [],
    }
    const output = transform(ast)
    const propsPos = output.indexOf('type Props = {')
    const exportDefaultPos = output.indexOf('export default createTree<Props>')
    expect(propsPos).toBeGreaterThanOrEqual(0)
    expect(propsPos).toBeLessThan(exportDefaultPos)
  })

  it('keeps non-Props body lines inside the callback when Props present', () => {
    const code = 'type Props = { title: string }\nconst x = 1'
    const ast: WaldDocument = {
      type: 'document',
      frontmatter: { type: 'frontmatter', code },
      template: [],
    }
    const output = transform(ast)
    const exportDefaultPos = output.indexOf('export default createTree<Props>')
    const constXPos = output.indexOf('const x = 1')
    expect(constXPos).toBeGreaterThan(exportDefaultPos)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd packages/compiler && pnpm test
```

Expected: The 6 new tests all fail (wrong output shape, missing `<Props>`, missing alias, etc.).

- [ ] **Step 3: Update `extractExports` in `packages/compiler/src/transform/index.ts`**

Replace the entire `extractExports` function (lines 38–71) with:

```typescript
function extractExports(code: string): { hoisted: string; body: string; hasProps: boolean } {
  const lines = code.split('\n')
  const hoistedBlocks: string[] = []
  const bodyLines: string[] = []
  let hasProps = false
  let i = 0

  while (i < lines.length) {
    const trimmed = lines[i].trimStart()
    if (trimmed.startsWith('import ')) {
      hoistedBlocks.push(lines[i])
      i++
    } else if (trimmed.startsWith('type Props')) {
      const block: string[] = []
      let depth = 0
      do {
        const line = lines[i]
        block.push(line)
        depth += (line.match(/\{/g) ?? []).length - (line.match(/\}/g) ?? []).length
        i++
      } while (depth > 0 && i < lines.length)
      hoistedBlocks.push(block.join('\n'))
      hasProps = true
    } else if (trimmed.startsWith('export ')) {
      const block: string[] = []
      let depth = 0
      do {
        const line = lines[i]
        block.push(line)
        depth += (line.match(/\{/g) ?? []).length - (line.match(/\}/g) ?? []).length
        i++
      } while (depth > 0 && i < lines.length)
      hoistedBlocks.push(block.join('\n'))
    } else {
      bodyLines.push(lines[i])
      i++
    }
  }

  return {
    hoisted: hoistedBlocks.join('\n'),
    body: bodyLines.join('\n').trim(),
    hasProps,
  }
}
```

- [ ] **Step 4: Update `transform()` in `packages/compiler/src/transform/index.ts`**

Replace the `transform` function (lines 8–36) with:

```typescript
export function transform(ast: WaldDocument): string {
  const templateCode = renderNodes(ast.template)
  const code = ast.frontmatter.code ?? ''
  const { hoisted, body, hasProps } = extractExports(code)

  const bodyIndented = body
    ? body.split('\n').map(line => `  ${line}`).join('\n')
    : ''

  const parts = [
    `import { createTree, renderTemplate, SafeHtml } from '@waldjs/runtime'`,
    ``,
  ]

  if (hoisted) {
    parts.push(hoisted)
    parts.push(``)
  }

  const fnSignature = hasProps
    ? `export default createTree<Props>(async ($$result, $$props: Props) => {`
    : `export default createTree(async ($$result, $$props) => {`

  const bodyContent = hasProps
    ? [`  const $props = $$props`, bodyIndented].filter(Boolean).join('\n')
    : bodyIndented

  parts.push(
    fnSignature,
    bodyContent,
    ``,
    `  return renderTemplate\`${templateCode}\``,
    `})`,
  )

  return parts.join('\n')
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd packages/compiler && pnpm test
```

Expected: All tests pass, including the 6 new ones.

- [ ] **Step 6: Commit**

```bash
git add packages/compiler/src/transform/index.ts packages/compiler/src/transform/index.test.ts
git commit -m "feat(compiler): hoist type Props and inject Props generic + \$props alias"
```

---

## Task 3: End-to-End `compile()` Test

**Files:**
- Test: `packages/compiler/src/compile.test.ts`

### Context

`compile.test.ts` tests the full pipeline: `.wald` source string → compiled JS/TS module string. These tests catch regressions that only appear when `parse` + `transform` run together.

- [ ] **Step 1: Write the failing test**

Add to `packages/compiler/src/compile.test.ts`, after the existing `describe('compile', ...)` block:

```typescript
describe('compile — type Props inference', () => {
  it('compiles a .wald file with type Props to typed createTree output', () => {
    const source = `---
type Props = { title: string }
const { title } = $props
---
<h1>{title}</h1>`

    const output = compile(source, '/src/page.wald')

    expect(output).toContain('type Props = { title: string }')
    expect(output).toContain('createTree<Props>')
    expect(output).toContain('$$props: Props')
    expect(output).toContain('const $props = $$props')
    expect(output).toContain('const { title } = $props')
  })

  it('compiles a .wald file with multi-line type Props', () => {
    const source = `---
type Props = {
  title: string
  count?: number
}
---
<h1>{title}</h1>`

    const output = compile(source, '/src/page.wald')

    expect(output).toContain('type Props = {')
    expect(output).toContain('createTree<Props>')
    expect(output).toContain('$$props: Props')
  })

  it('does not change output for .wald files without type Props', () => {
    const source = `---
const title = "Hello"
---
<h1>{title}</h1>`

    const output = compile(source, '/src/page.wald')

    expect(output).toContain('createTree(async ($$result, $$props)')
    expect(output).not.toContain('createTree<Props>')
    expect(output).not.toContain('const $props = $$props')
  })
})
```

- [ ] **Step 2: Run tests to verify they pass**

All 3 new tests should pass immediately because Tasks 1 and 2 are already done.

```bash
cd packages/compiler && pnpm test
```

Expected: All tests pass.

- [ ] **Step 3: Run full test suite**

```bash
pnpm test
```

Expected: All tests across all packages pass.

- [ ] **Step 4: Commit**

```bash
git add packages/compiler/src/compile.test.ts
git commit -m "test(compiler): add end-to-end tests for type Props inference"
```
