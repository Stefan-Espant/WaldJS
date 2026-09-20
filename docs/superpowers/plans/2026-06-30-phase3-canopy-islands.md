# Phase 3 — Canopy Islands Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add opt-in client-side hydration ("Canopy Islands") to WaldJS — components marked `canopy:load`/`canopy:idle`/`canopy:visible` render to static HTML on the server and then "wake up" in the browser via a bundled JS module, loaded by a `<wald-canopy>` Web Component wrapper.

**Architecture:** A new `@waldjs/canopy` package ships the `<wald-canopy>` custom element runtime. The compiler (`@waldjs/compiler`) gains a `canopy?` field on `ComponentNode`, detected by the scanner and rendered by the transform as a `<wald-canopy>` wrapper with a `wald:canopy:ComponentName` placeholder `data-src`. The CLI's build pipeline gains a scan pass (find canopy usages + their source files), a client build pass (bundle each canopy component's `<script>` block plus the `@waldjs/canopy` runtime via Vite, `ssr: false`), and extends the existing pre-render pass to replace placeholders with real asset URLs and inject the runtime `<script type="module">` tag. The dev server needs no changes — Vite's existing virtual-module support handles it.

**Tech Stack:** TypeScript, Vite (build + plugin API), Vitest (+ happy-dom for DOM-dependent tests), pnpm workspaces.

---

## Context for the implementer

This is a 4-package monorepo (`packages/{cli,compiler,runtime,content}`), about to become 5 with `packages/canopy`. Read these before starting if anything below is unclear:

- `docs/superpowers/specs/2026-06-30-phase3-canopy-islands-design.md` — the approved design spec this plan implements. Read it once at the start; this plan inlines every code detail you need but the spec has the "why".
- `.wald` files compile to JS modules exporting `createTree(async ($$result, $$props) => { ... return renderTemplate\`...\` })` (see `packages/runtime/src/index.ts`).
- The compiler pipeline is `parse()` (frontmatter + `scanTemplate()`) → AST → `transform()` → JS source string. All three live in `packages/compiler/src/`.
- `packages/cli/src/commands/build.ts` runs a two-pass static build: Pass 1 = Vite SSR build of all `.wald` pages into `.wald-ssr/`, Pass 2 = dynamic `import()` of each compiled page module + `.render()` + write HTML. This plan renumbers/extends these passes (Pass 0 scan, Pass 1a client build, Pass 1b = old Pass 1, Pass 2 = old Pass 2 + placeholder/runtime injection).
- `packages/cli/src/commands/build.test.ts` mocks Vite's `build()` function entirely (no real bundling happens in tests) — it compiles `.wald` files with the real compiler and writes wrapper modules pointing at `data:` URLs so Node can `import()` them. You will extend this mock to also handle the new client-build pass.

**Important correctness fix baked into this plan (not spelled out verbatim in the spec, but required by it):** a component's `<script>` block normally gets hoisted inline into the page (existing Phase 3 behavior, via `hoistScripts()` in `shell.ts`). But when that component is used with `canopy:*`, its script is an `export default function(root, props) {...}` factory — invalid as a plain inline `<script>` (browsers would throw a `SyntaxError` on the bare `export` keyword), and redundant since the canopy runtime loads it as a module instead. Task 8 strips exactly those script blocks from the hoisted output before injecting the canopy runtime, using the same script content Pass 0 already extracted.

---

## Task 1: `@waldjs/canopy` package — `<wald-canopy>` custom element

**Files:**
- Create: `packages/canopy/package.json`
- Create: `packages/canopy/tsconfig.json`
- Create: `packages/canopy/src/index.ts`
- Test: `packages/canopy/src/index.test.ts`

- [ ] **Step 1: Scaffold the package**

Create `packages/canopy/package.json`:

```json
{
  "name": "@waldjs/canopy",
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
    "happy-dom": "^15.0.0",
    "typescript": "^5.5.0",
    "vitest": "^2.0.0"
  }
}
```

Create `packages/canopy/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "dist",
    "lib": ["ES2022", "DOM", "DOM.Iterable"]
  },
  "include": ["src"]
}
```

Run: `cd /Users/stefan/Desktop/semantique-agency/repositories/waldjs && pnpm install`
Expected: install succeeds, `packages/canopy` shows up in the workspace (no errors about missing `packages/canopy/src` — pnpm only needs the `package.json` to register the workspace member).

- [ ] **Step 2: Write the failing tests**

Create `packages/canopy/src/index.test.ts`:

```typescript
// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest'
import './index.js'

describe('wald-canopy custom element', () => {
  it('registers the custom element on import', () => {
    expect(customElements.get('wald-canopy')).toBeDefined()
  })

  it('canopy:load strategy invokes the factory immediately with deserialized props', async () => {
    const code = `export default function(root, props) { root.setAttribute('data-called', JSON.stringify(props)) }`
    const src = `data:text/javascript,${encodeURIComponent(code)}`
    const el = document.createElement('wald-canopy')
    el.dataset.src = src
    el.dataset.strategy = 'load'
    el.dataset.props = JSON.stringify({ count: 5 })
    document.body.appendChild(el)

    await vi.waitFor(() => expect(el.getAttribute('data-called')).not.toBeNull())
    expect(el.getAttribute('data-called')).toBe(JSON.stringify({ count: 5 }))
  })

  it('defaults props to an empty object when data-props is absent', async () => {
    const code = `export default function(root, props) { root.setAttribute('data-props-received', JSON.stringify(props)) }`
    const src = `data:text/javascript,${encodeURIComponent(code)}`
    const el = document.createElement('wald-canopy')
    el.dataset.src = src
    el.dataset.strategy = 'load'
    document.body.appendChild(el)

    await vi.waitFor(() => expect(el.getAttribute('data-props-received')).toBe('{}'))
  })

  it('canopy:idle strategy invokes the factory asynchronously, not synchronously', async () => {
    const code = `export default function(root) { root.setAttribute('data-called', 'true') }`
    const src = `data:text/javascript,${encodeURIComponent(code)}`
    const el = document.createElement('wald-canopy')
    el.dataset.src = src
    el.dataset.strategy = 'idle'
    document.body.appendChild(el)

    expect(el.getAttribute('data-called')).toBeNull()
    await vi.waitFor(() => expect(el.getAttribute('data-called')).toBe('true'))
  })

  it('canopy:visible strategy invokes the factory once the element intersects the viewport', async () => {
    let observedCallback: (entries: { isIntersecting: boolean }[]) => void = () => {}
    const disconnect = vi.fn()
    class FakeIntersectionObserver {
      constructor(cb: (entries: { isIntersecting: boolean }[]) => void) {
        observedCallback = cb
      }
      observe() {}
      disconnect = disconnect
    }
    vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver)

    const code = `export default function(root) { root.setAttribute('data-called', 'true') }`
    const src = `data:text/javascript,${encodeURIComponent(code)}`
    const el = document.createElement('wald-canopy')
    el.dataset.src = src
    el.dataset.strategy = 'visible'
    document.body.appendChild(el)

    expect(el.getAttribute('data-called')).toBeNull()
    observedCallback([{ isIntersecting: true }])
    await vi.waitFor(() => expect(el.getAttribute('data-called')).toBe('true'))
    expect(disconnect).toHaveBeenCalled()

    vi.unstubAllGlobals()
  })

  it('logs a console.error and does not throw when the module has no default function export', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const code = `export const notDefault = 1`
    const src = `data:text/javascript,${encodeURIComponent(code)}`
    const el = document.createElement('wald-canopy')
    el.dataset.src = src
    el.dataset.strategy = 'load'
    document.body.appendChild(el)

    await vi.waitFor(() => expect(errorSpy).toHaveBeenCalled())
    expect(String(errorSpy.mock.calls[0][0])).toContain('does not export a default function')

    errorSpy.mockRestore()
  })
})
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd packages/canopy && pnpm vitest run`
Expected: FAIL — `Cannot find module './index.js'` (no `src/index.ts` exists yet).

- [ ] **Step 4: Write the implementation**

Create `packages/canopy/src/index.ts`:

```typescript
class WaldCanopy extends HTMLElement {
  async connectedCallback() {
    const src = this.dataset.src!
    const strategy = this.dataset.strategy as 'load' | 'idle' | 'visible'
    const props = JSON.parse(this.dataset.props ?? '{}')

    const run = async () => {
      try {
        const mod = await import(/* @vite-ignore */ src)
        if (typeof mod.default !== 'function') {
          console.error(`[wald-canopy] ${src} does not export a default function`)
          return
        }
        mod.default(this, props)
      } catch (e) {
        console.error(`[wald-canopy] Failed to load ${src}:`, e)
      }
    }

    if (strategy === 'load') {
      run()
    } else if (strategy === 'idle') {
      if ('requestIdleCallback' in window) {
        requestIdleCallback(run)
      } else {
        setTimeout(run, 1)
      }
    } else if (strategy === 'visible') {
      const obs = new IntersectionObserver(([entry]) => {
        if (entry.isIntersecting) {
          obs.disconnect()
          run()
        }
      })
      obs.observe(this)
    }
  }
}

if (!customElements.get('wald-canopy')) {
  customElements.define('wald-canopy', WaldCanopy)
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd packages/canopy && pnpm vitest run`
Expected: PASS — 6 tests passing.

- [ ] **Step 6: Commit**

```bash
cd /Users/stefan/Desktop/semantique-agency/repositories/waldjs
git add packages/canopy
git commit -m "feat(canopy): add wald-canopy custom element runtime"
```

---

## Task 2: AST — `ComponentNode.canopy` field

**Files:**
- Modify: `packages/compiler/src/ast/types.ts:42-47`

- [ ] **Step 1: Add the field**

In `packages/compiler/src/ast/types.ts`, change:

```typescript
export type ComponentNode = {
  type: 'component'
  name: string
  attrs: AttributeNode[]
  children: TemplateNode[]
}
```

to:

```typescript
export type ComponentNode = {
  type: 'component'
  name: string
  attrs: AttributeNode[]
  children: TemplateNode[]
  canopy?: { strategy: 'load' | 'idle' | 'visible' }
}
```

This is a type-only change with no runtime behavior — no test needed for this step in isolation (it's covered by Task 3's scanner tests, which are the first thing to actually construct a `canopy` value).

- [ ] **Step 2: Verify the compiler package still typechecks**

Run: `cd packages/compiler && pnpm exec tsc --noEmit`
Expected: PASS, no errors (the field is optional, so all existing `ComponentNode` literals remain valid).

- [ ] **Step 3: Commit**

```bash
cd /Users/stefan/Desktop/semantique-agency/repositories/waldjs
git add packages/compiler/src/ast/types.ts
git commit -m "feat(compiler): add optional canopy field to ComponentNode"
```

---

## Task 3: Scanner — detect `canopy:*` directives

**Files:**
- Modify: `packages/compiler/src/parser/scanner.ts`
- Modify: `packages/compiler/src/parser/scanner.test.ts`

- [ ] **Step 1: Write the failing tests**

Open `packages/compiler/src/parser/scanner.test.ts`. Find the `describe('scanTemplate — script'` block (it starts right after the `it('detects ComponentNode by uppercase tag'` test). Add a new `describe` block immediately before `describe('scanTemplate — script'`:

```typescript
describe('scanTemplate — canopy directives', () => {
  it('detects canopy:load and removes it from attrs', () => {
    const nodes = scanTemplate('<Counter canopy:load initialCount={5} />')
    expect(nodes).toEqual([{
      type: 'component',
      name: 'Counter',
      attrs: [{ type: 'attribute', name: 'initialCount', value: { type: 'expression', code: '5' } }],
      children: [],
      canopy: { strategy: 'load' },
    }])
  })

  it('detects canopy:idle', () => {
    const nodes = scanTemplate('<Counter canopy:idle />')
    expect(nodes[0]).toMatchObject({ canopy: { strategy: 'idle' } })
  })

  it('detects canopy:visible', () => {
    const nodes = scanTemplate('<Counter canopy:visible />')
    expect(nodes[0]).toMatchObject({ canopy: { strategy: 'visible' } })
  })

  it('detects canopy:* on a component with children', () => {
    const nodes = scanTemplate('<Counter canopy:load>text</Counter>')
    expect(nodes[0]).toMatchObject({
      type: 'component',
      name: 'Counter',
      canopy: { strategy: 'load' },
      children: [{ type: 'text', value: 'text' }],
    })
  })

  it('throws a parse error for an unknown canopy strategy', () => {
    expect(() => scanTemplate('<Counter canopy:spin />')).toThrow(
      'canopy:spin is not valid — use canopy:load, canopy:idle or canopy:visible'
    )
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/compiler && pnpm vitest run scanner.test.ts`
Expected: FAIL — `canopy:load` is currently parsed as two separate attributes (`canopy` and `load`, with the `:` silently dropped), so `nodes[0].canopy` is `undefined` and the resulting `attrs` array doesn't match.

- [ ] **Step 3: Implement canopy detection**

In `packages/compiler/src/parser/scanner.ts`, the identifier scanner currently uses `/[\w-]/`, which stops at `:` — meaning `canopy:load` gets split into two attribute-scan calls. Widen it to include `:`, then strip and validate `canopy:*` attributes when constructing component nodes.

Change the `scanIdentifier` regex (line 115):

```typescript
  private scanIdentifier(): string {
    let id = ''
    while (this.pos < this.source.length && /[\w-]/.test(this.current)) {
      id += this.advance()
    }
    return id
  }
```

to:

```typescript
  private scanIdentifier(): string {
    let id = ''
    while (this.pos < this.source.length && /[\w:-]/.test(this.current)) {
      id += this.advance()
    }
    return id
  }
```

Add a module-level constant and helper function above the `Scanner` class (after the `scanTemplate` export, before `class Scanner`):

```typescript
const VALID_CANOPY_STRATEGIES = new Set(['load', 'idle', 'visible'])

function extractCanopy(attrs: AttributeNode[]): {
  attrs: AttributeNode[]
  canopy?: { strategy: 'load' | 'idle' | 'visible' }
} {
  const rest: AttributeNode[] = []
  let canopy: { strategy: 'load' | 'idle' | 'visible' } | undefined

  for (const attr of attrs) {
    if (attr.name.startsWith('canopy:')) {
      const strategy = attr.name.slice('canopy:'.length)
      if (!VALID_CANOPY_STRATEGIES.has(strategy)) {
        throw new Error(
          `canopy:${strategy} is not valid — use canopy:load, canopy:idle or canopy:visible`
        )
      }
      canopy = { strategy: strategy as 'load' | 'idle' | 'visible' }
    } else {
      rest.push(attr)
    }
  }

  return canopy ? { attrs: rest, canopy } : { attrs: rest }
}
```

Update `scanElement()` to call `extractCanopy` for both component-construction branches:

```typescript
  private scanElement(): ElementNode | ComponentNode {
    this.advance() // consume <
    const tag = this.scanIdentifier()
    const attrs = this.scanAttributes()

    if (this.current === '/' && this.peek(1) === '>') {
      this.advance() // /
      this.advance() // >
      if (/^[A-Z]/.test(tag)) {
        const { attrs: cleanAttrs, canopy } = extractCanopy(attrs)
        return canopy
          ? { type: 'component', name: tag, attrs: cleanAttrs, children: [], canopy }
          : { type: 'component', name: tag, attrs: cleanAttrs, children: [] }
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
      const { attrs: cleanAttrs, canopy } = extractCanopy(attrs)
      return canopy
        ? { type: 'component', name: tag, attrs: cleanAttrs, children, canopy }
        : { type: 'component', name: tag, attrs: cleanAttrs, children }
    }
    return { type: 'element', tag, attrs, children }
  }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/compiler && pnpm vitest run scanner.test.ts`
Expected: PASS, including the pre-existing `detects ComponentNode by uppercase tag` test (which asserts no `canopy` key is present — `toEqual` treats an omitted key the same as `undefined`, and the implementation only sets `canopy` when found, so this still matches).

- [ ] **Step 5: Run the full compiler test suite**

Run: `cd packages/compiler && pnpm vitest run`
Expected: PASS, all tests (confirms widening the identifier regex to allow `:` didn't break tag-name or other attribute parsing elsewhere).

- [ ] **Step 6: Commit**

```bash
cd /Users/stefan/Desktop/semantique-agency/repositories/waldjs
git add packages/compiler/src/parser/scanner.ts packages/compiler/src/parser/scanner.test.ts
git commit -m "feat(compiler): detect canopy:load/idle/visible directives in scanner"
```

---

## Task 4: Transform — render canopy components as `<wald-canopy>` wrappers

**Files:**
- Modify: `packages/compiler/src/transform/index.ts:87-105`
- Modify: `packages/compiler/src/transform/index.test.ts`

- [ ] **Step 1: Write the failing tests**

Open `packages/compiler/src/transform/index.test.ts`. Find the `describe('component rendering'` block (ends around line 183). Add these tests inside it, after the existing `'renders a layout component with children as pond'` test:

```typescript
  it('renders a canopy:load component as a wald-canopy wrapper with a placeholder data-src', () => {
    const source = `---\nimport Counter from './Counter.wald'\n---\n<Counter canopy:load initialCount={5} />`
    const result = compile(source, 'test.wald')
    expect(result).toContain('<wald-canopy')
    expect(result).toContain('data-src="wald:canopy:Counter"')
    expect(result).toContain('data-strategy="load"')
    expect(result).toContain('JSON.stringify({ initialCount: (5) })')
    expect(result).toContain('await Counter.render({ initialCount: (5) })')
    expect(result).toContain('</wald-canopy>')
  })

  it('renders canopy:idle and canopy:visible with the matching data-strategy', () => {
    const idle = compile(`---\nimport C from './C.wald'\n---\n<C canopy:idle />`, 'test.wald')
    expect(idle).toContain('data-strategy="idle"')

    const visible = compile(`---\nimport C from './C.wald'\n---\n<C canopy:visible />`, 'test.wald')
    expect(visible).toContain('data-strategy="visible"')
  })

  it('does not wrap a non-canopy component in wald-canopy', () => {
    const source = `---\nimport Card from './Card.wald'\n---\n<Card title="Hoi" />`
    const result = compile(source, 'test.wald')
    expect(result).not.toContain('wald-canopy')
  })
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/compiler && pnpm vitest run transform`
Expected: FAIL — `renderComponent()` doesn't check `node.canopy` yet, so the output never contains `wald-canopy`.

- [ ] **Step 3: Implement the canopy branch**

In `packages/compiler/src/transform/index.ts`, replace `renderComponent`:

```typescript
function renderComponent(node: ComponentNode): string {
  const props = node.attrs
    .map(attr =>
      typeof attr.value === 'string'
        ? `${attr.name}: ${JSON.stringify(attr.value)}`
        : `${attr.name}: (${attr.value.code})`
    )
    .join(', ')

  if (node.children.length > 0) {
    const childrenHtml = renderNodes(node.children)
    const propsWithPond = props
      ? `${props}, pond: new SafeHtml(renderTemplate\`${childrenHtml}\`)`
      : `pond: new SafeHtml(renderTemplate\`${childrenHtml}\`)`
    return `\${new SafeHtml(await ${node.name}.render({ ${propsWithPond} }))}`
  }

  return `\${new SafeHtml(await ${node.name}.render({ ${props} }))}`
}
```

with:

```typescript
function renderComponent(node: ComponentNode): string {
  const props = node.attrs
    .map(attr =>
      typeof attr.value === 'string'
        ? `${attr.name}: ${JSON.stringify(attr.value)}`
        : `${attr.name}: (${attr.value.code})`
    )
    .join(', ')

  if (node.canopy) {
    const propsObj = `{ ${props} }`
    const src = `wald:canopy:${node.name}`
    return `\${new SafeHtml('<wald-canopy data-src="${src}" data-strategy="${node.canopy.strategy}" data-props=\\'' + JSON.stringify(${propsObj}) + '\\'>' + await ${node.name}.render(${propsObj}) + '</wald-canopy>')}`
  }

  if (node.children.length > 0) {
    const childrenHtml = renderNodes(node.children)
    const propsWithPond = props
      ? `${props}, pond: new SafeHtml(renderTemplate\`${childrenHtml}\`)`
      : `pond: new SafeHtml(renderTemplate\`${childrenHtml}\`)`
    return `\${new SafeHtml(await ${node.name}.render({ ${propsWithPond} }))}`
  }

  return `\${new SafeHtml(await ${node.name}.render({ ${props} }))}`
}
```

(Canopy components don't support slotted children/`pond` in this phase — the canopy branch is checked first and returns early. This matches "Buiten scope" in the design spec, which does not list children support for canopy components.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/compiler && pnpm vitest run`
Expected: PASS, full compiler suite green.

- [ ] **Step 5: Commit**

```bash
cd /Users/stefan/Desktop/semantique-agency/repositories/waldjs
git add packages/compiler/src/transform/index.ts packages/compiler/src/transform/index.test.ts
git commit -m "feat(compiler): render canopy components as wald-canopy wrappers"
```

---

## Task 5: Vite plugin — `?canopy-script` virtual module

**Files:**
- Modify: `packages/cli/src/vite-plugin.ts`
- Modify: `packages/cli/src/vite-plugin.test.ts`

- [ ] **Step 1: Write the failing tests**

Open `packages/cli/src/vite-plugin.test.ts`. Update the import line at the top to add the extra fs/path/os imports needed:

```typescript
import { describe, it, expect, vi } from 'vitest'
import { waldPlugin } from './vite-plugin.js'
import type { Plugin } from 'vite'
import { writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
```

Add this new `describe` block at the end of the file:

```typescript
describe('vite-plugin-wald-canopy-script', () => {
  it('resolves .wald?canopy-script ids to a virtual module', () => {
    const result = callHook(
      'vite-plugin-wald-canopy-script',
      'resolveId',
      '/abs/Counter.wald?canopy-script',
      undefined,
      {}
    )
    expect(result).toBe('\0/abs/Counter.wald?canopy-script')
  })

  it('returns undefined for ids without the canopy-script suffix', () => {
    const result = callHook('vite-plugin-wald-canopy-script', 'resolveId', '/abs/Counter.wald', undefined, {})
    expect(result).toBeUndefined()
  })

  it('loads the script block content from the .wald file, stripped of script tags', () => {
    const tmpFile = join(tmpdir(), `wald-canopy-plugin-test-${Date.now()}.wald`)
    writeFileSync(
      tmpFile,
      [
        '---',
        'const { initial = 0 } = $$props',
        '---',
        '<button>{initial}</button>',
        '<script>',
        'export default function(root, props) { root.textContent = props.initial }',
        '</script>',
      ].join('\n')
    )

    const code = callHook('vite-plugin-wald-canopy-script', 'load', `\0${tmpFile}?canopy-script`)
    expect(code).toContain('export default function(root, props)')
    expect(code).not.toContain('<script>')
    expect(code).not.toContain('</script>')

    rmSync(tmpFile)
  })

  it('returns a no-op default export when the component has no script block', () => {
    const tmpFile = join(tmpdir(), `wald-canopy-plugin-test-noscript-${Date.now()}.wald`)
    writeFileSync(tmpFile, '<button>hi</button>')

    const code = callHook('vite-plugin-wald-canopy-script', 'load', `\0${tmpFile}?canopy-script`)
    expect(code).toBe('export default function() {}')

    rmSync(tmpFile)
  })

  it('returns undefined for other virtual ids in load', () => {
    const code = callHook('vite-plugin-wald-canopy-script', 'load', '\0other:module')
    expect(code).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/cli && pnpm vitest run vite-plugin.test.ts`
Expected: FAIL — `waldPlugin().find(p => p.name === 'vite-plugin-wald-canopy-script')` is `undefined`, so `callHook` throws (`Cannot read properties of undefined`).

- [ ] **Step 3: Implement the plugin**

Replace the full contents of `packages/cli/src/vite-plugin.ts`:

```typescript
import { compile, parse } from '@waldjs/compiler'
import type { ScriptNode } from '@waldjs/compiler'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Plugin } from 'vite'

const VIRTUAL_CONTENT_ID = '\0wald:content'
const CANOPY_SCRIPT_SUFFIX = '.wald?canopy-script'

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
    {
      name: 'vite-plugin-wald-canopy-script',

      resolveId(id) {
        if (id.endsWith(CANOPY_SCRIPT_SUFFIX)) return '\0' + id
      },

      load(id) {
        if (!id.startsWith('\0') || !id.endsWith(CANOPY_SCRIPT_SUFFIX)) return
        const file = id.slice(1, -'?canopy-script'.length)
        const source = readFileSync(file, 'utf-8')
        const ast = parse(source)
        const scriptNode = ast.template.find((n): n is ScriptNode => n.type === 'script')
        if (!scriptNode) return 'export default function() {}'
        return scriptNode.content.replace(/^<script[^>]*>/, '').replace(/<\/script>$/, '')
      },
    },
  ]
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/cli && pnpm vitest run`
Expected: PASS, full CLI suite green.

- [ ] **Step 5: Commit**

```bash
cd /Users/stefan/Desktop/semantique-agency/repositories/waldjs
git add packages/cli/src/vite-plugin.ts packages/cli/src/vite-plugin.test.ts
git commit -m "feat(cli): serve canopy component scripts as ?canopy-script virtual modules"
```

---

## Task 6: Build Pass 0 — scan for canopy usage

**Files:**
- Create: `packages/cli/src/canopy-scan.ts`
- Test: `packages/cli/src/canopy-scan.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `packages/cli/src/canopy-scan.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { scanCanopyEntries, collectCanopyScriptContents } from './canopy-scan.js'

let tmpDir: string

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'wald-canopy-scan-'))
})

describe('scanCanopyEntries', () => {
  it('finds a canopy component used in a page and resolves its file path', () => {
    const srcDir = join(tmpDir, 'src')
    mkdirSync(join(srcDir, 'pages'), { recursive: true })
    mkdirSync(join(srcDir, 'components'), { recursive: true })

    const counterFile = join(srcDir, 'components', 'Counter.wald')
    writeFileSync(
      counterFile,
      [
        '---',
        'const { initial = 0 } = $$props',
        '---',
        '<button>{initial}</button>',
        '<script>export default function() {}</script>',
      ].join('\n')
    )

    writeFileSync(
      join(srcDir, 'pages', 'index.wald'),
      ["---", "import Counter from '../components/Counter.wald'", '---', '<Counter canopy:load initial={3} />'].join('\n')
    )

    const { entries, warnings } = scanCanopyEntries(srcDir)

    expect(entries.get('counter')).toBe(counterFile)
    expect(warnings).toEqual([])
  })

  it('warns and skips components used with canopy:* but no <script> block', () => {
    const srcDir = join(tmpDir, 'src')
    mkdirSync(join(srcDir, 'pages'), { recursive: true })
    mkdirSync(join(srcDir, 'components'), { recursive: true })

    writeFileSync(join(srcDir, 'components', 'Static.wald'), ['---', '---', '<p>no script here</p>'].join('\n'))

    writeFileSync(
      join(srcDir, 'pages', 'index.wald'),
      ["---", "import Static from '../components/Static.wald'", '---', '<Static canopy:load />'].join('\n')
    )

    const { entries, warnings } = scanCanopyEntries(srcDir)

    expect(entries.size).toBe(0)
    expect(warnings).toEqual(['Static has no <script> block — canopy:load has no effect'])
  })

  it('returns no entries when no canopy directives are used', () => {
    const srcDir = join(tmpDir, 'src')
    mkdirSync(join(srcDir, 'pages'), { recursive: true })
    writeFileSync(join(srcDir, 'pages', 'index.wald'), '<p>hi</p>')

    const { entries, warnings } = scanCanopyEntries(srcDir)

    expect(entries.size).toBe(0)
    expect(warnings).toEqual([])
  })

  it('finds canopy usage nested inside a layout-wrapped page', () => {
    const srcDir = join(tmpDir, 'src')
    mkdirSync(join(srcDir, 'pages'), { recursive: true })
    mkdirSync(join(srcDir, 'layouts'), { recursive: true })
    mkdirSync(join(srcDir, 'components'), { recursive: true })

    const counterFile = join(srcDir, 'components', 'Counter.wald')
    writeFileSync(
      counterFile,
      ['---', '---', '<button>0</button>', '<script>export default function() {}</script>'].join('\n')
    )

    writeFileSync(
      join(srcDir, 'layouts', 'Layout.wald'),
      ['---', 'const { pond } = $$props', '---', '<body>{pond}</body>'].join('\n')
    )

    writeFileSync(
      join(srcDir, 'pages', 'index.wald'),
      [
        '---',
        "import Layout from '../layouts/Layout.wald'",
        "import Counter from '../components/Counter.wald'",
        '---',
        '<Layout>',
        '  <Counter canopy:visible />',
        '</Layout>',
      ].join('\n')
    )

    const { entries } = scanCanopyEntries(srcDir)

    expect(entries.get('counter')).toBe(counterFile)
  })
})

describe('collectCanopyScriptContents', () => {
  it('returns the raw <script>...</script> text for each canopy entry', () => {
    const srcDir = join(tmpDir, 'src')
    mkdirSync(join(srcDir, 'components'), { recursive: true })
    const counterFile = join(srcDir, 'components', 'Counter.wald')
    writeFileSync(
      counterFile,
      ['---', '---', '<button>0</button>', '<script>export default function() {}</script>'].join('\n')
    )

    const contents = collectCanopyScriptContents(new Map([['counter', counterFile]]))

    expect(contents.has('<script>export default function() {}</script>')).toBe(true)
  })

  it('returns an empty set for an empty entries map', () => {
    const contents = collectCanopyScriptContents(new Map())
    expect(contents.size).toBe(0)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/cli && pnpm vitest run canopy-scan.test.ts`
Expected: FAIL — `Cannot find module './canopy-scan.js'`.

- [ ] **Step 3: Implement the scan**

Create `packages/cli/src/canopy-scan.ts`:

```typescript
import { readdirSync, readFileSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'
import { parse } from '@waldjs/compiler'
import type { TemplateNode, ComponentNode, ScriptNode } from '@waldjs/compiler'

export type CanopyScanResult = {
  entries: Map<string, string>
  warnings: string[]
}

export function scanCanopyEntries(srcDir: string): CanopyScanResult {
  const entries = new Map<string, string>()
  const warnings: string[] = []

  for (const file of walkWaldFiles(srcDir)) {
    const ast = parse(readFileSync(file, 'utf8'))
    for (const usage of findCanopyUsages(ast.template)) {
      const componentPath = resolveImportPath(ast.frontmatter.code, usage.name, file)
      if (!componentPath) continue

      const componentAst = parse(readFileSync(componentPath, 'utf8'))
      if (!hasScriptBlock(componentAst.template)) {
        warnings.push(
          `${usage.name} has no <script> block — canopy:${usage.canopy!.strategy} has no effect`
        )
        continue
      }

      entries.set(usage.name.toLowerCase(), componentPath)
    }
  }

  return { entries, warnings }
}

export function collectCanopyScriptContents(entries: Map<string, string>): Set<string> {
  const contents = new Set<string>()
  for (const file of entries.values()) {
    const ast = parse(readFileSync(file, 'utf8'))
    const scriptNode = ast.template.find((n): n is ScriptNode => n.type === 'script')
    if (scriptNode) contents.add(scriptNode.content)
  }
  return contents
}

function walkWaldFiles(dir: string): string[] {
  const files: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...walkWaldFiles(full))
    } else if (entry.name.endsWith('.wald')) {
      files.push(full)
    }
  }
  return files
}

function findCanopyUsages(nodes: TemplateNode[]): ComponentNode[] {
  const found: ComponentNode[] = []
  for (const node of nodes) {
    if (node.type === 'component') {
      if (node.canopy) found.push(node)
      found.push(...findCanopyUsages(node.children))
    } else if (node.type === 'element') {
      found.push(...findCanopyUsages(node.children))
    }
  }
  return found
}

function hasScriptBlock(nodes: TemplateNode[]): boolean {
  return nodes.some(n => n.type === 'script' || (n.type === 'element' && hasScriptBlock(n.children)))
}

function resolveImportPath(frontmatterCode: string, componentName: string, fromFile: string): string | undefined {
  const re = new RegExp(`import\\s+${componentName}\\s+from\\s+['"](.+?)['"]`)
  const match = frontmatterCode.match(re)
  if (!match) return undefined
  return resolve(dirname(fromFile), match[1])
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/cli && pnpm vitest run canopy-scan.test.ts`
Expected: PASS, 6 tests passing.

- [ ] **Step 5: Commit**

```bash
cd /Users/stefan/Desktop/semantique-agency/repositories/waldjs
git add packages/cli/src/canopy-scan.ts packages/cli/src/canopy-scan.test.ts
git commit -m "feat(cli): scan .wald sources for canopy:* component usage"
```

---

## Task 7: Build Pass 1a — client build for canopy scripts

**Files:**
- Create: `packages/cli/src/canopy-build.ts`
- Test: `packages/cli/src/canopy-build.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `packages/cli/src/canopy-build.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

// Mock vite.build() to simulate a real bundler: write one fake JS asset per
// input entry, then invoke any generateBundle plugin hooks with a synthetic
// bundle — this exercises the real captureCanopyAssets() plugin code without
// running an actual Rollup build.
vi.mock('vite', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vite')>()
  return {
    ...actual,
    build: vi.fn(async (cfg: any) => {
      const { writeFileSync: fsWrite, mkdirSync: fsMkdir } = await import('node:fs')
      const { join: pJoin } = await import('node:path')

      const outDir: string = cfg.build.outDir
      const inputs: Record<string, string> = cfg.build.rollupOptions.input
      fsMkdir(pJoin(outDir, 'assets'), { recursive: true })

      const bundle: Record<string, any> = {}
      for (const key of Object.keys(inputs)) {
        const fileName = `assets/${key}-testhash.js`
        fsWrite(pJoin(outDir, fileName), 'export default function() {}')
        bundle[fileName] = { type: 'chunk', isEntry: true, name: key, fileName }
      }

      for (const plugin of cfg.plugins ?? []) {
        if (typeof plugin?.generateBundle === 'function') {
          await plugin.generateBundle({}, bundle)
        }
      }
    }),
  }
})

import { buildCanopyClient, captureCanopyAssets } from './canopy-build.js'

let tmpDir: string

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'wald-canopy-build-'))
})

describe('captureCanopyAssets', () => {
  it('maps entry chunk names to base-prefixed file URLs', () => {
    const assetMap = new Map<string, string>()
    const plugin = captureCanopyAssets(assetMap, '/')
    plugin.generateBundle({}, {
      'assets/counter-abc.js': { type: 'chunk', isEntry: true, name: 'counter', fileName: 'assets/counter-abc.js' },
      'assets/shared-xyz.js': { type: 'chunk', isEntry: false, name: 'shared', fileName: 'assets/shared-xyz.js' },
    } as any)

    expect(assetMap.get('counter')).toBe('/assets/counter-abc.js')
    expect(assetMap.has('shared')).toBe(false)
  })

  it('strips a trailing slash from base before joining', () => {
    const assetMap = new Map<string, string>()
    const plugin = captureCanopyAssets(assetMap, '/my-site/')
    plugin.generateBundle({}, {
      'assets/counter-abc.js': { type: 'chunk', isEntry: true, name: 'counter', fileName: 'assets/counter-abc.js' },
    } as any)

    expect(assetMap.get('counter')).toBe('/my-site/assets/counter-abc.js')
  })
})

describe('buildCanopyClient', () => {
  it('returns an empty map and skips the build when there are no entries', async () => {
    const { build } = await import('vite')
    const distDir = join(tmpDir, 'dist')

    const assetMap = await buildCanopyClient(new Map(), distDir, '/', {})

    expect(assetMap.size).toBe(0)
    expect(build).not.toHaveBeenCalled()
  })

  it('builds the canopy runtime plus each entry and returns their asset URLs', async () => {
    const distDir = join(tmpDir, 'dist')
    const componentsDir = join(tmpDir, 'src', 'components')
    mkdirSync(componentsDir, { recursive: true })
    const counterFile = join(componentsDir, 'Counter.wald')
    writeFileSync(
      counterFile,
      ['---', '---', '<button>0</button>', '<script>export default function() {}</script>'].join('\n')
    )

    const entries = new Map([['counter', counterFile]])
    const assetMap = await buildCanopyClient(entries, distDir, '/', {})

    expect(assetMap.get('wald-canopy')).toBe('/assets/wald-canopy-testhash.js')
    expect(assetMap.get('counter')).toBe('/assets/counter-testhash.js')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/cli && pnpm vitest run canopy-build.test.ts`
Expected: FAIL — `Cannot find module './canopy-build.js'`.

- [ ] **Step 3: Implement the client build**

Create `packages/cli/src/canopy-build.ts`:

```typescript
import { build, mergeConfig, type UserConfig, type Plugin } from 'vite'
import { waldPlugin } from './vite-plugin.js'

export type CanopyAssetMap = Map<string, string>

export function captureCanopyAssets(assetMap: CanopyAssetMap, base: string): Plugin {
  return {
    name: 'wald-canopy-asset-map',
    generateBundle(_options, bundle) {
      for (const chunk of Object.values(bundle)) {
        if (chunk.type === 'chunk' && chunk.isEntry && chunk.name) {
          assetMap.set(chunk.name, joinUrl(base, chunk.fileName))
        }
      }
    },
  }
}

function joinUrl(base: string, fileName: string): string {
  return base.replace(/\/$/, '') + '/' + fileName
}

export async function buildCanopyClient(
  entries: Map<string, string>,
  distDir: string,
  base: string,
  viteConfig: UserConfig | undefined,
): Promise<CanopyAssetMap> {
  const assetMap: CanopyAssetMap = new Map()
  if (entries.size === 0) return assetMap

  const input: Record<string, string> = { 'wald-canopy': '@waldjs/canopy' }
  for (const [name, file] of entries) {
    input[name] = `${file}?canopy-script`
  }

  await build(mergeConfig(
    viteConfig ?? {},
    {
      base,
      plugins: [waldPlugin(), captureCanopyAssets(assetMap, base)],
      build: {
        ssr: false,
        outDir: distDir,
        emptyOutDir: false,
        rollupOptions: { input },
      },
    } as any,
  ))

  return assetMap
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/cli && pnpm vitest run canopy-build.test.ts`
Expected: PASS, 4 tests passing.

- [ ] **Step 5: Commit**

```bash
cd /Users/stefan/Desktop/semantique-agency/repositories/waldjs
git add packages/cli/src/canopy-build.ts packages/cli/src/canopy-build.test.ts
git commit -m "feat(cli): add client build pass for canopy scripts and runtime"
```

---

## Task 8: Wire Pass 0/1a into `buildPages()` + Pass 2 placeholder replacement

**Files:**
- Modify: `packages/cli/src/commands/build.ts`
- Modify: `packages/cli/src/commands/build.test.ts`

- [ ] **Step 1: Extend the build.test.ts Vite mock to handle the client-build branch**

In `packages/cli/src/commands/build.test.ts`, the existing `vi.mock('vite', ...)` only knows how to simulate an SSR build. Replace the whole `vi.mock('vite', ...)` block (lines 10-78) with a version that branches on `cfg.build.ssr`:

```typescript
// Mock vite.build() — simulates what Vite would do for both build passes:
// the SSR pass (compiles .wald pages with the real compiler, writes wrapper
// modules pointing at data: URLs so Node can import them) and the client
// pass for canopy scripts (writes a fake asset file per entry and invokes
// any generateBundle plugin hooks with a synthetic bundle).
vi.mock('vite', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vite')>()
  return {
    ...actual,
    build: vi.fn(async (cfg: any) => {
      if (cfg.build.ssr === false) {
        const { writeFileSync: fsWrite, mkdirSync: fsMkdir } = await import('node:fs')
        const { join: pJoin } = await import('node:path')

        const outDir: string = cfg.build.outDir
        const inputs: Record<string, string> = cfg.build.rollupOptions.input
        fsMkdir(pJoin(outDir, 'assets'), { recursive: true })

        const bundle: Record<string, any> = {}
        for (const key of Object.keys(inputs)) {
          const fileName = `assets/${key}-testhash.js`
          fsWrite(pJoin(outDir, fileName), 'export default function() {}')
          bundle[fileName] = { type: 'chunk', isEntry: true, name: key, fileName }
        }

        for (const plugin of cfg.plugins ?? []) {
          if (typeof plugin?.generateBundle === 'function') {
            await plugin.generateBundle({}, bundle)
          }
        }
        return
      }

      const { compile } = await import('@waldjs/compiler')
      const { readFileSync: fsRead, writeFileSync: fsWrite, mkdirSync: fsMkdir } = await import('node:fs')
      const { join: pJoin, dirname: pDirname, resolve: pResolve } = await import('node:path')

      const ssrDir: string = cfg.build.outDir
      const inputs: Record<string, string> = cfg.build.rollupOptions.input
      const contentDir: string | undefined = cfg._waldContentDir

      const runtimeUrl = new URL(
        '../../node_modules/@waldjs/runtime/dist/index.js',
        import.meta.url,
      ).href
      const contentPkgUrl = new URL(
        '../../node_modules/@waldjs/content/dist/index.js',
        import.meta.url,
      ).href

      function makeContentModuleUrl(cDir: string): string {
        const code = [
          `import { readCollection as _rc, readEntry as _re } from ${JSON.stringify(contentPkgUrl)}`,
          `const contentDir = ${JSON.stringify(cDir)}`,
          `export const getCollection = (name) => _rc(name, contentDir)`,
          `export const getEntry = (collection, slug) => _re(collection, slug, contentDir)`,
        ].join('\n')
        return `data:text/javascript,${encodeURIComponent(code)}`
      }

      const cache = new Map<string, string>()
      const contentModuleUrl = contentDir ? makeContentModuleUrl(contentDir) : null

      async function compileFile(filePath: string): Promise<string> {
        if (cache.has(filePath)) return cache.get(filePath)!
        const source = fsRead(filePath, 'utf8')
        let compiled = compile(source, filePath)
        compiled = compiled.replace(/(['"])@waldjs\/runtime\1/g, JSON.stringify(runtimeUrl))
        if (contentModuleUrl) {
          compiled = compiled.replace(/(['"])wald:content\1/g, JSON.stringify(contentModuleUrl))
        }
        const waldRe = /from\s+(['"])(\.\.?\/[^'"]+\.wald)\1/g
        let m: RegExpExecArray | null
        const patches: Array<[string, string]> = []
        while ((m = waldRe.exec(compiled)) !== null) {
          const [, quote, relPath] = m
          const absPath = pResolve(pDirname(filePath), relPath)
          const depUrl = await compileFile(absPath)
          patches.push([`from ${quote}${relPath}${quote}`, `from ${JSON.stringify(depUrl)}`])
        }
        for (const [from, to] of patches) compiled = compiled.replace(from, to)
        const dataUrl = `data:text/javascript,${encodeURIComponent(compiled)}`
        cache.set(filePath, dataUrl)
        return dataUrl
      }

      for (const [key, filePath] of Object.entries(inputs)) {
        const dataUrl = await compileFile(filePath as string)
        // Wrapper module re-exports from the data: URL so Node can import it by file path
        const wrapper = `export * from ${JSON.stringify(dataUrl)}\nexport { default } from ${JSON.stringify(dataUrl)}\n`
        const outFile = pJoin(ssrDir, key + '.js')
        fsMkdir(pDirname(outFile), { recursive: true })
        fsWrite(outFile, wrapper)
      }
    }),
  }
})
```

- [ ] **Step 2: Run the existing test suite to confirm the mock extension didn't break anything**

Run: `cd packages/cli && pnpm vitest run build.test.ts`
Expected: PASS — all pre-existing tests still pass (the SSR branch is unchanged; the new `ssr === false` branch is only reached by code that doesn't exist yet, so it isn't exercised).

- [ ] **Step 3: Write the new failing tests**

In `packages/cli/src/commands/build.test.ts`, add these tests inside the `describe('buildPages'` block, after the existing `'deduplicates script when same component renders multiple times'` test:

```typescript
  it('replaces canopy placeholder data-src with the real asset URL and injects the runtime script', async () => {
    const pagesDir = join(tmpDir, 'src', 'pages')
    const componentsDir = join(tmpDir, 'src', 'components')
    const distDir = join(tmpDir, 'dist')
    mkdirSync(pagesDir, { recursive: true })
    mkdirSync(componentsDir, { recursive: true })

    writeFileSync(
      join(componentsDir, 'Counter.wald'),
      [
        '---',
        'const { initial = 0 } = $$props',
        '---',
        '<button>{initial}</button>',
        '<script>export default function(root, props) { root.textContent = props.initial }</script>',
      ].join('\n')
    )

    writeFileSync(
      join(pagesDir, 'index.wald'),
      ["---", "import Counter from '../components/Counter.wald'", '---', '<Counter canopy:load initial={3} />'].join('\n')
    )

    await buildPages(pagesDir, makeConfig(distDir))

    const html = readFileSync(join(distDir, 'index.html'), 'utf8')
    expect(html).toContain('data-src="/assets/counter-testhash.js"')
    expect(html).not.toContain('wald:canopy:Counter')
    expect(html).toContain('<script type="module" src="/assets/wald-canopy-testhash.js"></script>')
  })

  it('does not hoist the inline script of a component used with canopy (it is bundled separately)', async () => {
    const pagesDir = join(tmpDir, 'src', 'pages')
    const componentsDir = join(tmpDir, 'src', 'components')
    const distDir = join(tmpDir, 'dist')
    mkdirSync(pagesDir, { recursive: true })
    mkdirSync(componentsDir, { recursive: true })

    writeFileSync(
      join(componentsDir, 'Counter.wald'),
      [
        '---',
        'const { initial = 0 } = $$props',
        '---',
        '<button>{initial}</button>',
        '<script>export default function(root, props) { root.textContent = props.initial }</script>',
      ].join('\n')
    )

    writeFileSync(
      join(pagesDir, 'index.wald'),
      ["---", "import Counter from '../components/Counter.wald'", '---', '<Counter canopy:load initial={3} />'].join('\n')
    )

    await buildPages(pagesDir, makeConfig(distDir))

    const html = readFileSync(join(distDir, 'index.html'), 'utf8')
    expect(html).not.toContain('export default function(root, props)')
  })

  it('does not inject the canopy runtime script when no page uses canopy', async () => {
    const pagesDir = join(tmpDir, 'src', 'pages')
    const distDir = join(tmpDir, 'dist')
    mkdirSync(pagesDir, { recursive: true })
    writeFileSync(join(pagesDir, 'index.wald'), '<p>hi</p>')

    await buildPages(pagesDir, makeConfig(distDir))

    const html = readFileSync(join(distDir, 'index.html'), 'utf8')
    expect(html).not.toContain('wald-canopy')
  })
```

- [ ] **Step 4: Run tests to verify they fail**

Run: `cd packages/cli && pnpm vitest run build.test.ts`
Expected: FAIL — `buildPages()` doesn't scan for canopy usage, run the client build, strip canopy scripts, or replace placeholders yet, so none of the three new assertions hold.

- [ ] **Step 5: Wire it into `buildPages()`**

Replace the full contents of `packages/cli/src/commands/build.ts`:

```typescript
import { mkdirSync, writeFileSync, existsSync, cpSync, rmSync } from 'node:fs'
import { join, relative, dirname } from 'node:path'
import { defineCommand } from 'citty'
import ora from 'ora'
import { build, mergeConfig } from 'vite'
import { waldPlugin } from '../vite-plugin.js'
import { loadWaldConfig, type WaldConfig } from '../config.js'
import { scanRoutes } from '../router/index.js'
import { maybeWrap, hoistScripts } from '../shell.js'
import { scanCanopyEntries, collectCanopyScriptContents } from '../canopy-scan.js'
import { buildCanopyClient, type CanopyAssetMap } from '../canopy-build.js'

function resolveOutPath(distDir: string, pattern: string, params: Record<string, string> = {}): string {
  let path = pattern
  for (const [key, value] of Object.entries(params)) {
    path = path.replace(`:${key}`, value)
  }
  return pattern === '/'
    ? join(distDir, 'index.html')
    : join(distDir, path.slice(1), 'index.html')
}

function stripCanopyScripts(html: string, canopyScriptContents: Set<string>): string {
  if (canopyScriptContents.size === 0) return html
  let result = html
  for (const content of canopyScriptContents) {
    result = result.split(content).join('')
  }
  return result
}

function applyCanopyAssets(html: string, assetMap: CanopyAssetMap): string {
  const replaced = html.replace(/data-src="wald:canopy:(\w+)"/g, (full, name) => {
    const url = assetMap.get(name.toLowerCase())
    return url ? `data-src="${url}"` : full
  })

  if (!replaced.includes('<wald-canopy')) return replaced

  const runtimeUrl = assetMap.get('wald-canopy')
  if (!runtimeUrl) return replaced

  const script = `<script type="module" src="${runtimeUrl}"></script>`
  return replaced.replace('</body>', `${script}\n</body>`)
}

export async function buildPages(
  pagesDir: string,
  config: Required<WaldConfig>,
  publicDir?: string,
  contentDir?: string,
): Promise<void> {
  const distDir = config.outDir
  const routes = scanRoutes(pagesDir)
  const staticRoutes = routes.filter(r => r.params.length === 0)
  const dynamicRoutes = routes.filter(r => r.params.length > 0)

  const ssrDir = join(dirname(distDir), '.wald-ssr')

  const input = Object.fromEntries(
    routes.map(r => [relative(pagesDir, r.file).replace(/\.wald$/, ''), r.file]),
  )

  // Pass 0 — scan src/ for canopy:* component usage.
  const srcDir = dirname(pagesDir)
  const { entries: canopyEntries, warnings: canopyWarnings } = scanCanopyEntries(srcDir)
  for (const warning of canopyWarnings) {
    console.warn(`⚠ ${warning}`)
  }
  const canopyScriptContents = collectCanopyScriptContents(canopyEntries)

  // Pass 1a — bundle canopy scripts + the @waldjs/canopy runtime as a client build.
  const canopyAssets = await buildCanopyClient(canopyEntries, distDir, config.base, config.vite)

  // Pass 1b — Bundle all .wald pages into an SSR build.
  // config.vite goes first so WaldJS required settings in second arg always win
  // (prevents user from accidentally overriding ssr: true or outDir).
  await build(mergeConfig(
    config.vite ?? {},
    {
      // _waldContentDir is read by the test mock to know where content files live.
      // Real Vite ignores unknown top-level config keys.
      _waldContentDir: contentDir,
      base: config.base,
      plugins: [waldPlugin()],
      build: {
        ssr: true,
        outDir: ssrDir,
        rollupOptions: { input },
        emptyOutDir: true,
      },
    } as any,
  ))

  try {
    // Pass 2 — Pre-render each static route to an HTML file.
    for (const route of staticRoutes) {
      const key = relative(pagesDir, route.file).replace(/\.wald$/, '')
      const mod = await import(join(ssrDir, key + '.js')) as {
        default: { render: (props?: Record<string, unknown>) => Promise<string> }
      }
      const rendered = stripCanopyScripts(await mod.default.render(), canopyScriptContents)
      const html = applyCanopyAssets(hoistScripts(maybeWrap(rendered)), canopyAssets)
      const outPath = resolveOutPath(distDir, route.pattern)
      mkdirSync(dirname(outPath), { recursive: true })
      writeFileSync(outPath, html)
    }

    for (const route of dynamicRoutes) {
      const key = relative(pagesDir, route.file).replace(/\.wald$/, '')
      const mod = await import(join(ssrDir, key + '.js')) as {
        default: { render: (props?: Record<string, unknown>) => Promise<string> }
        getStaticPaths?: () => Promise<Array<{ params: Record<string, string> }>>
      }

      if (!mod.getStaticPaths) {
        console.warn(`⚠ Skipping dynamic route ${route.pattern} — no getStaticPaths() export`)
        continue
      }

      const paths = await mod.getStaticPaths()
      for (const { params } of paths) {
        const rendered = stripCanopyScripts(await mod.default.render(params), canopyScriptContents)
        const html = applyCanopyAssets(hoistScripts(maybeWrap(rendered)), canopyAssets)
        const outPath = resolveOutPath(distDir, route.pattern, params)
        mkdirSync(dirname(outPath), { recursive: true })
        writeFileSync(outPath, html)
      }
    }
  } finally {
    rmSync(ssrDir, { recursive: true, force: true })
  }

  if (publicDir && existsSync(publicDir)) {
    cpSync(publicDir, distDir, { recursive: true })
  }
}

export const buildCommand = defineCommand({
  meta: { description: 'Build your forest for production' },
  async run() {
    const cwd = process.cwd()
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

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd packages/cli && pnpm vitest run build.test.ts`
Expected: PASS, all tests including the 3 new ones.

- [ ] **Step 7: Run the full CLI suite**

Run: `cd packages/cli && pnpm vitest run`
Expected: PASS, all tests green.

- [ ] **Step 8: Run the full monorepo test suite**

Run: `cd /Users/stefan/Desktop/semantique-agency/repositories/waldjs && pnpm test`
Expected: PASS across all packages (`canopy`, `compiler`, `cli`, `runtime`, `content`).

- [ ] **Step 9: Commit**

```bash
cd /Users/stefan/Desktop/semantique-agency/repositories/waldjs
git add packages/cli/src/commands/build.ts packages/cli/src/commands/build.test.ts
git commit -m "feat(cli): wire canopy scan, client build, and asset injection into buildPages()"
```

---

## Task 9: Update README status

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Flip the status banner**

Change line 5:

```
> **Status:** Early development. Phases 0–2b and 4a–4b are complete. Phase 3 (client-side hydration) is next.
```

to:

```
> **Status:** Early development. Phases 0–3 and 4a–4b are complete. Phase 4c (deployment adapters) is next.
```

- [ ] **Step 2: Update the forest metaphor table**

Change:

```
| **Canopies** | Client-side hydration *(coming in Phase 3)* |
```

to:

```
| **Canopies** | Client-side hydration via `canopy:load`/`canopy:idle`/`canopy:visible` |
```

- [ ] **Step 3: Add `@waldjs/canopy` to the Packages table**

Change:

```
| Package | Description |
|---|---|
| `@waldjs/cli` | The `wald` CLI — `plant`, `grow`, `build`, `preview` |
| `@waldjs/compiler` | Compiles `.wald` files to JavaScript modules |
| `@waldjs/runtime` | Runtime helpers — `createTree`, `renderTemplate` |
| `@waldjs/content` | Content collection reader — `readCollection`, `readEntry` |
```

to:

```
| Package | Description |
|---|---|
| `@waldjs/cli` | The `wald` CLI — `plant`, `grow`, `build`, `preview` |
| `@waldjs/compiler` | Compiles `.wald` files to JavaScript modules |
| `@waldjs/runtime` | Runtime helpers — `createTree`, `renderTemplate` |
| `@waldjs/content` | Content collection reader — `readCollection`, `readEntry` |
| `@waldjs/canopy` | `<wald-canopy>` client-side hydration runtime |
```

- [ ] **Step 4: Flip the phases list**

Change:

```
- **Phase 3 — Canopy:** Client-side hydration 🚧
```

to:

```
- **Phase 3 — Canopy:** Client-side hydration ✅
```

- [ ] **Step 5: Commit**

```bash
cd /Users/stefan/Desktop/semantique-agency/repositories/waldjs
git add README.md
git commit -m "docs: mark Phase 3 — Canopy Islands complete"
```

---

## Self-Review Notes (for the plan author, already applied above)

- **Spec coverage:** every "Vastgestelde keuzes" row and every file in "Geraakte bestanden" from the spec maps to a task above (canopy package → Task 1, AST → Task 2, scanner → Task 3, transform → Task 4, Vite plugin → Task 5, build pipeline → Tasks 6-8, dev server → no changes needed, confirmed unaffected since `wald grow` already uses `waldPlugin()` which now resolves `?canopy-script` virtual modules automatically).
- **Gap found and fixed during planning:** the spec didn't specify how a canopy component's own inline `<script>` (still emitted by its individual SSR `render()` call) avoids being hoisted alongside the bundled version. Task 8 adds `stripCanopyScripts()` + `collectCanopyScriptContents()` (Task 6) to fix this — without it, pages would ship a broken inline `export default function...` script tag that throws a `SyntaxError` in the browser.
- **No placeholders:** every step has complete, runnable code — no TBD/TODO.
- **Type consistency checked:** `CanopyAssetMap` (Task 7) is the same type threaded through `buildCanopyClient()` and consumed by `applyCanopyAssets()` (Task 8). `ComponentNode.canopy` (Task 2) has the identical shape (`{ strategy: 'load' | 'idle' | 'visible' }`) used by the scanner (Task 3), transform (Task 4), and `canopy-scan.ts` (Task 6).
