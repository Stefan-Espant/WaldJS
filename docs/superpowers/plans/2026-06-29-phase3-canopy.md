# Phase 3 — Canopy: Vanilla JS Script Blocks

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `<script>` block support to `.wald` files with automatic hoisting to before `</body>` and deduplication.

**Architecture:** The scanner gains raw text mode for `<script>` elements (preventing `<` and `{` in JS from being misinterpreted). The compiler transform emits script content as `SafeHtml` strings. After rendering, a `hoistScripts()` function in the CLI shell extracts all scripts, deduplicates by exact content, and injects them before `</body>`.

**Tech Stack:** TypeScript, Vitest, existing `@waldjs/compiler` / `@waldjs/runtime` / `@waldjs/cli` packages in a pnpm monorepo.

**Base branch:** `phase2b/branches` — create a new worktree from this branch:
```bash
git worktree add .worktrees/phase3-canopy -b phase3/canopy phase2b/branches
cd .worktrees/phase3-canopy
pnpm install
```

---

## File Map

| File | Change |
|---|---|
| `packages/compiler/src/ast/types.ts` | Add `ScriptNode` type, extend `TemplateNode` union |
| `packages/compiler/src/parser/scanner.ts` | Add `isScriptTag()` + `scanScript()`, update `scanNode()` |
| `packages/compiler/src/parser/scanner.test.ts` | 4 new tests for raw text mode |
| `packages/compiler/src/transform/index.ts` | Add `case 'script'` to `renderNode()` |
| `packages/compiler/src/transform/index.test.ts` | 2 new tests for script rendering |
| `packages/cli/src/shell.ts` | Add `hoistScripts()` export |
| `packages/cli/src/shell.test.ts` | 4 new tests for `hoistScripts()` |
| `packages/cli/src/commands/grow.ts` | Pipe through `hoistScripts()` at 2 call sites |
| `packages/cli/src/commands/build.ts` | Pipe through `hoistScripts()` at 2 call sites |
| `packages/cli/src/commands/build.test.ts` | 2 new integration tests |
| `packages/cli/src/commands/plant.ts` | Add `Counter.wald` scaffold + update `index.wald` |
| `packages/cli/src/commands/plant.test.ts` | 1 new test |

---

## Task 1: ScriptNode in AST + scanner raw text mode

**Files:**
- Modify: `packages/compiler/src/ast/types.ts`
- Modify: `packages/compiler/src/parser/scanner.ts`
- Test: `packages/compiler/src/parser/scanner.test.ts`

- [ ] **Step 1: Write failing scanner tests**

Add a new `describe` block at the end of `packages/compiler/src/parser/scanner.test.ts`:

```ts
describe('scanTemplate — script', () => {
  it('returns a ScriptNode for a <script> element', () => {
    const nodes = scanTemplate('<script>console.log("hi")</script>')
    expect(nodes).toEqual([{ type: 'script', content: '<script>console.log("hi")</script>' }])
  })

  it('treats { as raw text inside script, not an expression', () => {
    const nodes = scanTemplate('<script>const x = { a: 1 }</script>')
    expect(nodes).toEqual([{ type: 'script', content: '<script>const x = { a: 1 }</script>' }])
  })

  it('treats < as raw text inside script, not a tag', () => {
    const nodes = scanTemplate('<script>const ok = 1 < 2</script>')
    expect(nodes).toEqual([{ type: 'script', content: '<script>const ok = 1 < 2</script>' }])
  })

  it('handles script with type attribute', () => {
    const nodes = scanTemplate('<script type="module">export const x = 1</script>')
    expect(nodes).toEqual([{ type: 'script', content: '<script type="module">export const x = 1</script>' }])
  })
})
```

- [ ] **Step 2: Run to verify failure**

```bash
cd packages/compiler && pnpm test -- --reporter=verbose 2>&1 | grep -E "FAIL|script"
```

Expected: 4 failures about `ScriptNode` not matching.

- [ ] **Step 3: Add `ScriptNode` to AST types**

In `packages/compiler/src/ast/types.ts`, add `ScriptNode` and extend `TemplateNode`:

```ts
export type WaldDocument = {
  type: 'document'
  frontmatter: FrontmatterNode
  template: TemplateNode[]
}

export type FrontmatterNode = {
  type: 'frontmatter'
  code: string
}

export type TemplateNode =
  | ElementNode
  | TextNode
  | ExpressionNode
  | ComponentNode
  | ScriptNode

export type ElementNode = {
  type: 'element'
  tag: string
  attrs: AttributeNode[]
  children: TemplateNode[]
}

export type TextNode = {
  type: 'text'
  value: string
}

export type ExpressionNode = {
  type: 'expression'
  code: string
}

export type AttributeNode = {
  type: 'attribute'
  name: string
  value: string | ExpressionNode
}

export type ComponentNode = {
  type: 'component'
  name: string
  attrs: AttributeNode[]
  children: TemplateNode[]
}

export type ScriptNode = {
  type: 'script'
  content: string
}
```

- [ ] **Step 4: Update the scanner import and add raw text methods**

Replace the entire `packages/compiler/src/parser/scanner.ts` with:

```ts
import type { TemplateNode, ElementNode, ComponentNode, AttributeNode, ScriptNode } from '../ast/types.js'

export function scanTemplate(source: string): TemplateNode[] {
  const scanner = new Scanner(source)
  return scanner.scanNodes()
}

class Scanner {
  private pos = 0

  constructor(private source: string) {}

  private get current(): string {
    return this.source[this.pos] ?? ''
  }

  private peek(offset = 0): string {
    return this.source[this.pos + offset] ?? ''
  }

  private advance(): string {
    return this.source[this.pos++] ?? ''
  }

  scanNodes(): TemplateNode[] {
    const nodes: TemplateNode[] = []
    while (this.pos < this.source.length) {
      if (this.current === '<' && this.peek(1) === '/') break
      const node = this.scanNode()
      if (node !== null) nodes.push(node)
    }
    return nodes
  }

  private scanNode(): TemplateNode | null {
    if (this.current === '<' && this.peek(1) !== '/') {
      if (this.isScriptTag()) return this.scanScript()
      return this.scanElement()
    }
    if (this.current === '{') {
      return this.scanExpression()
    }
    return this.scanText()
  }

  private isScriptTag(): boolean {
    const ahead = this.source.slice(this.pos + 1, this.pos + 8).toLowerCase()
    return ahead.startsWith('script') && /[\s>/]/.test(ahead[6] ?? '>')
  }

  private scanScript(): ScriptNode {
    const closeTag = '</script>'
    const closeIndex = this.source.toLowerCase().indexOf(closeTag, this.pos)
    const end = closeIndex === -1 ? this.source.length : closeIndex + closeTag.length
    const content = this.source.slice(this.pos, end)
    this.pos = end
    return { type: 'script', content }
  }

  private scanText(): TemplateNode | null {
    let value = ''
    while (this.pos < this.source.length && this.current !== '<' && this.current !== '{') {
      value += this.advance()
    }
    if (!value) return null
    return { type: 'text', value }
  }

  scanExpression(): TemplateNode {
    this.advance() // consume {
    let code = ''
    let depth = 1
    while (this.pos < this.source.length && depth > 0) {
      const ch = this.advance()
      if (ch === '{') depth++
      else if (ch === '}') depth--
      if (depth > 0) code += ch
    }
    return { type: 'expression', code: code.trim() }
  }

  private scanElement(): ElementNode | ComponentNode {
    this.advance() // consume <
    const tag = this.scanIdentifier()
    const attrs = this.scanAttributes()

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

  private scanIdentifier(): string {
    let id = ''
    while (this.pos < this.source.length && /[\w-]/.test(this.current)) {
      id += this.advance()
    }
    return id
  }

  private scanAttributes(): AttributeNode[] {
    const attrs: AttributeNode[] = []
    while (
      this.pos < this.source.length &&
      this.current !== '>' &&
      !(this.current === '/' && this.peek(1) === '>')
    ) {
      this.skipWhitespace()
      if (this.current === '>' || (this.current === '/' && this.peek(1) === '>')) break
      const attr = this.scanAttribute()
      if (attr) attrs.push(attr)
    }
    return attrs
  }

  private scanAttribute(): AttributeNode | null {
    const name = this.scanIdentifier()
    if (!name) {
      this.advance()
      return null
    }

    if (this.current !== '=') {
      return { type: 'attribute', name, value: '' }
    }

    this.advance() // consume =

    if ((this.current as string) === '"') {
      this.advance() // consume opening "
      let value = ''
      while (this.pos < this.source.length && (this.current as string) !== '"') {
        value += this.advance()
      }
      this.advance() // consume closing "
      return { type: 'attribute', name, value }
    }

    if ((this.current as string) === '{') {
      const expr = this.scanExpression()
      return { type: 'attribute', name, value: expr as import('../ast/types.js').ExpressionNode }
    }

    return { type: 'attribute', name, value: '' }
  }

  private skipWhitespace(): void {
    while (this.pos < this.source.length && /\s/.test(this.current)) {
      this.advance()
    }
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd packages/compiler && pnpm test -- --reporter=verbose 2>&1 | tail -15
```

Expected: all scanner tests pass including the 4 new ones.

- [ ] **Step 6: Commit**

```bash
git add packages/compiler/src/ast/types.ts packages/compiler/src/parser/scanner.ts packages/compiler/src/parser/scanner.test.ts
git commit -m "feat(compiler): add ScriptNode to AST and raw text mode in scanner"
```

---

## Task 2: Transform renders ScriptNode

**Files:**
- Modify: `packages/compiler/src/transform/index.ts`
- Test: `packages/compiler/src/transform/index.test.ts`

- [ ] **Step 1: Write failing transform tests**

Add to the end of `packages/compiler/src/transform/index.test.ts`:

```ts
describe('script rendering', () => {
  it('renders a <script> block as SafeHtml in the template output', () => {
    const source = `---\n---\n<script>alert(1)</script>`
    const output = compile(source, 'test.wald')
    expect(output).toContain('new SafeHtml')
    expect(output).toContain('<script>alert(1)</script>')
  })

  it('preserves < and { literally in script content', () => {
    const source = `---\n---\n<script>const ok = 1 < 2; const obj = { a: 1 }</script>`
    const output = compile(source, 'test.wald')
    expect(output).toContain('const ok = 1 < 2')
    expect(output).toContain('{ a: 1 }')
  })
})
```

- [ ] **Step 2: Run to verify failure**

```bash
cd packages/compiler && pnpm test -- --reporter=verbose 2>&1 | grep -E "FAIL|script render"
```

Expected: 2 failures — `renderNode` has no `case 'script'` yet (TypeScript exhaustiveness error or runtime crash).

- [ ] **Step 3: Add `case 'script'` to `renderNode()`**

In `packages/compiler/src/transform/index.ts`, update `renderNode()`:

```ts
function renderNode(node: TemplateNode): string {
  switch (node.type) {
    case 'element': return renderElement(node)
    case 'text': return escapeTemplateLiteral(node.value)
    case 'expression': return `\${${node.code}}`
    case 'component': return renderComponent(node)
    case 'script': return `\${new SafeHtml(${JSON.stringify(node.content)})}`
  }
}
```

No other changes needed — `TemplateNode` already includes `ScriptNode` via the union type updated in Task 1.

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd packages/compiler && pnpm test -- --reporter=verbose 2>&1 | tail -15
```

Expected: all compiler tests pass including the 2 new ones.

- [ ] **Step 5: Commit**

```bash
git add packages/compiler/src/transform/index.ts packages/compiler/src/transform/index.test.ts
git commit -m "feat(compiler): render ScriptNode as SafeHtml in transform output"
```

---

## Task 3: hoistScripts in CLI shell + wire into grow and build

**Files:**
- Modify: `packages/cli/src/shell.ts`
- Modify: `packages/cli/src/shell.test.ts`
- Modify: `packages/cli/src/commands/grow.ts`
- Modify: `packages/cli/src/commands/build.ts`

- [ ] **Step 1: Write failing hoistScripts tests**

Add a new import and describe block to `packages/cli/src/shell.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { maybeWrap, hoistScripts } from './shell.js'

describe('maybeWrap', () => {
  it('wraps content that has no doctype', () => {
    const result = maybeWrap('<h1>Hello</h1>')
    expect(result).toContain('<!DOCTYPE html>')
    expect(result).toContain('<h1>Hello</h1>')
  })

  it('passes through content that starts with <!DOCTYPE', () => {
    const full = '<!DOCTYPE html><html><body>Hi</body></html>'
    expect(maybeWrap(full)).toBe(full)
  })

  it('passes through content that starts with <html', () => {
    const full = '<html><body>Hi</body></html>'
    expect(maybeWrap(full)).toBe(full)
  })

  it('handles leading whitespace before <!DOCTYPE', () => {
    const full = '\n<!DOCTYPE html><html><body>Hi</body></html>'
    expect(maybeWrap(full)).toBe(full)
  })
})

describe('hoistScripts', () => {
  it('returns html unchanged when no scripts present', () => {
    const html = '<html><body><h1>Hello</h1></body></html>'
    expect(hoistScripts(html)).toBe(html)
  })

  it('moves inline script to before </body>', () => {
    const html = '<html><body><h1>Hi</h1><script>alert(1)</script></body></html>'
    const result = hoistScripts(html)
    expect(result).toBe('<html><body><h1>Hi</h1><script>alert(1)</script>\n</body></html>')
  })

  it('deduplicates identical scripts', () => {
    const s = '<script>alert(1)</script>'
    const html = `<html><body>${s}${s}</body></html>`
    const result = hoistScripts(html)
    expect((result.match(/<script>/g) ?? []).length).toBe(1)
  })

  it('preserves two distinct scripts', () => {
    const html = '<html><body><script>a()</script><script>b()</script></body></html>'
    const result = hoistScripts(html)
    expect(result).toContain('a()')
    expect(result).toContain('b()')
    expect((result.match(/<script>/g) ?? []).length).toBe(2)
  })
})
```

- [ ] **Step 2: Run to verify failure**

```bash
cd packages/cli && pnpm test -- --reporter=verbose 2>&1 | grep -E "FAIL|hoistScripts"
```

Expected: 4 failures — `hoistScripts` not exported from `shell.ts`.

- [ ] **Step 3: Add `hoistScripts` to `shell.ts`**

Replace `packages/cli/src/shell.ts` with:

```ts
export function wrapHtml(content: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width">
  <title>WaldJS</title>
</head>
<body>
${content}
</body>
</html>`
}

export function maybeWrap(html: string): string {
  const t = html.trimStart()
  return t.startsWith('<!DOCTYPE') || t.startsWith('<html')
    ? html
    : wrapHtml(html)
}

export function hoistScripts(html: string): string {
  const seen = new Set<string>()
  const collected: string[] = []
  const stripped = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, (match) => {
    if (!seen.has(match)) {
      seen.add(match)
      collected.push(match)
    }
    return ''
  })
  if (collected.length === 0) return html
  return stripped.replace('</body>', collected.join('\n') + '\n</body>')
}
```

- [ ] **Step 4: Run shell tests to verify they pass**

```bash
cd packages/cli && pnpm test -- --reporter=verbose 2>&1 | grep -E "shell|hoistScripts|maybeWrap"
```

Expected: all 8 shell tests pass.

- [ ] **Step 5: Wire `hoistScripts` into `grow.ts`**

In `packages/cli/src/commands/grow.ts`, update line 7 and two call sites:

```ts
// Line 7 — update import:
import { maybeWrap, hoistScripts } from '../shell.js'

// Line 24 in handleRequest — update:
return { status: 200, body: hoistScripts(maybeWrap(html)) }

// Line 58 in growCommand — update:
const full = hoistScripts(maybeWrap(html))
```

Full updated `handleRequest` function:

```ts
export async function handleRequest(
  routes: Route[],
  url: string,
  vite: ViteLike | undefined
): Promise<{ status: number; body: string }> {
  const match = matchRoute(routes, url)
  if (!match) return { status: 404, body: 'Page not found' }

  const mod = await vite!.ssrLoadModule(match.route.file)
  const html = await mod.default.render(match.params)
  return { status: 200, body: hoistScripts(maybeWrap(html)) }
}
```

Full updated render block inside `growCommand`:

```ts
try {
  const mod = await vite.ssrLoadModule(match.route.file)
  const html = await mod.default.render(match.params)
  const full = hoistScripts(maybeWrap(html))
  res.writeHead(200, { 'Content-Type': 'text/html' })
  res.end(full)
} catch (e) {
  vite.ssrFixStacktrace(e as Error)
  res.writeHead(500, { 'Content-Type': 'text/plain' })
  res.end(String(e))
}
```

- [ ] **Step 6: Wire `hoistScripts` into `build.ts`**

In `packages/cli/src/commands/build.ts`, update line 7 and two call sites:

```ts
// Line 7 — update import:
import { maybeWrap, hoistScripts } from '../shell.js'

// Line 91 — update:
const html = hoistScripts(maybeWrap(await mod.default.render()))

// Line 113 — update:
const html = hoistScripts(maybeWrap(await mod.default.render(params)))
```

- [ ] **Step 7: Run all CLI tests**

```bash
cd packages/cli && pnpm test -- --reporter=verbose 2>&1 | tail -15
```

Expected: all CLI tests pass.

- [ ] **Step 8: Commit**

```bash
git add packages/cli/src/shell.ts packages/cli/src/shell.test.ts packages/cli/src/commands/grow.ts packages/cli/src/commands/build.ts
git commit -m "feat(cli): add hoistScripts and wire into grow and build pipeline"
```

---

## Task 4: Build integration tests for script hoisting

**Files:**
- Test: `packages/cli/src/commands/build.test.ts`

- [ ] **Step 1: Write failing integration tests**

Add two new tests to the `describe('buildPages', ...)` block in `packages/cli/src/commands/build.test.ts`:

```ts
it('hoists script to before </body> in static build output', async () => {
  const pagesDir = join(tmpDir, 'src', 'pages')
  const distDir = join(tmpDir, 'dist')
  mkdirSync(pagesDir, { recursive: true })

  writeFileSync(
    join(pagesDir, 'index.wald'),
    [
      '---',
      'const count = 0',
      '---',
      '<span id="n">{count}</span>',
      '<script>document.getElementById("n").textContent = 42</script>',
    ].join('\n')
  )

  await buildPages(pagesDir, distDir)

  const html = readFileSync(join(distDir, 'index.html'), 'utf8')
  const scriptPos = html.indexOf('<script>')
  const spanPos = html.indexOf('<span id="n">')
  const bodyClosePos = html.indexOf('</body>')
  expect(scriptPos).toBeGreaterThan(-1)
  expect(scriptPos).toBeGreaterThan(spanPos)
  expect(scriptPos).toBeLessThan(bodyClosePos)
})

it('deduplicates script when same component renders multiple times', async () => {
  const pagesDir = join(tmpDir, 'src', 'pages')
  const componentsDir = join(tmpDir, 'src', 'components')
  const distDir = join(tmpDir, 'dist')
  mkdirSync(pagesDir, { recursive: true })
  mkdirSync(componentsDir, { recursive: true })

  writeFileSync(
    join(componentsDir, 'Badge.wald'),
    [
      '---',
      'const { label } = $$props',
      '---',
      '<span>{label}</span>',
      '<script>console.log("badge")</script>',
    ].join('\n')
  )

  writeFileSync(
    join(pagesDir, 'index.wald'),
    [
      '---',
      "import Badge from '../components/Badge.wald'",
      '---',
      '<Badge label="A" />',
      '<Badge label="B" />',
    ].join('\n')
  )

  await buildPages(pagesDir, distDir)

  const html = readFileSync(join(distDir, 'index.html'), 'utf8')
  expect((html.match(/<script>/g) ?? []).length).toBe(1)
})
```

- [ ] **Step 2: Run to verify failure**

```bash
cd packages/cli && pnpm test -- --reporter=verbose 2>&1 | grep -E "FAIL|hoists script|deduplicates script"
```

Expected: 2 failures. The first test fails because scripts aren't yet hoisted in the build output. Wait — Task 3 already wired `hoistScripts` in! So these should actually pass. Run the test to verify:

```bash
cd packages/cli && pnpm test -- --reporter=verbose 2>&1 | tail -15
```

Expected: all tests pass including the 2 new ones. If they fail, verify that `hoistScripts` was correctly wired into `build.ts` in Task 3.

- [ ] **Step 3: Commit**

```bash
git add packages/cli/src/commands/build.test.ts
git commit -m "test(cli): add build integration tests for script hoisting and deduplication"
```

---

## Task 5: wald plant scaffold — Counter.wald

**Files:**
- Modify: `packages/cli/src/commands/plant.ts`
- Test: `packages/cli/src/commands/plant.test.ts`

- [ ] **Step 1: Write failing plant test**

Add to `packages/cli/src/commands/plant.test.ts`:

```ts
it('Counter.wald scaffold contains a <script> block with addEventListener', () => {
  const dir = mkdtempSync(join(tmpdir(), 'wald-plant-'))
  scaffold(dir)
  const counter = readFileSync(join(dir, 'src', 'components', 'Counter.wald'), 'utf8')
  expect(counter).toContain('<script>')
  expect(counter).toContain('addEventListener')
  expect(counter).toContain('</script>')
})
```

- [ ] **Step 2: Run to verify failure**

```bash
cd packages/cli && pnpm test -- --reporter=verbose 2>&1 | grep -E "FAIL|Counter"
```

Expected: 1 failure — `Counter.wald` does not exist yet.

- [ ] **Step 3: Add `Counter.wald` to scaffold and update `index.wald`**

In `packages/cli/src/commands/plant.ts`, add the following `writeFileSync` call after the existing `Card.wald` write:

```ts
writeFileSync(
  join(targetDir, 'src', 'components', 'Counter.wald'),
  [
    '---',
    "const { initial = 0 } = $$props",
    '---',
    '<div class="counter" data-count="{initial}">',
    '  <span class="counter-value">{initial}</span>',
    '  <button class="counter-btn">+</button>',
    '</div>',
    '<script>',
    '  document.querySelectorAll(\'.counter\').forEach(function(el) {',
    "    var count = parseInt(el.dataset.count, 10)",
    "    el.querySelector('.counter-btn').addEventListener('click', function() {",
    '      count++',
    "      el.querySelector('.counter-value').textContent = count",
    '    })',
    '  })',
    '</script>',
    '',
  ].join('\n')
)
```

Also update the `index.wald` scaffold to import and use `Counter`:

```ts
writeFileSync(
  join(targetDir, 'src', 'pages', 'index.wald'),
  [
    '---',
    "import Layout from '../layouts/Layout.wald'",
    "import Card from '../components/Card.wald'",
    "import Counter from '../components/Counter.wald'",
    "const title = 'Hello Wald'",
    '---',
    '<Layout title={title}>',
    '  <Card title="Welkom" body="Je eerste WaldJS project." />',
    '  <Counter initial={3} />',
    '</Layout>',
    '',
  ].join('\n')
)
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd packages/cli && pnpm test -- --reporter=verbose 2>&1 | tail -15
```

Expected: all plant tests pass including the new Counter test.

- [ ] **Step 5: Commit**

```bash
git add packages/cli/src/commands/plant.ts packages/cli/src/commands/plant.test.ts
git commit -m "feat(cli): scaffold Counter.wald with <script> block example"
```

---

## Final check

- [ ] **Run full test suite**

```bash
pnpm test 2>&1 | tail -20
```

Expected: all packages pass. Then also run CLI and content directly (not picked up by turbo scope):

```bash
pnpm --filter "@waldjs/cli" test 2>&1 | tail -6
pnpm --filter "@waldjs/content" test 2>&1 | tail -6
```

Expected combined: 99+ tests, 0 failures.
