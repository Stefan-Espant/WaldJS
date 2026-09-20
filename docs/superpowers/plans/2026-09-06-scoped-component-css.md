# Scoped Component CSS Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a `.wald` file declare a `<style>` block whose CSS is automatically scoped to that component's own markup, closing issue [#25](https://github.com/Stefan-Espant/WaldJS/issues/25).

**Architecture:** The compiler recognizes a top-level `<style>` block, computes a scope hash from the file's path (`sha256(fileId).slice(0,8)`), rewrites the block's selectors to end in `[data-wald-<hash>]` via a small hand-rolled CSS tokenizer, and stamps that same attribute onto every element the component's own template renders. The CLI scans every `.wald` file to bundle all scoped CSS into one file (`dist/assets/wald-components.css` for `wald build`, served live at the same URL by `wald grow`), and links it into a page's `<head>` only when that page's rendered HTML actually carries a scope attribute.

**Tech Stack:** TypeScript, `node:crypto` (built-in, no new dependency), Vitest.

**Spec:** `docs/superpowers/specs/2026-09-06-scoped-component-css-design.md`

---

## Before you start

Create and switch to a feature branch from an up-to-date `main`:

```bash
git checkout main
git pull --ff-only
git checkout -b feat/issue-25-scoped-css
```

All tasks below assume the working directory is the repo root, `/Users/stefan/Desktop/semantique-agency/repositories/waldjs`.

---

### Task 1: AST — add `StyleNode` and `WaldDocument.styles`

**Files:**
- Modify: `packages/compiler/src/ast/types.ts`

- [ ] **Step 1: Add the type**

Edit `packages/compiler/src/ast/types.ts`. Add `StyleNode` to the `TemplateNode` union and an optional `styles` field to `WaldDocument`:

```ts
export type WaldDocument = {
  type: 'document'
  frontmatter: FrontmatterNode
  template: TemplateNode[]
  // Optional (not required) so the ~20 hand-written WaldDocument literals in
  // transform/index.test.ts that predate this feature keep compiling as-is —
  // transformWithMap() treats a missing field the same as `null`.
  styles?: string | null
}

export type TemplateNode =
  | ElementNode
  | TextNode
  | ExpressionNode
  | ComponentNode
  | ScriptNode
  | StyleNode

export type StyleNode = {
  type: 'style'
  content: string
  line: number
  column: number
}
```

(`ScriptNode` stays exactly where it is; just add `StyleNode` after it in the union, and add the new `StyleNode` type definition after `ScriptNode`'s.)

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @waldjs/compiler exec tsc --noEmit`
Expected: passes (nothing references `StyleNode` yet, so this only confirms the new types themselves are well-formed).

- [ ] **Step 3: Commit**

```bash
git add packages/compiler/src/ast/types.ts
git commit -m "compiler: add StyleNode AST type"
```

---

### Task 2: Scanner — recognize a `<style>` block

**Files:**
- Modify: `packages/compiler/src/parser/scanner.ts`
- Test: `packages/compiler/src/parser/scanner.test.ts`

- [ ] **Step 1: Write the failing tests**

In `packages/compiler/src/parser/scanner.test.ts`, change the existing type-only import line:

```ts
import type { ScriptNode } from '../ast/types.js'
```

to:

```ts
import type { ScriptNode, StyleNode } from '../ast/types.js'
```

Then add this new `describe` block near the existing `describe('scanTemplate — script', ...)` block:

```ts
describe('scanTemplate — style', () => {
  it('scans a style block as a single node holding only its inner content', () => {
    const nodes = scanTemplate('<style>.card { color: red }</style>')
    expect(nodes).toEqual([{ type: 'style', content: '.card { color: red }', line: 1, column: 1 } satisfies StyleNode])
  })

  it('does not choke on braces inside the style content', () => {
    const nodes = scanTemplate('<style>.a { color: red } .b { color: blue }</style>')
    expect(nodes).toEqual([{ type: 'style', content: '.a { color: red } .b { color: blue }', line: 1, column: 1 }])
  })

  it('tracks the line and column of the opening tag', () => {
    // nodes[0] is the <div></div> element, nodes[1] is the whitespace text
    // node for the newline between the two tags, nodes[2] is the style block.
    const nodes = scanTemplate('<div></div>\n<style>.a{color:red}</style>')
    expect(nodes[2]).toMatchObject({ type: 'style', line: 2, column: 1 })
  })

  it('treats content after the style block as a sibling node', () => {
    const nodes = scanTemplate('<style>.a{color:red}</style><h1>Hi</h1>')
    expect(nodes[1]).toEqual({ type: 'element', tag: 'h1', attrs: [], children: [{ type: 'text', value: 'Hi' }] })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @waldjs/compiler exec vitest run scanner.test.ts`
Expected: FAIL — `<style>` is currently scanned as a plain lowercase element, so `nodes` won't match `{ type: 'style', ... }` (and the CSS content's `{`/`}` will likely be mis-parsed as nested elements/expressions, producing something unrelated).

- [ ] **Step 3: Implement `isStyleTag`/`scanStyle`**

In `packages/compiler/src/parser/scanner.ts`:

1. Add `StyleNode` to the type-only import at the top:

```ts
import type { TemplateNode, ElementNode, ComponentNode, AttributeNode, ScriptNode, StyleNode } from '../ast/types.js'
```

2. In `scanNode()`, check for a style tag right alongside the existing script check:

```ts
  private scanNode(): TemplateNode | null {
    if (this.current === '<' && this.peek(1) === '!') {
      return this.scanRawMarkup()
    }
    if (this.current === '<' && this.peek(1) !== '/') {
      if (this.isScriptTag()) return this.scanScript()
      if (this.isStyleTag()) return this.scanStyle()
      return this.scanElement()
    }
    if (this.current === '{') {
      return this.scanExpression()
    }
    return this.scanText()
  }
```

3. Add `isStyleTag` and `scanStyle` right after `scanScript`:

```ts
  private isStyleTag(): boolean {
    const ahead = this.source.slice(this.pos + 1, this.pos + 7).toLowerCase()
    return ahead.startsWith('style') && /[\s>/]/.test(ahead[5] ?? '>')
  }

  // Unlike scanScript (whose `content` is the whole `<script>...</script>` tag,
  // reproduced verbatim in the HTML output), a style block is never rendered
  // inline — parser/index.ts lifts it out to WaldDocument.styles — so this
  // only needs to capture the CSS between the tags, not the tags themselves.
  private scanStyle(): StyleNode {
    const { line, column } = offsetToLineCol(this.source, this.pos)
    const openTagEnd = this.source.indexOf('>', this.pos)
    const contentStart = openTagEnd === -1 ? this.source.length : openTagEnd + 1
    const closeTag = '</style>'
    const closeIndex = this.source.toLowerCase().indexOf(closeTag, contentStart)
    const contentEnd = closeIndex === -1 ? this.source.length : closeIndex
    const content = this.source.slice(contentStart, contentEnd)
    this.pos = closeIndex === -1 ? this.source.length : closeIndex + closeTag.length
    return { type: 'style', content, line, column }
  }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @waldjs/compiler exec vitest run scanner.test.ts`
Expected: PASS (all tests in the file, including the pre-existing ones).

- [ ] **Step 5: Commit**

```bash
git add packages/compiler/src/parser/scanner.ts packages/compiler/src/parser/scanner.test.ts
git commit -m "compiler: scan <style> blocks as StyleNode"
```

---

### Task 3: Parser — lift `styles` out of the template, error on a second block

**Files:**
- Modify: `packages/compiler/src/parser/index.ts`
- Test: `packages/compiler/src/parser/index.test.ts`

- [ ] **Step 1: Write the failing tests**

Add to `packages/compiler/src/parser/index.test.ts`:

```ts
describe('parse — styles', () => {
  it('lifts a <style> block out of the template into doc.styles', () => {
    const doc = parse('<style>.a { color: red }</style><h1>Hi</h1>')
    expect(doc.styles).toBe('.a { color: red }')
    expect(doc.template).toEqual([{ type: 'element', tag: 'h1', attrs: [], children: [{ type: 'text', value: 'Hi' }] }])
  })

  it('sets styles to null when there is no <style> block', () => {
    const doc = parse('<h1>Hi</h1>')
    expect(doc.styles).toBeNull()
  })

  it('throws when a file has more than one <style> block', () => {
    expect(() => parse('<style>.a{color:red}</style><style>.b{color:blue}</style>')).toThrow(
      'A .wald file can only have one <style> block',
    )
  })

  it('lifts a <style> block nested inside an element', () => {
    const doc = parse('<div><style>.a{color:red}</style><p>Hi</p></div>')
    expect(doc.styles).toBe('.a{color:red}')
    expect(doc.template).toEqual([{
      type: 'element',
      tag: 'div',
      attrs: [],
      children: [{ type: 'element', tag: 'p', attrs: [], children: [{ type: 'text', value: 'Hi' }] }],
    }])
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @waldjs/compiler exec vitest run parser/index.test.ts`
Expected: FAIL — `doc.styles` is `undefined` (parse doesn't set it yet), and the `<style>` node is still present in `doc.template`.

- [ ] **Step 3: Implement extraction**

Replace the contents of `packages/compiler/src/parser/index.ts`:

```ts
import type { WaldDocument, TemplateNode, StyleNode } from '../ast/types.js'
import { extractFrontmatter } from './frontmatter.js'
import { scanTemplate } from './scanner.js'
import { WaldError } from '../errors.js'

export function parse(source: string): WaldDocument {
  const { code, rest, line } = extractFrontmatter(source)
  const scanned = scanTemplate(rest)
  const { template, styles } = extractStyles(scanned)

  return {
    type: 'document',
    frontmatter: { type: 'frontmatter', code, line },
    template,
    styles,
  }
}

function extractStyles(nodes: TemplateNode[]): { template: TemplateNode[]; styles: string | null } {
  const found: StyleNode[] = []
  const template = stripStyles(nodes, found)
  if (found.length > 1) {
    throw new WaldError('A .wald file can only have one <style> block', found[1].line, found[1].column)
  }
  return { template, styles: found.length === 1 ? found[0].content : null }
}

function stripStyles(nodes: TemplateNode[], found: StyleNode[]): TemplateNode[] {
  const kept: TemplateNode[] = []
  for (const node of nodes) {
    if (node.type === 'style') {
      found.push(node)
    } else if (node.type === 'element') {
      kept.push({ ...node, children: stripStyles(node.children, found) })
    } else if (node.type === 'component') {
      kept.push({ ...node, children: stripStyles(node.children, found) })
    } else {
      kept.push(node)
    }
  }
  return kept
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @waldjs/compiler exec vitest run parser/index.test.ts`
Expected: PASS (all tests in the file).

- [ ] **Step 5: Commit**

```bash
git add packages/compiler/src/parser/index.ts packages/compiler/src/parser/index.test.ts
git commit -m "compiler: lift <style> blocks into WaldDocument.styles"
```

---

### Task 4: `scope-css.ts` — the selector-scoping tokenizer

**Files:**
- Create: `packages/compiler/src/scope-css.ts`
- Test: `packages/compiler/src/scope-css.test.ts`

This is the piece with the most edge cases, so it gets its own file and its own thorough test file before anything else depends on it. The implementation below has already been prototyped and manually verified against every case in the test file (including the malformed-CSS case), so step 3 is a direct transcription, not a guess.

- [ ] **Step 1: Write the failing tests**

Create `packages/compiler/src/scope-css.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { scopeCss, scopeHash } from './scope-css.js'

describe('scopeHash', () => {
  it('is deterministic for the same file id', () => {
    expect(scopeHash('/src/components/Card.wald')).toBe(scopeHash('/src/components/Card.wald'))
  })

  it('differs between two different file ids', () => {
    expect(scopeHash('/src/components/Card.wald')).not.toBe(scopeHash('/src/components/Nav.wald'))
  })

  it('is 8 lowercase hex characters', () => {
    expect(scopeHash('/src/components/Card.wald')).toMatch(/^[0-9a-f]{8}$/)
  })
})

describe('scopeCss', () => {
  it('scopes a simple class selector', () => {
    expect(scopeCss('.card { color: red }', 'ab12cd34')).toBe('.card[data-wald-ab12cd34]{ color: red }')
  })

  it('scopes each selector in a comma-separated list independently', () => {
    expect(scopeCss('.a, .b { color: red }', 'ab12cd34')).toBe(
      '.a[data-wald-ab12cd34], .b[data-wald-ab12cd34]{ color: red }',
    )
  })

  it('scopes only the last compound segment of a descendant selector', () => {
    expect(scopeCss('.card .title { color: red }', 'ab12cd34')).toBe(
      '.card .title[data-wald-ab12cd34]{ color: red }',
    )
  })

  it('scopes only the last compound segment of a combinator selector', () => {
    expect(scopeCss('.card > .title { color: red }', 'ab12cd34')).toBe(
      '.card > .title[data-wald-ab12cd34]{ color: red }',
    )
  })

  it('inserts the scope attribute before a trailing pseudo-class', () => {
    expect(scopeCss('.card:hover { color: red }', 'ab12cd34')).toBe(
      '.card[data-wald-ab12cd34]:hover{ color: red }',
    )
  })

  it('inserts the scope attribute before a trailing pseudo-element', () => {
    expect(scopeCss('.card::before { content: "x" }', 'ab12cd34')).toBe(
      '.card[data-wald-ab12cd34]::before{ content: "x" }',
    )
  })

  it('inserts the scope attribute before a chain of pseudo-classes', () => {
    expect(scopeCss('.card:not(.x):hover { color: red }', 'ab12cd34')).toBe(
      '.card[data-wald-ab12cd34]:not(.x):hover{ color: red }',
    )
  })

  it('recurses into an @media block, leaving the condition untouched', () => {
    expect(scopeCss('@media (min-width: 600px) { .card { color: red } }', 'ab12cd34')).toBe(
      '@media (min-width: 600px) { .card[data-wald-ab12cd34]{ color: red } }',
    )
  })

  it('recurses into an @supports block', () => {
    expect(scopeCss('@supports (display: grid) { .card { display: grid } }', 'ab12cd34')).toBe(
      '@supports (display: grid) { .card[data-wald-ab12cd34]{ display: grid } }',
    )
  })

  it('scopes multiple rules inside the same @media block', () => {
    expect(
      scopeCss('@media (min-width: 600px) { .a { color: red } .b { color: blue } }', 'ab12cd34'),
    ).toBe('@media (min-width: 600px) { .a[data-wald-ab12cd34]{ color: red } .b[data-wald-ab12cd34]{ color: blue } }')
  })

  it('passes @keyframes through unscoped', () => {
    const css = '@keyframes fade { 0% { opacity: 0 } 100% { opacity: 1 } }'
    expect(scopeCss(css, 'ab12cd34')).toBe(css)
  })

  it('passes @font-face through unscoped', () => {
    const css = '@font-face { font-family: "X"; src: url(x.woff) }'
    expect(scopeCss(css, 'ab12cd34')).toBe(css)
  })

  it('passes a semicolon-terminated at-rule like @import through unscoped', () => {
    expect(scopeCss('@import url(x.css);\n.a { color: red }', 'ab12cd34')).toBe(
      '@import url(x.css);\n.a[data-wald-ab12cd34]{ color: red }',
    )
  })

  it('preserves comments verbatim', () => {
    expect(scopeCss('/* comment */ .card { color: red } /* trailing */', 'ab12cd34')).toBe(
      '/* comment */ .card[data-wald-ab12cd34]{ color: red } /* trailing */',
    )
  })

  it('does not crash or fabricate content on unbalanced braces', () => {
    expect(scopeCss('.a { color: red', 'ab12cd34')).toBe('.a { color: red')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @waldjs/compiler exec vitest run scope-css.test.ts`
Expected: FAIL with "Cannot find module './scope-css.js'" (the file doesn't exist yet).

- [ ] **Step 3: Implement**

Create `packages/compiler/src/scope-css.ts`:

```ts
import { createHash } from 'node:crypto'

/** Deterministic per component file, not per style content — the same
 * component always gets the same scope id, regardless of CSS edits. */
export function scopeHash(fileId: string): string {
  return createHash('sha256').update(fileId).digest('hex').slice(0, 8)
}

// @media/@supports/@layer wrap other rules and need their body recursed into.
// Anything else starting with '@' (@keyframes, @font-face, @page, ...) has a
// prelude that isn't an element selector, so it passes through untouched.
const CONTAINER_AT_RULES = new Set(['media', 'supports', 'layer'])

// Matches one or more trailing pseudo-class/element segments, e.g. ':hover',
// '::before', or a chain like ':not(.x):hover' — used to insert the scope
// attribute before them rather than after.
const TRAILING_PSEUDO = /(::?[\w-]+(?:\([^)]*\))?)+$/

export function scopeCss(css: string, hash: string): string {
  return scopeBlock(css, hash)
}

function scopeBlock(css: string, hash: string): string {
  let out = ''
  let i = 0

  while (i < css.length) {
    if (css[i] === '/' && css[i + 1] === '*') {
      const end = css.indexOf('*/', i + 2)
      const close = end === -1 ? css.length : end + 2
      out += css.slice(i, close)
      i = close
      continue
    }
    if (/\s/.test(css[i])) {
      out += css[i]
      i++
      continue
    }

    const ruleStart = i
    let depthParen = 0
    let j = i
    while (j < css.length) {
      const ch = css[j]
      if (ch === '(') { depthParen++; j++; continue }
      if (ch === ')') { depthParen--; j++; continue }
      if (ch === '/' && css[j + 1] === '*') {
        const end = css.indexOf('*/', j + 2)
        j = end === -1 ? css.length : end + 2
        continue
      }
      if (depthParen === 0 && (ch === '{' || ch === ';')) break
      j++
    }
    if (j >= css.length) {
      out += css.slice(ruleStart)
      break
    }
    const prelude = css.slice(ruleStart, j)
    if (css[j] === ';') {
      out += prelude + ';'
      i = j + 1
      continue
    }

    const bodyStart = j + 1
    let depthBrace = 1
    let k = bodyStart
    while (k < css.length && depthBrace > 0) {
      if (css[k] === '{') { depthBrace++; k++; continue }
      if (css[k] === '}') { depthBrace--; k++; continue }
      if (css[k] === '/' && css[k + 1] === '*') {
        const end = css.indexOf('*/', k + 2)
        k = end === -1 ? css.length : end + 2
        continue
      }
      k++
    }
    if (depthBrace > 0) {
      // Unbalanced braces (malformed CSS) — emit the remainder verbatim
      // rather than fabricating a closing brace or truncating content.
      out += css.slice(ruleStart)
      break
    }
    const bodyEnd = k - 1
    const body = css.slice(bodyStart, bodyEnd)

    const trimmedPrelude = prelude.trim()
    if (trimmedPrelude.startsWith('@')) {
      const name = (trimmedPrelude.slice(1).match(/^[\w-]+/) ?? [''])[0]
      out += CONTAINER_AT_RULES.has(name)
        ? `${prelude}{${scopeBlock(body, hash)}}`
        : `${prelude}{${body}}`
    } else {
      out += `${scopeSelectorList(prelude, hash)}{${body}}`
    }
    i = bodyEnd + 1
  }

  return out
}

function scopeSelectorList(selectorList: string, hash: string): string {
  return selectorList
    .split(',')
    .map(sel => scopeSelector(sel.trim(), hash))
    .join(', ')
}

function scopeSelector(selector: string, hash: string): string {
  if (!selector) return selector
  const attr = `[data-wald-${hash}]`
  const match = selector.match(TRAILING_PSEUDO)
  if (match && match.index !== undefined) {
    return `${selector.slice(0, match.index)}${attr}${selector.slice(match.index)}`
  }
  return `${selector}${attr}`
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @waldjs/compiler exec vitest run scope-css.test.ts`
Expected: PASS (all 17 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/compiler/src/scope-css.ts packages/compiler/src/scope-css.test.ts
git commit -m "compiler: add scopeCss selector-scoping tokenizer"
```

---

### Task 5: Transform — apply the scope attribute and return `styles`

**Files:**
- Modify: `packages/compiler/src/transform/index.ts`
- Modify: `packages/compiler/src/compile.ts`
- Test: `packages/compiler/src/transform/index.test.ts`

- [ ] **Step 1: Write the failing tests**

Add to `packages/compiler/src/transform/index.test.ts` (a new `describe` block; this file already imports `transformWithMap` and `WaldDocument`, reuse those):

```ts
describe('transformWithMap — scoped styles', () => {
  it('returns null styles and adds no attribute when the document has no styles', () => {
    const ast: WaldDocument = {
      type: 'document',
      frontmatter: { type: 'frontmatter', code: '' },
      template: [{ type: 'element', tag: 'h1', attrs: [], children: [{ type: 'text', value: 'Hi' }] }],
      styles: null,
    }
    const result = transformWithMap(ast, '/src/pages/index.wald')
    expect(result.styles).toBeNull()
    expect(result.code).not.toContain('data-wald-')
  })

  it('stamps every element with a data-wald-<hash> attribute when styles are present', () => {
    const ast: WaldDocument = {
      type: 'document',
      frontmatter: { type: 'frontmatter', code: '' },
      template: [{
        type: 'element',
        tag: 'div',
        attrs: [{ type: 'attribute', name: 'class', value: 'card' }],
        children: [{ type: 'element', tag: 'span', attrs: [], children: [] }],
      }],
      styles: '.card { color: red }',
    }
    const result = transformWithMap(ast, '/src/components/Card.wald')
    expect(result.code).toMatch(/<div class="card" data-wald-[0-9a-f]{8}>/)
    expect(result.code).toMatch(/<span data-wald-[0-9a-f]{8}>/)
  })

  it('scopes the returned CSS with the same hash used on the elements', () => {
    const ast: WaldDocument = {
      type: 'document',
      frontmatter: { type: 'frontmatter', code: '' },
      template: [{ type: 'element', tag: 'div', attrs: [], children: [] }],
      styles: '.card { color: red }',
    }
    const result = transformWithMap(ast, '/src/components/Card.wald')
    const hashInMarkup = result.code.match(/data-wald-([0-9a-f]{8})/)?.[1]
    expect(hashInMarkup).toBeTruthy()
    expect(result.styles).toBe(`.card[data-wald-${hashInMarkup}]{ color: red }`)
  })

  it('produces the same hash for the same file id across two separate compiles', () => {
    const ast: WaldDocument = {
      type: 'document',
      frontmatter: { type: 'frontmatter', code: '' },
      template: [{ type: 'element', tag: 'div', attrs: [], children: [] }],
      styles: '.card {}',
    }
    const first = transformWithMap(ast, '/src/components/Card.wald')
    const second = transformWithMap(ast, '/src/components/Card.wald')
    expect(first.styles).toBe(second.styles)
  })

  it('treats a document with no styles field the same as styles: null (existing fixtures keep working)', () => {
    const ast: WaldDocument = {
      type: 'document',
      frontmatter: { type: 'frontmatter', code: '' },
      template: [{ type: 'element', tag: 'h1', attrs: [], children: [] }],
      // no `styles` key at all
    }
    const result = transformWithMap(ast, '/src/pages/index.wald')
    expect(result.styles).toBeNull()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @waldjs/compiler exec vitest run transform/index.test.ts`
Expected: FAIL — `transformWithMap` doesn't accept a second argument yet, `result.styles` is `undefined`, and no `data-wald-` attributes are emitted.

- [ ] **Step 3: Implement**

Edit `packages/compiler/src/transform/index.ts`:

1. Add the import:

```ts
import { scopeCss, scopeHash } from '../scope-css.js'
```

2. Update `transform`, `TransformResult`, and `transformWithMap`:

```ts
export function transform(ast: WaldDocument, fileId = ''): string {
  return transformWithMap(ast, fileId).code
}

/** lineMap[i] is the 1-based .wald source line for output line i + 1, or null for generated lines. */
export type LineMap = (number | null)[]

export type TransformResult = { code: string; lineMap: LineMap; styles: string | null }

export function transformWithMap(ast: WaldDocument, fileId = ''): TransformResult {
  const hasStyles = (ast.styles ?? null) !== null
  const hash = hasStyles ? scopeHash(fileId) : null
  const scopeAttr = hash !== null ? ` data-wald-${hash}` : ''
  const styles = hash !== null ? scopeCss(ast.styles as string, hash) : null

  const templateCode = renderNodes(ast.template, scopeAttr)
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

  return { code: out.join('\n'), lineMap: map, styles }
}
```

3. Thread `scopeAttr` through the render functions:

```ts
function renderNodes(nodes: TemplateNode[], scopeAttr: string): string {
  return nodes.map(node => renderNode(node, scopeAttr)).join('')
}

function renderNode(node: TemplateNode, scopeAttr: string): string {
  switch (node.type) {
    case 'element': return renderElement(node, scopeAttr)
    case 'text': return escapeTemplateLiteral(node.value)
    case 'expression': return `\${${node.code}}`
    case 'component': return renderComponent(node, scopeAttr)
    case 'script': return `\${new SafeHtml(${JSON.stringify(node.content)})}`
    // Never actually reached — parser/index.ts lifts every StyleNode out of
    // the tree before it gets here. Handled for switch exhaustiveness.
    case 'style': return ''
  }
}

function renderComponent(node: ComponentNode, scopeAttr: string): string {
  const props = node.attrs
    .map(attr =>
      typeof attr.value === 'string'
        ? `${attr.name}: ${JSON.stringify(attr.value)}`
        : `${attr.name}: (${attr.value.code})`
    )
    .join(', ')
  const propsObj = `{ ${props} }`

  if (node.canopy) {
    const src = `wald:canopy:${node.name}`
    return `\${new SafeHtml('<wald-canopy data-src="${src}" data-strategy="${node.canopy.strategy}" data-props=\\'' + JSON.stringify(${propsObj}) + '\\'>' + await ${node.name}.render(${propsObj}) + '</wald-canopy>')}`
  }

  if (node.children.length > 0) {
    const childrenHtml = renderNodes(node.children, scopeAttr)
    const propsWithPond = props
      ? `${props}, pond: new SafeHtml(renderTemplate\`${childrenHtml}\`)`
      : `pond: new SafeHtml(renderTemplate\`${childrenHtml}\`)`
    return `\${new SafeHtml(await ${node.name}.render({ ${propsWithPond} }))}`
  }

  return `\${new SafeHtml(await ${node.name}.render(${propsObj}))}`
}

function renderElement(node: ElementNode, scopeAttr: string): string {
  const attrs = node.attrs.map(renderAttr).join(' ')
  const attrsStr = `${attrs ? ` ${attrs}` : ''}${scopeAttr}`

  if (VOID_ELEMENTS.has(node.tag)) {
    return `<${node.tag}${attrsStr}>`
  }

  const children = renderNodes(node.children, scopeAttr)
  return `<${node.tag}${attrsStr}>${children}</${node.tag}>`
}
```

`escapeTemplateLiteral` and `renderAttr` are unchanged. The `TemplateNode`/`ElementNode`/`ComponentNode`/`AttributeNode` import line at the top of the file is also unchanged (no new AST types are referenced directly in this file).

4. Edit `packages/compiler/src/compile.ts` to pass the real file id through:

```ts
export function compileWithMap(source: string, id: string): TransformResult {
  try {
    const ast = parse(source)
    return transformWithMap(ast, id)
  } catch (e) {
    if (e instanceof WaldError) {
      e.file = id
    }
    throw e
  }
}
```

(Only the `transformWithMap(ast)` → `transformWithMap(ast, id)` call changes; everything else in the file stays the same.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @waldjs/compiler test -- run`
Expected: PASS — every test in the package, including the ~20 pre-existing `transform(ast)` call sites (which still compile since `fileId` defaults to `''` and none of those fixtures set `styles`).

- [ ] **Step 5: Commit**

```bash
git add packages/compiler/src/transform/index.ts packages/compiler/src/compile.ts packages/compiler/src/transform/index.test.ts
git commit -m "compiler: stamp scope attribute onto elements and return scoped styles"
```

---

### Task 6: CLI — export `walkWaldFiles` for reuse

**Files:**
- Modify: `packages/cli/src/canopy-scan.ts`

- [ ] **Step 1: Change the declaration**

In `packages/cli/src/canopy-scan.ts`, change:

```ts
function walkWaldFiles(dir: string): string[] {
```

to:

```ts
export function walkWaldFiles(dir: string): string[] {
```

No other line in the file changes.

- [ ] **Step 2: Run existing tests to confirm nothing broke**

Run: `pnpm --filter @waldjs/cli exec vitest run canopy-scan.test.ts`
Expected: PASS (exporting a previously-private function doesn't change its behavior).

- [ ] **Step 3: Commit**

```bash
git add packages/cli/src/canopy-scan.ts
git commit -m "cli: export walkWaldFiles for reuse by style-scan"
```

---

### Task 7: CLI — `style-scan.ts` (bundle collector)

**Files:**
- Create: `packages/cli/src/style-scan.ts`
- Test: `packages/cli/src/style-scan.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `packages/cli/src/style-scan.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { collectComponentStyles } from './style-scan.js'

let tmpDir: string

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'wald-style-scan-'))
})

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true })
})

describe('collectComponentStyles', () => {
  it('bundles scoped CSS from a component with a <style> block', () => {
    const srcDir = join(tmpDir, 'src')
    const componentsDir = join(srcDir, 'components')
    mkdirSync(componentsDir, { recursive: true })
    writeFileSync(
      join(componentsDir, 'Card.wald'),
      '---\n---\n<div class="card">Hi</div>\n<style>.card { color: red }</style>',
    )

    const css = collectComponentStyles(srcDir)
    expect(css).toMatch(/\.card\[data-wald-[0-9a-f]{8}\]\{ color: red \}/)
  })

  it('returns an empty string when no component has a <style> block', () => {
    const srcDir = join(tmpDir, 'src')
    const componentsDir = join(srcDir, 'components')
    mkdirSync(componentsDir, { recursive: true })
    writeFileSync(join(componentsDir, 'Plain.wald'), '---\n---\n<div>Hi</div>')

    expect(collectComponentStyles(srcDir)).toBe('')
  })

  it('bundles styles from multiple components, each scoped independently', () => {
    const srcDir = join(tmpDir, 'src')
    const componentsDir = join(srcDir, 'components')
    mkdirSync(componentsDir, { recursive: true })
    writeFileSync(
      join(componentsDir, 'Card.wald'),
      '---\n---\n<div class="card">Hi</div>\n<style>.card { color: red }</style>',
    )
    writeFileSync(
      join(componentsDir, 'Nav.wald'),
      '---\n---\n<nav>Hi</nav>\n<style>nav { color: blue }</style>',
    )

    const css = collectComponentStyles(srcDir)
    expect(css).toMatch(/\.card\[data-wald-[0-9a-f]{8}\]/)
    expect(css).toMatch(/nav\[data-wald-[0-9a-f]{8}\]/)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @waldjs/cli exec vitest run style-scan.test.ts`
Expected: FAIL with "Cannot find module './style-scan.js'".

- [ ] **Step 3: Implement**

Create `packages/cli/src/style-scan.ts`:

```ts
import { compileWithMap } from '@waldjs/compiler'
import { readFileSync } from 'node:fs'
import { walkWaldFiles } from './canopy-scan.js'

/** Bundles every component's scoped CSS into one string. Scanning source
 * files directly (like canopy-scan.ts does for islands) keeps this
 * independent of whether a page actually imports a given component at
 * runtime — simpler than tracking a per-page usage graph, and harmless: an
 * unused component's scoped rule just never matches anything in the DOM. */
export function collectComponentStyles(srcDir: string): string {
  const parts: string[] = []
  for (const file of walkWaldFiles(srcDir)) {
    const { styles } = compileWithMap(readFileSync(file, 'utf8'), file)
    if (styles) parts.push(styles)
  }
  return parts.join('\n')
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @waldjs/cli exec vitest run style-scan.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/cli/src/style-scan.ts packages/cli/src/style-scan.test.ts
git commit -m "cli: add collectComponentStyles bundle collector"
```

---

### Task 8: CLI — `component-styles.ts` (per-page link injection)

**Files:**
- Create: `packages/cli/src/component-styles.ts`
- Test: `packages/cli/src/component-styles.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `packages/cli/src/component-styles.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { injectComponentStyles, needsComponentStyles } from './component-styles.js'

describe('needsComponentStyles', () => {
  it('returns true when the html contains a data-wald-<hash> scope attribute', () => {
    expect(needsComponentStyles('<div class="card" data-wald-ab12cd34>Hi</div>')).toBe(true)
  })

  it('returns false for html with no scope attribute', () => {
    expect(needsComponentStyles('<div class="card">Hi</div>')).toBe(false)
  })
})

describe('injectComponentStyles', () => {
  it('inserts a stylesheet link before </head> when the page uses a styled component', () => {
    const html = '<html><head><title>x</title></head><body><div data-wald-ab12cd34>Hi</div></body></html>'
    const result = injectComponentStyles(html)
    expect(result).toContain('<link rel="stylesheet" href="/assets/wald-components.css">')
    expect(result.indexOf('<link')).toBeGreaterThan(result.indexOf('<title>'))
    expect(result.indexOf('<link')).toBeLessThan(result.indexOf('</head>'))
  })

  it('leaves html without any styled component completely unchanged', () => {
    const html = '<html><head></head><body><div>Hi</div></body></html>'
    expect(injectComponentStyles(html)).toBe(html)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @waldjs/cli exec vitest run component-styles.test.ts`
Expected: FAIL with "Cannot find module './component-styles.js'".

- [ ] **Step 3: Implement**

Create `packages/cli/src/component-styles.ts`:

```ts
// Mirrors the `NO_HOIST_ATTR` pattern in shell.ts and the `wald:prefetch`
// detection in prefetch-runtime.ts: rather than tracking which pages use
// which components, just check the rendered HTML for the marker a styled
// component's own scoping already leaves behind.
const SCOPE_ATTR_PATTERN = /\sdata-wald-[0-9a-f]{8}(?=[\s=/>])/

export function needsComponentStyles(html: string): boolean {
  return SCOPE_ATTR_PATTERN.test(html)
}

export function injectComponentStyles(html: string): string {
  if (!needsComponentStyles(html)) return html
  const link = `<link rel="stylesheet" href="/assets/wald-components.css">`
  return html.includes('</head>') ? html.replace('</head>', `${link}\n</head>`) : html + link
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @waldjs/cli exec vitest run component-styles.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/cli/src/component-styles.ts packages/cli/src/component-styles.test.ts
git commit -m "cli: add needsComponentStyles/injectComponentStyles"
```

---

### Task 9: Wire into `wald grow`

**Files:**
- Modify: `packages/cli/src/commands/grow.ts`
- Test: `packages/cli/src/commands/grow.test.ts`

- [ ] **Step 1: Write the failing tests**

Add to `packages/cli/src/commands/grow.test.ts` (inside the existing `describe('handleRequest', ...)` block, alongside the prefetch tests):

```ts
  it('injects the component-styles link when the rendered page uses a styled component', async () => {
    const routes = [{ pattern: '/about', file: '/pages/about.wald', params: [] }]
    const fakeVite = {
      ssrLoadModule: async (_file: string) => ({
        default: { render: async () => '<div class="card" data-wald-ab12cd34>Hi</div>' },
      }),
    }

    const result = await handleRequest(routes, '/about', fakeVite as any)
    expect(result.body).toContain('<link rel="stylesheet" href="/assets/wald-components.css">')
  })

  it('does not inject the component-styles link for a page with no styled components', async () => {
    const routes = [{ pattern: '/about', file: '/pages/about.wald', params: [] }]
    const fakeVite = {
      ssrLoadModule: async (_file: string) => ({
        default: { render: async () => '<p>About</p>' },
      }),
    }

    const result = await handleRequest(routes, '/about', fakeVite as any)
    expect(result.body).not.toContain('wald-components.css')
  })
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @waldjs/cli exec vitest run grow.test.ts`
Expected: FAIL — the first new test fails because nothing injects the link yet.

- [ ] **Step 3: Implement**

In `packages/cli/src/commands/grow.ts`:

1. Add imports at the top:

```ts
import { injectComponentStyles } from '../component-styles.js'
import { collectComponentStyles } from '../style-scan.js'
```

2. In `handleRequest`, wrap the existing injection call:

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
  let body = injectComponentStyles(injectPrefetchRuntime(hoistScripts(maybeWrap(html))))
  if (vite!.transformIndexHtml) {
    body = await vite!.transformIndexHtml(url, body)
  }
  return { status: 200, body }
}
```

3. In `growCommand`'s `run()`, add a new branch in the raw HTTP handler, immediately before the existing `if (url.startsWith('/assets/'))` branch (this must come first since `/assets/wald-components.css` doesn't correspond to a real file under `src/assets`, and `srcDir` is already in scope from earlier in `run()`):

```ts
    const server = createHttpServer((req, res) => {
      const url = req.url ?? '/'

      if (url === '/assets/wald-components.css') {
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
```

(Everything else in `run()` is unchanged — in particular, recomputing `collectComponentStyles(srcDir)` fresh on every request mirrors how `scanRoutes(pagesDir)` a few lines below is already recomputed on every request, so an edit to a component's `<style>` block is picked up on the next fetch with no extra cache-invalidation logic.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @waldjs/cli exec vitest run grow.test.ts`
Expected: PASS (all tests in the file).

- [ ] **Step 5: Commit**

```bash
git add packages/cli/src/commands/grow.ts packages/cli/src/commands/grow.test.ts
git commit -m "cli: serve wald-components.css and inject it in wald grow"
```

---

### Task 10: Wire into `wald build`

**Files:**
- Modify: `packages/cli/src/commands/build.ts`
- Test: `packages/cli/src/commands/build.test.ts`

- [ ] **Step 1: Write the failing tests**

Add to `packages/cli/src/commands/build.test.ts`, inside `describe('buildPages', ...)`, near the other canopy/asset tests:

```ts
  it('bundles scoped component styles into dist/assets/wald-components.css and links them from pages that use them', async () => {
    const pagesDir = join(tmpDir, 'src', 'pages')
    const componentsDir = join(tmpDir, 'src', 'components')
    const distDir = join(tmpDir, 'dist')
    mkdirSync(pagesDir, { recursive: true })
    mkdirSync(componentsDir, { recursive: true })
    writeFileSync(
      join(componentsDir, 'Card.wald'),
      '---\n---\n<div class="card">Hi</div>\n<style>.card { color: red }</style>',
    )
    writeFileSync(
      join(pagesDir, 'index.wald'),
      "---\nimport Card from '../components/Card.wald'\n---\n<Card />",
    )

    await buildPages(pagesDir, makeConfig(distDir))

    const html = readFileSync(join(distDir, 'index.html'), 'utf8')
    expect(html).toMatch(/<div class="card" data-wald-[0-9a-f]{8}>/)
    expect(html).toContain('<link rel="stylesheet" href="/assets/wald-components.css">')

    const css = readFileSync(join(distDir, 'assets', 'wald-components.css'), 'utf8')
    expect(css).toMatch(/\.card\[data-wald-[0-9a-f]{8}\]\{ color: red \}/)
  })

  it('does not create a component-styles bundle when no component has a <style> block', async () => {
    const pagesDir = join(tmpDir, 'src', 'pages')
    const distDir = join(tmpDir, 'dist')
    mkdirSync(pagesDir, { recursive: true })
    writeFileSync(join(pagesDir, 'index.wald'), '---\n---\n<h1>Hi</h1>')

    await buildPages(pagesDir, makeConfig(distDir))

    expect(existsSync(join(distDir, 'assets', 'wald-components.css'))).toBe(false)
    const html = readFileSync(join(distDir, 'index.html'), 'utf8')
    expect(html).not.toContain('wald-components.css')
  })
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @waldjs/cli exec vitest run build.test.ts`
Expected: FAIL — the first new test fails (`dist/assets/wald-components.css` doesn't exist, no `<link>` in the HTML).

- [ ] **Step 3: Implement**

In `packages/cli/src/commands/build.ts`:

1. Add imports:

```ts
import { injectComponentStyles } from '../component-styles.js'
import { collectComponentStyles } from '../style-scan.js'
```

2. Add `'Bundling component styles'` to the `BuildPhase` union:

```ts
export type BuildPhase =
  | 'Scanning routes'
  | 'Scanning canopies'
  | 'Bundling canopy client'
  | 'Bundling component styles'
  | 'Bundling SSR pages'
  | 'Rendering static pages'
  | 'Rendering dynamic pages'
  | 'Copying public assets'
  | 'Copying source assets'
  | 'Applying adapter'
```

3. Compute the bundle right after canopy bundling, before the SSR build phase:

```ts
  const canopyScriptContents = collectCanopyScriptContents(canopyEntries)
  reporter.onPhase?.('Bundling canopy client')
  const canopyAssets = await buildCanopyClient(canopyEntries, distDir, config.base, config.vite)

  reporter.onPhase?.('Bundling component styles')
  const componentStyles = collectComponentStyles(srcDir)

  reporter.onPhase?.('Bundling SSR pages')
```

4. Wrap both html-assembly lines (static and dynamic rendering loops) with `injectComponentStyles`:

```ts
      const html = injectComponentStyles(injectPrefetchRuntime(applyCanopyAssets(hoistScripts(maybeWrap(rendered)), canopyAssets)))
```

(Apply this same change to both the static-routes loop and the dynamic-routes loop — they currently have the identical line `const html = injectPrefetchRuntime(applyCanopyAssets(hoistScripts(maybeWrap(rendered)), canopyAssets))`.)

5. After the "Copying source assets" block, write the bundle file if non-empty:

```ts
  let copiedAssets = false
  if (existsSync(assetsDir)) {
    reporter.onPhase?.('Copying source assets')
    cpSync(assetsDir, join(distDir, 'assets'), { recursive: true })
    copiedAssets = true
  }

  if (componentStyles) {
    mkdirSync(join(distDir, 'assets'), { recursive: true })
    writeFileSync(join(distDir, 'assets', 'wald-components.css'), componentStyles)
  }

  reporter.onPhase?.('Applying adapter')
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @waldjs/cli exec vitest run build.test.ts`
Expected: PASS (all tests in the file, including the two new ones and every pre-existing test — none of them use a `<style>` block, so `componentStyles` is `''` for them and nothing changes in their output).

- [ ] **Step 5: Commit**

```bash
git add packages/cli/src/commands/build.ts packages/cli/src/commands/build.test.ts
git commit -m "cli: bundle and link scoped component styles in wald build"
```

---

### Task 11: Full workspace verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite for both touched packages**

Run: `pnpm --filter @waldjs/compiler test -- run && pnpm --filter @waldjs/cli test -- run`
Expected: PASS — every test file in both packages, with no regressions in the pre-existing suites (152+ CLI tests, all compiler tests).

- [ ] **Step 2: Typecheck both packages**

Run: `pnpm --filter @waldjs/compiler exec tsc --noEmit && pnpm --filter @waldjs/cli exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Fix anything that fails**

If either step fails, fix the specific failure before continuing — do not proceed to Task 12 with a red test suite.

---

### Task 12: Changeset

**Files:**
- Create: `.changeset/wald-scoped-css.md`

- [ ] **Step 1: Write the changeset**

Create `.changeset/wald-scoped-css.md`:

```md
---
"@waldjs/compiler": minor
"@waldjs/cli": minor
---

Add a `<style>` block to any `.wald` file to write CSS scoped to that component's own markup — every element it renders gets a `data-wald-<hash>` attribute, and its selectors are rewritten to match only elements carrying that attribute. `wald grow` and `wald build` both bundle every component's scoped CSS into a single `/assets/wald-components.css`, linked automatically into any page that actually renders a styled component.
```

- [ ] **Step 2: Commit**

```bash
git add .changeset/wald-scoped-css.md
git commit -m "Add changeset for scoped component CSS"
```

---

### Task 13: Open the PR

**Files:** none

- [ ] **Step 1: Push the branch**

```bash
git push -u origin feat/issue-25-scoped-css
```

- [ ] **Step 2: Open the PR**

```bash
gh pr create --repo Stefan-Espant/WaldJS \
  --title "Add scoped component CSS via <style> blocks (#25)" \
  --body "Closes #25.

A .wald file can now include a single top-level <style> block. The compiler:
- computes a scope hash from the file's path (sha256, first 8 hex chars)
- rewrites the block's selectors to end in [data-wald-<hash>]
- stamps that attribute onto every element the component's own template renders (not onto pond/slotted children's own child components, and not onto a child component's own markup — each carries its own hash)

wald grow and wald build both bundle every component's scoped CSS into one /assets/wald-components.css, linked into a page's <head> only when that page's rendered HTML actually carries a scope attribute (same per-page detection pattern used for wald:prefetch).

See docs/superpowers/specs/2026-09-06-scoped-component-css-design.md for the full design.

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```

- [ ] **Step 3: Report the PR URL back to the user.**

---

## Plan self-review notes

- **Spec coverage:** every section of the design doc (`<style>` extraction + one-block limit, hash-of-path scoping, no-bleed-to-children, hand-rolled tokenizer with `@media`/`@supports`/`@layer` recursion and `@keyframes`/`@font-face`/passthrough, bundled-file output for both `wald build` and `wald grow`, per-page conditional link injection) has a corresponding task and test above.
- **Out-of-scope items** (`:deep()`, `:global()`, scaffold example) are deliberately not tasked — confirmed still absent from every task.
- **Type consistency:** `scopeHash`/`scopeCss` (Task 4) are the exact names imported in Task 5; `collectComponentStyles` (Task 7) is the exact name imported in Tasks 9 and 10; `needsComponentStyles`/`injectComponentStyles` (Task 8) are the exact names imported in Tasks 9 and 10; `walkWaldFiles` (Task 6) is the exact name imported in Task 7.
