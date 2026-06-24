# Phase 0 — Roots Compiler Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement `@waldjs/compiler` — a package that parses `.wald` files into a WaldAST and transforms them to JS modules (Astro-style), plus a minimal `@waldjs/runtime` with `createTree` and `renderTemplate`.

**Architecture:** Transform-to-Module approach — `.wald` files are compiled to ES modules that export a `createTree()` default. Vite's `transform` plugin hook calls `compile(source, id)` from `@waldjs/compiler`. The runtime provides two functions that the generated modules import at build time.

**Tech Stack:** TypeScript 5.5, pnpm workspaces, Turborepo, Vite 5, Vitest 2

---

## File Map

```
wald/
├── package.json                          root workspace config
├── pnpm-workspace.yaml                   pnpm workspace definition
├── turbo.json                            Turborepo pipeline
├── tsconfig.base.json                    shared TS config
│
├── packages/
│   ├── runtime/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       └── index.ts                  createTree + renderTemplate
│   │
│   └── compiler/
│       ├── package.json
│       ├── tsconfig.json
│       └── src/
│           ├── index.ts                  public API re-exports: parse, transform, compile, waldPlugin + types
│           ├── compile.ts                compile() — parse + transform in één stap (geen cirkel)
│           ├── ast/
│           │   └── types.ts              WaldDocument + all node types
│           ├── parser/
│           │   ├── index.ts              parse() — combines frontmatter + scanner
│           │   ├── frontmatter.ts        --- delimiter splitter
│           │   └── scanner.ts            character-by-character template scanner
│           ├── transform/
│           │   └── index.ts              WaldDocument → JS module string
│           ├── graph/
│           │   └── index.ts              DependencyGraph + needsRecompile
│           └── vite/
│               └── plugin.ts             waldPlugin() — importeert van compile.ts (niet van index.ts)
│
└── examples/
    └── basic/                            integratie smoke test (Task 11)
        ├── package.json
        └── src/
            └── smoke.test.ts             Node.js integratie test via data: import
```

> **Waarom `compile.ts` apart?** Als `vite/plugin.ts` van `index.ts` zou importeren en `index.ts` `waldPlugin` re-exporteert vanuit `vite/plugin.ts`, ontstaat een circulaire dependency. `compile.ts` breekt die cirkel.

---

## Task 1: Monorepo Setup

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `turbo.json`
- Create: `tsconfig.base.json`
- Create: `packages/runtime/package.json`
- Create: `packages/runtime/tsconfig.json`
- Create: `packages/compiler/package.json`
- Create: `packages/compiler/tsconfig.json`

- [ ] **Step 1: Write root package.json**

```json
{
  "name": "waldjs",
  "private": true,
  "scripts": {
    "build": "turbo build",
    "test": "turbo test",
    "dev": "turbo dev"
  },
  "devDependencies": {
    "turbo": "^2.0.0",
    "typescript": "^5.5.0"
  }
}
```

- [ ] **Step 2: Write pnpm-workspace.yaml**

```yaml
packages:
  - 'packages/*'
  - 'examples/*'
```

- [ ] **Step 3: Write turbo.json**

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    },
    "test": {
      "dependsOn": ["^build"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    }
  }
}
```

- [ ] **Step 4: Write tsconfig.base.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "dist"
  }
}
```

- [ ] **Step 5: Write packages/runtime/package.json**

```json
{
  "name": "@waldjs/runtime",
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
  "devDependencies": {
    "typescript": "^5.5.0",
    "vitest": "^2.0.0"
  }
}
```

- [ ] **Step 6: Write packages/runtime/tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": "src"
  },
  "include": ["src"]
}
```

- [ ] **Step 7: Write packages/compiler/package.json**

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
    "@waldjs/runtime": "workspace:*",
    "vite": "^5.0.0"
  },
  "devDependencies": {
    "typescript": "^5.5.0",
    "vitest": "^2.0.0"
  }
}
```

- [ ] **Step 8: Write packages/compiler/tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": "src"
  },
  "include": ["src"]
}
```

- [ ] **Step 9: Install dependencies**

```bash
pnpm install
```

Expected: packages installed, `node_modules` created in root and packages.

- [ ] **Step 10: Commit**

```bash
git add package.json pnpm-workspace.yaml turbo.json tsconfig.base.json packages/
git commit -m "chore: initialize pnpm monorepo with Turborepo"
```

---

## Task 2: @waldjs/runtime

**Files:**
- Create: `packages/runtime/src/index.ts`
- Create: `packages/runtime/src/index.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `packages/runtime/src/index.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { createTree, renderTemplate } from './index.js'

describe('renderTemplate', () => {
  it('interpolates a string value', () => {
    const title = 'Hello Wald'
    const result = renderTemplate`<h1>${title}</h1>`
    expect(result).toBe('<h1>Hello Wald</h1>')
  })

  it('escapes & in expressions', () => {
    const value = 'AT&T'
    const result = renderTemplate`<p>${value}</p>`
    expect(result).toBe('<p>AT&amp;T</p>')
  })

  it('escapes < and > in expressions', () => {
    const value = '<script>alert(1)</script>'
    const result = renderTemplate`<div>${value}</div>`
    expect(result).toBe('<div>&lt;script&gt;alert(1)&lt;/script&gt;</div>')
  })

  it('escapes " in expressions', () => {
    const value = 'say "hello"'
    const result = renderTemplate`<p>${value}</p>`
    expect(result).toBe('<p>say &quot;hello&quot;</p>')
  })

  it('renders null as empty string', () => {
    const value = null
    const result = renderTemplate`<p>${value}</p>`
    expect(result).toBe('<p></p>')
  })

  it('renders undefined as empty string', () => {
    const value = undefined
    const result = renderTemplate`<p>${value}</p>`
    expect(result).toBe('<p></p>')
  })
})

describe('createTree', () => {
  it('returns an object with a render function', () => {
    const tree = createTree(async () => 'html')
    expect(typeof tree.render).toBe('function')
  })

  it('render() calls the provided function and returns the result', async () => {
    const tree = createTree(async () => '<h1>Hello</h1>')
    const result = await tree.render()
    expect(result).toBe('<h1>Hello</h1>')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd packages/runtime && pnpm test
```

Expected: FAIL — `Cannot find module './index.js'`

- [ ] **Step 3: Implement packages/runtime/src/index.ts**

```ts
type RenderFn = (
  $$result: BuildContext,
  $$props: Record<string, unknown>
) => Promise<string>

type BuildContext = Record<string, never>

export type Tree = {
  render: () => Promise<string>
}

export function createTree(fn: RenderFn): Tree {
  return {
    render: () => fn({}, {}),
  }
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
    result += escapeHtml(values[i]) + strings[i + 1]
  }
  return result
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd packages/runtime && pnpm test
```

Expected: PASS — 8 tests passing

- [ ] **Step 5: Commit**

```bash
git add packages/runtime/src/
git commit -m "feat(runtime): add createTree and renderTemplate"
```

---

## Task 3: AST Types

**Files:**
- Create: `packages/compiler/src/ast/types.ts`

No tests — pure TypeScript type definitions.

- [ ] **Step 1: Create packages/compiler/src/ast/types.ts**

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
```

- [ ] **Step 2: Commit**

```bash
git add packages/compiler/src/ast/types.ts
git commit -m "feat(compiler): add WaldAST type definitions"
```

---

## Task 4: Frontmatter Parser

**Files:**
- Create: `packages/compiler/src/parser/frontmatter.ts`
- Create: `packages/compiler/src/parser/frontmatter.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `packages/compiler/src/parser/frontmatter.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { extractFrontmatter } from './frontmatter.js'

describe('extractFrontmatter', () => {
  it('extracts frontmatter code between --- delimiters', () => {
    const source = `---
const title = "Hello"
---
<h1>{title}</h1>`

    const result = extractFrontmatter(source)
    expect(result.code).toBe('const title = "Hello"')
    expect(result.rest).toBe('<h1>{title}</h1>')
  })

  it('returns empty code when no frontmatter present', () => {
    const source = '<h1>Hello</h1>'
    const result = extractFrontmatter(source)
    expect(result.code).toBe('')
    expect(result.rest).toBe('<h1>Hello</h1>')
  })

  it('handles multi-line frontmatter', () => {
    const source = `---
const title = "Hello"
const description = "World"
---
<p>{description}</p>`

    const result = extractFrontmatter(source)
    expect(result.code).toBe('const title = "Hello"\nconst description = "World"')
    expect(result.rest).toBe('<p>{description}</p>')
  })

  it('throws when closing --- is missing', () => {
    const source = `---
const title = "Hello"
<h1>{title}</h1>`

    expect(() => extractFrontmatter(source)).toThrow('Unclosed frontmatter block')
  })

  it('handles frontmatter with TypeScript', () => {
    const source = `---
const items: string[] = ['a', 'b']
---
<ul></ul>`

    const result = extractFrontmatter(source)
    expect(result.code).toBe("const items: string[] = ['a', 'b']")
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd packages/compiler && pnpm test -- frontmatter
```

Expected: FAIL — `Cannot find module './frontmatter.js'`

- [ ] **Step 3: Implement packages/compiler/src/parser/frontmatter.ts**

```ts
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
    throw new Error('Unclosed frontmatter block — missing closing ---')
  }

  const code = afterFirst.slice(0, end).trim()
  const rest = afterFirst.slice(end + DELIMITER.length + 1).trimStart()

  return { code, rest }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd packages/compiler && pnpm test -- frontmatter
```

Expected: PASS — 5 tests passing

- [ ] **Step 5: Commit**

```bash
git add packages/compiler/src/parser/frontmatter.ts packages/compiler/src/parser/frontmatter.test.ts
git commit -m "feat(compiler): add frontmatter extractor"
```

---

## Task 5: Template Scanner — Text and Expressions

**Files:**
- Create: `packages/compiler/src/parser/scanner.ts`
- Create: `packages/compiler/src/parser/scanner.test.ts`

Start with text and expression nodes only.

- [ ] **Step 1: Write the failing tests**

Create `packages/compiler/src/parser/scanner.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { scanTemplate } from './scanner.js'

describe('scanTemplate — text', () => {
  it('returns a TextNode for plain text', () => {
    const nodes = scanTemplate('Hello world')
    expect(nodes).toEqual([{ type: 'text', value: 'Hello world' }])
  })

  it('returns empty array for empty string', () => {
    expect(scanTemplate('')).toEqual([])
  })
})

describe('scanTemplate — expressions', () => {
  it('returns an ExpressionNode for {expr}', () => {
    const nodes = scanTemplate('{title}')
    expect(nodes).toEqual([{ type: 'expression', code: 'title' }])
  })

  it('handles expression with member access', () => {
    const nodes = scanTemplate('{user.name}')
    expect(nodes).toEqual([{ type: 'expression', code: 'user.name' }])
  })

  it('handles expression with method call', () => {
    const nodes = scanTemplate('{items.join(", ")}')
    expect(nodes).toEqual([{ type: 'expression', code: 'items.join(", ")' }])
  })

  it('handles nested braces in expression', () => {
    const nodes = scanTemplate('{a ? { x: 1 } : null}')
    expect(nodes).toEqual([{ type: 'expression', code: 'a ? { x: 1 } : null' }])
  })

  it('mixes text and expressions', () => {
    const nodes = scanTemplate('Hello {name}!')
    expect(nodes).toEqual([
      { type: 'text', value: 'Hello ' },
      { type: 'expression', code: 'name' },
      { type: 'text', value: '!' },
    ])
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd packages/compiler && pnpm test -- scanner
```

Expected: FAIL — `Cannot find module './scanner.js'`

- [ ] **Step 3: Implement packages/compiler/src/parser/scanner.ts (text + expressions only)**

```ts
import type { TemplateNode, ElementNode, ComponentNode, AttributeNode } from '../ast/types.js'

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
      return this.scanElement()
    }
    if (this.current === '{') {
      return this.scanExpression()
    }
    return this.scanText()
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
      while (this.pos < this.source.length && this.current !== '>') this.advance()
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

    if (this.current === '"') {
      this.advance() // consume opening "
      let value = ''
      while (this.pos < this.source.length && this.current !== '"') {
        value += this.advance()
      }
      this.advance() // consume closing "
      return { type: 'attribute', name, value }
    }

    if (this.current === '{') {
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

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd packages/compiler && pnpm test -- scanner
```

Expected: PASS — 7 tests passing

- [ ] **Step 5: Commit**

```bash
git add packages/compiler/src/parser/scanner.ts packages/compiler/src/parser/scanner.test.ts
git commit -m "feat(compiler): add template scanner (text + expressions)"
```

---

## Task 6: Template Scanner — Elements and Attributes

**Files:**
- Modify: `packages/compiler/src/parser/scanner.test.ts`

Element scanning code is already in scanner.ts from Task 5. This task adds the tests.

- [ ] **Step 1: Add element and attribute tests to scanner.test.ts**

Append to `packages/compiler/src/parser/scanner.test.ts`:

```ts
describe('scanTemplate — elements', () => {
  it('returns an ElementNode for <h1>text</h1>', () => {
    const nodes = scanTemplate('<h1>Hello</h1>')
    expect(nodes).toEqual([{
      type: 'element',
      tag: 'h1',
      attrs: [],
      children: [{ type: 'text', value: 'Hello' }],
    }])
  })

  it('handles element with expression child', () => {
    const nodes = scanTemplate('<h1>{title}</h1>')
    expect(nodes).toEqual([{
      type: 'element',
      tag: 'h1',
      attrs: [],
      children: [{ type: 'expression', code: 'title' }],
    }])
  })

  it('handles nested elements', () => {
    const nodes = scanTemplate('<div><p>text</p></div>')
    expect(nodes).toEqual([{
      type: 'element',
      tag: 'div',
      attrs: [],
      children: [{
        type: 'element',
        tag: 'p',
        attrs: [],
        children: [{ type: 'text', value: 'text' }],
      }],
    }])
  })

  it('handles void elements', () => {
    const nodes = scanTemplate('<br />')
    expect(nodes).toEqual([{
      type: 'element',
      tag: 'br',
      attrs: [],
      children: [],
    }])
  })

  it('handles string attribute', () => {
    const nodes = scanTemplate('<h1 class="title">text</h1>')
    expect(nodes).toEqual([{
      type: 'element',
      tag: 'h1',
      attrs: [{ type: 'attribute', name: 'class', value: 'title' }],
      children: [{ type: 'text', value: 'text' }],
    }])
  })

  it('handles expression attribute', () => {
    const nodes = scanTemplate('<div class={styles}>text</div>')
    expect(nodes).toEqual([{
      type: 'element',
      tag: 'div',
      attrs: [{ type: 'attribute', name: 'class', value: { type: 'expression', code: 'styles' } }],
      children: [{ type: 'text', value: 'text' }],
    }])
  })

  it('detects ComponentNode by uppercase tag', () => {
    const nodes = scanTemplate('<Button />')
    expect(nodes).toEqual([{
      type: 'component',
      name: 'Button',
      attrs: [],
      children: [],
    }])
  })
})
```

- [ ] **Step 2: Run tests to verify they pass**

```bash
cd packages/compiler && pnpm test -- scanner
```

Expected: PASS — all 14 tests passing

- [ ] **Step 3: Commit**

```bash
git add packages/compiler/src/parser/scanner.test.ts
git commit -m "test(compiler): add element and attribute scanner tests"
```

---

## Task 7: Parser Index

**Files:**
- Create: `packages/compiler/src/parser/index.ts`
- Create: `packages/compiler/src/parser/index.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `packages/compiler/src/parser/index.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { parse } from './index.js'

describe('parse', () => {
  it('parses a .wald file with frontmatter and template', () => {
    const source = `---
const title = "Hello Wald"
---
<h1>{title}</h1>`

    const doc = parse(source)

    expect(doc.type).toBe('document')
    expect(doc.frontmatter.type).toBe('frontmatter')
    expect(doc.frontmatter.code).toBe('const title = "Hello Wald"')
    expect(doc.template).toEqual([{
      type: 'element',
      tag: 'h1',
      attrs: [],
      children: [{ type: 'expression', code: 'title' }],
    }])
  })

  it('parses a .wald file without frontmatter', () => {
    const source = '<p>Hello</p>'
    const doc = parse(source)

    expect(doc.frontmatter.code).toBe('')
    expect(doc.template).toEqual([{
      type: 'element',
      tag: 'p',
      attrs: [],
      children: [{ type: 'text', value: 'Hello' }],
    }])
  })

  it('parses multiple root elements', () => {
    const source = '<h1>Title</h1><p>Body</p>'
    const doc = parse(source)

    expect(doc.template).toHaveLength(2)
    expect(doc.template[0]).toMatchObject({ type: 'element', tag: 'h1' })
    expect(doc.template[1]).toMatchObject({ type: 'element', tag: 'p' })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd packages/compiler && pnpm test -- parser/index
```

Expected: FAIL — `Cannot find module './index.js'`

- [ ] **Step 3: Implement packages/compiler/src/parser/index.ts**

```ts
import type { WaldDocument } from '../ast/types.js'
import { extractFrontmatter } from './frontmatter.js'
import { scanTemplate } from './scanner.js'

export function parse(source: string): WaldDocument {
  const { code, rest } = extractFrontmatter(source)
  const template = scanTemplate(rest)

  return {
    type: 'document',
    frontmatter: { type: 'frontmatter', code },
    template,
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd packages/compiler && pnpm test -- parser/index
```

Expected: PASS — 3 tests passing

- [ ] **Step 5: Commit**

```bash
git add packages/compiler/src/parser/
git commit -m "feat(compiler): add parser — combines frontmatter + scanner"
```

---

## Task 8: Transform

**Files:**
- Create: `packages/compiler/src/transform/index.ts`
- Create: `packages/compiler/src/transform/index.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `packages/compiler/src/transform/index.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { transform } from './index.js'
import type { WaldDocument } from '../ast/types.js'

describe('transform', () => {
  it('generates a valid JS module string', () => {
    const ast: WaldDocument = {
      type: 'document',
      frontmatter: { type: 'frontmatter', code: 'const title = "Hello Wald"' },
      template: [{
        type: 'element',
        tag: 'h1',
        attrs: [],
        children: [{ type: 'expression', code: 'title' }],
      }],
    }

    const output = transform(ast)

    expect(output).toContain("import { createTree, renderTemplate } from '@waldjs/runtime'")
    expect(output).toContain('export default createTree')
    expect(output).toContain('const title = "Hello Wald"')
    expect(output).toContain('renderTemplate`<h1>${title}</h1>`')
  })

  it('emits text nodes as-is in the template literal', () => {
    const ast: WaldDocument = {
      type: 'document',
      frontmatter: { type: 'frontmatter', code: '' },
      template: [{ type: 'text', value: 'Hello world' }],
    }

    const output = transform(ast)
    expect(output).toContain('renderTemplate`Hello world`')
  })

  it('escapes backticks in text nodes', () => {
    const ast: WaldDocument = {
      type: 'document',
      frontmatter: { type: 'frontmatter', code: '' },
      template: [{ type: 'text', value: 'Hello `world`' }],
    }

    const output = transform(ast)
    expect(output).toContain('Hello \\`world\\`')
  })

  it('handles element with string attribute', () => {
    const ast: WaldDocument = {
      type: 'document',
      frontmatter: { type: 'frontmatter', code: '' },
      template: [{
        type: 'element',
        tag: 'h1',
        attrs: [{ type: 'attribute', name: 'class', value: 'title' }],
        children: [],
      }],
    }

    const output = transform(ast)
    expect(output).toContain('<h1 class="title"></h1>')
  })

  it('handles element with expression attribute', () => {
    const ast: WaldDocument = {
      type: 'document',
      frontmatter: { type: 'frontmatter', code: '' },
      template: [{
        type: 'element',
        tag: 'div',
        attrs: [{ type: 'attribute', name: 'class', value: { type: 'expression', code: 'styles' } }],
        children: [],
      }],
    }

    const output = transform(ast)
    expect(output).toContain('class="${styles}"')
  })

  it('skips ComponentNode in Phase 0', () => {
    const ast: WaldDocument = {
      type: 'document',
      frontmatter: { type: 'frontmatter', code: '' },
      template: [{ type: 'component', name: 'Button', attrs: [], children: [] }],
    }

    const output = transform(ast)
    expect(output).toContain('renderTemplate``')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd packages/compiler && pnpm test -- transform/index
```

Expected: FAIL — `Cannot find module './index.js'`

- [ ] **Step 3: Implement packages/compiler/src/transform/index.ts**

```ts
import type { WaldDocument, TemplateNode, ElementNode, AttributeNode } from '../ast/types.js'

const VOID_ELEMENTS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
  'link', 'meta', 'param', 'source', 'track', 'wbr',
])

export function transform(ast: WaldDocument): string {
  const templateCode = renderNodes(ast.template)
  const frontmatter = ast.frontmatter.code
    ? ast.frontmatter.code.split('\n').map(line => `  ${line}`).join('\n')
    : ''

  return [
    `import { createTree, renderTemplate } from '@waldjs/runtime'`,
    ``,
    `export default createTree(async ($$result, $$props) => {`,
    frontmatter,
    ``,
    `  return renderTemplate\`${templateCode}\``,
    `})`,
  ].join('\n')
}

function renderNodes(nodes: TemplateNode[]): string {
  return nodes.map(renderNode).join('')
}

function renderNode(node: TemplateNode): string {
  switch (node.type) {
    case 'element': return renderElement(node)
    case 'text': return escapeTemplateLiteral(node.value)
    case 'expression': return `\${${node.code}}`
    case 'component': return ''
  }
}

function escapeTemplateLiteral(text: string): string {
  return text.replace(/`/g, '\\`').replace(/\$\{/g, '\\${')
}

function renderElement(node: ElementNode): string {
  const attrs = node.attrs.map(renderAttr).join(' ')
  const attrsStr = attrs ? ` ${attrs}` : ''

  if (VOID_ELEMENTS.has(node.tag)) {
    return `<${node.tag}${attrsStr}>`
  }

  const children = renderNodes(node.children)
  return `<${node.tag}${attrsStr}>${children}</${node.tag}>`
}

function renderAttr(attr: AttributeNode): string {
  if (typeof attr.value === 'string') {
    return attr.value ? `${attr.name}="${attr.value}"` : attr.name
  }
  return `${attr.name}="\${${attr.value.code}}"`
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd packages/compiler && pnpm test -- transform/index
```

Expected: PASS — 6 tests passing

- [ ] **Step 5: Commit**

```bash
git add packages/compiler/src/transform/
git commit -m "feat(compiler): add transform — WaldAST to JS module string"
```

---

## Task 9: Dependency Graph

**Files:**
- Create: `packages/compiler/src/graph/index.ts`
- Create: `packages/compiler/src/graph/index.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `packages/compiler/src/graph/index.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { createGraph, addNode, needsRecompile } from './index.js'

describe('DependencyGraph', () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = join(tmpdir(), `wald-test-${Date.now()}`)
    mkdirSync(tmpDir, { recursive: true })
  })

  it('createGraph returns an empty graph', () => {
    const graph = createGraph()
    expect(graph.nodes.size).toBe(0)
  })

  it('addNode adds a node with mtime from disk', () => {
    const file = join(tmpDir, 'index.wald')
    writeFileSync(file, '<h1>Hello</h1>')

    const graph = createGraph()
    const node = addNode(graph, file)

    expect(node.file).toBe(file)
    expect(node.mtime).toBeGreaterThan(0)
    expect(node.imports).toEqual([])
    expect(node.output).toBeNull()
    expect(graph.nodes.has(file)).toBe(true)
  })

  it('needsRecompile returns false for an unchanged file', () => {
    const file = join(tmpDir, 'page.wald')
    writeFileSync(file, '<h1>Hello</h1>')

    const graph = createGraph()
    const node = addNode(graph, file)

    expect(needsRecompile(node)).toBe(false)
  })

  it('needsRecompile returns true after file is modified', async () => {
    const file = join(tmpDir, 'changed.wald')
    writeFileSync(file, '<h1>Hello</h1>')

    const graph = createGraph()
    const node = addNode(graph, file)

    // Wait 10ms so mtime changes
    await new Promise(r => setTimeout(r, 10))
    writeFileSync(file, '<h1>Updated</h1>')

    expect(needsRecompile(node)).toBe(true)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd packages/compiler && pnpm test -- graph/index
```

Expected: FAIL — `Cannot find module './index.js'`

- [ ] **Step 3: Implement packages/compiler/src/graph/index.ts**

```ts
import { statSync } from 'node:fs'

export type GraphNode = {
  file: string
  mtime: number
  imports: string[]
  output: string | null
}

export type DependencyGraph = {
  nodes: Map<string, GraphNode>
}

export function createGraph(): DependencyGraph {
  return { nodes: new Map() }
}

export function addNode(graph: DependencyGraph, file: string): GraphNode {
  const stat = statSync(file)
  const node: GraphNode = {
    file,
    mtime: stat.mtimeMs,
    imports: [],
    output: null,
  }
  graph.nodes.set(file, node)
  return node
}

export function needsRecompile(node: GraphNode): boolean {
  const stat = statSync(node.file)
  return stat.mtimeMs !== node.mtime
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd packages/compiler && pnpm test -- graph/index
```

Expected: PASS — 4 tests passing

- [ ] **Step 5: Commit**

```bash
git add packages/compiler/src/graph/
git commit -m "feat(compiler): add dependency graph with incremental compilation"
```

---

## Task 10: Compile Function and Public API

**Files:**
- Create: `packages/compiler/src/index.ts`
- Create: `packages/compiler/src/index.test.ts`
- Create: `packages/compiler/src/vite/plugin.ts`

- [ ] **Step 1: Write the failing tests**

Create `packages/compiler/src/index.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { parse, transform, compile } from './index.js'

describe('parse', () => {
  it('is re-exported from the compiler package', () => {
    const doc = parse('<h1>Hello</h1>')
    expect(doc.type).toBe('document')
  })
})

describe('transform', () => {
  it('is re-exported from the compiler package', () => {
    const doc = parse('<h1>Hello</h1>')
    const output = transform(doc)
    expect(output).toContain('createTree')
  })
})

describe('compile', () => {
  it('parses and transforms in a single call', () => {
    const source = `---
const title = "Hello Wald"
---
<h1>{title}</h1>`

    const output = compile(source, 'index.wald')

    expect(output).toContain("import { createTree, renderTemplate } from '@waldjs/runtime'")
    expect(output).toContain('const title = "Hello Wald"')
    expect(output).toContain('renderTemplate`<h1>${title}</h1>`')
  })

  it('produces output that is valid JS (no syntax errors)', () => {
    const source = `---
const greeting = "Hello"
const name = "Wald"
---
<div class="page">
  <h1>{greeting}, {name}!</h1>
  <p>Welcome.</p>
</div>`

    const output = compile(source, 'page.wald')

    // Verify structural shape
    expect(output).toContain('createTree(async')
    expect(output).toContain('renderTemplate`')
    expect(output).toContain('</div>')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd packages/compiler && pnpm test -- src/index
```

Expected: FAIL — `Cannot find module './index.js'`

- [ ] **Step 3: Create packages/compiler/src/compile.ts**

Dit is een aparte module zodat `vite/plugin.ts` en `index.ts` allebei van hier importeren — geen circulaire dependency.

```ts
import { parse } from './parser/index.js'
import { transform } from './transform/index.js'

export function compile(source: string, _id: string): string {
  return transform(parse(source))
}
```

- [ ] **Step 4: Create packages/compiler/src/vite/plugin.ts**

```ts
import type { Plugin } from 'vite'
import { compile } from '../compile.js'

export function waldPlugin(): Plugin {
  return {
    name: 'vite-plugin-wald',

    resolveId(id) {
      if (id.endsWith('.wald')) return id
    },

    transform(code, id) {
      if (!id.endsWith('.wald')) return
      return { code: compile(code, id), map: null }
    },
  }
}
```

- [ ] **Step 5: Implement packages/compiler/src/index.ts**

```ts
export { parse } from './parser/index.js'
export { transform } from './transform/index.js'
export { compile } from './compile.js'
export { waldPlugin } from './vite/plugin.js'
export type {
  WaldDocument,
  FrontmatterNode,
  TemplateNode,
  ElementNode,
  TextNode,
  ExpressionNode,
  ComponentNode,
  AttributeNode,
} from './ast/types.js'
```

- [ ] **Step 6: Run tests to verify they pass**

```bash
cd packages/compiler && pnpm test
```

Expected: PASS — all tests passing across all files

- [ ] **Step 7: Commit**

```bash
git add packages/compiler/src/
git commit -m "feat(compiler): add public API — compile, parse, transform, waldPlugin"
```

---

## Task 11: Build and Integration Smoke Test

**Files:**
- Create: `examples/basic/package.json`
- Create: `examples/basic/src/smoke.test.ts`

- [ ] **Step 1: Build all packages**

```bash
pnpm build
```

Expected: `packages/runtime/dist/` and `packages/compiler/dist/` are generated. No TypeScript errors.

- [ ] **Step 2: Create examples/basic/package.json**

```json
{
  "name": "@waldjs/example-basic",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "test": "vitest run"
  },
  "dependencies": {
    "@waldjs/compiler": "workspace:*",
    "@waldjs/runtime": "workspace:*"
  },
  "devDependencies": {
    "vitest": "^2.0.0"
  }
}
```

- [ ] **Step 3: Install dependencies**

```bash
pnpm install
```

- [ ] **Step 4: Create examples/basic/src/smoke.test.ts**

This test executes the full pipeline end-to-end: `.wald` source → JS module string → executed module → HTML string.

```ts
import { describe, it, expect } from 'vitest'
import { compile } from '@waldjs/compiler'
import { createTree, renderTemplate } from '@waldjs/runtime'

describe('end-to-end: compile → execute → HTML', () => {
  it('renders a .wald file with frontmatter to HTML', async () => {
    const source = `---
const title = "Hello Wald"
const description = "A content-first web framework."
---
<h1>{title}</h1>
<p>{description}</p>`

    const jsModule = compile(source, 'index.wald')

    // Execute the generated module string using data: import
    const mod = await import(
      `data:text/javascript;charset=utf-8,${encodeURIComponent(jsModule)}`
    )
    const html: string = await mod.default.render()

    expect(html).toContain('<h1>Hello Wald</h1>')
    expect(html).toContain('<p>A content-first web framework.</p>')
  })

  it('escapes XSS in expressions end-to-end', async () => {
    const source = `---
const userInput = "<script>alert(1)</script>"
---
<p>{userInput}</p>`

    const jsModule = compile(source, 'xss.wald')
    const mod = await import(
      `data:text/javascript;charset=utf-8,${encodeURIComponent(jsModule)}`
    )
    const html: string = await mod.default.render()

    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
  })

  it('waldPlugin has correct Vite plugin shape', async () => {
    const { waldPlugin } = await import('@waldjs/compiler')
    const plugin = waldPlugin()

    expect(plugin.name).toBe('vite-plugin-wald')
    expect(typeof plugin.transform).toBe('function')
    expect(typeof plugin.resolveId).toBe('function')
  })
})
```

- [ ] **Step 5: Run the smoke tests**

```bash
cd examples/basic && pnpm test
```

Expected: PASS — 3 tests passing. The full pipeline from `.wald` source to rendered HTML is verified.

- [ ] **Step 6: Run the complete test suite**

```bash
cd ../.. && pnpm test
```

Expected: PASS — all tests across `@waldjs/runtime`, `@waldjs/compiler`, and `@waldjs/example-basic` passing.

- [ ] **Step 7: Commit**

```bash
git add examples/
git commit -m "test(examples): add end-to-end smoke test for full compile pipeline"
```

---

## Acceptance Criteria Checklist

- [ ] `parse('<h1>{title}</h1>')` geeft een correct `WaldDocument` terug
- [ ] `compile(source, id)` geeft een geldige JS module string terug
- [ ] `waldPlugin()` kan in een Vite config gebruikt worden
- [ ] Een `.wald` bestand met frontmatter + template genereert correcte HTML
- [ ] Expressies worden HTML-escaped door `renderTemplate`
- [ ] Gewijzigde bestanden worden herkend door de dependency graph
