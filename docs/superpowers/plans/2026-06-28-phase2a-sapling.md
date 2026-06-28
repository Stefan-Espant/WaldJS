# Phase 2a — Sapling: Content Collections & Static Paths

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Markdown content collections (`wald:content` virtual module) and `getStaticPaths()` support so `wald build` generates static HTML for content-driven dynamic routes.

**Architecture:** A new `@waldjs/content` package reads Markdown files with `gray-matter` + `marked`. `waldPlugin()` gains a second Vite plugin that resolves `wald:content` to a virtual module wrapping those functions. The compiler transform gains export hoisting so `export async function getStaticPaths()` in frontmatter emits as a real module export. `wald build` calls `getStaticPaths()` on dynamic routes and renders one HTML file per returned params set.

**Tech Stack:** `gray-matter` (frontmatter parsing), `marked` (Markdown → HTML), Vite virtual modules, Node.js `data:` URL imports, pnpm workspaces, Turborepo, Vitest.

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `packages/content/package.json` | Create | Package metadata, deps: gray-matter, marked |
| `packages/content/tsconfig.json` | Create | TypeScript config |
| `packages/content/src/index.ts` | Create | `readCollection`, `readEntry`, `Entry` type |
| `packages/content/src/index.test.ts` | Create | 5 tests for readCollection + readEntry |
| `packages/compiler/src/transform/index.ts` | Modify | Hoist `export` declarations from frontmatter |
| `packages/compiler/src/transform/index.test.ts` | Modify | 2 new tests for export hoisting |
| `packages/compiler/src/vite/plugin.ts` | Modify | Add `wald:content` virtual module plugin |
| `packages/compiler/src/vite/plugin.test.ts` | Create | 2 tests for virtual module resolution |
| `packages/compiler/package.json` | Modify | Add `@waldjs/content: workspace:*` dependency |
| `packages/cli/src/commands/build.ts` | Modify | getStaticPaths support + wald:content patching |
| `packages/cli/src/commands/build.test.ts` | Modify | 1 new test: getStaticPaths generates multiple HTML files |
| `packages/cli/src/commands/plant.ts` | Modify | Scaffold `content/blog/hello-world.md` + blog pages |
| `packages/cli/src/commands/plant.test.ts` | Modify | 1 new test: content file created |

---

## Task 1: `@waldjs/content` package

**Files:**
- Create: `packages/content/package.json`
- Create: `packages/content/tsconfig.json`
- Create: `packages/content/src/index.ts`
- Create: `packages/content/src/index.test.ts`

- [ ] **Step 1: Create `packages/content/package.json`**

```json
{
  "name": "@waldjs/content",
  "version": "0.1.0",
  "private": false,
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
    "gray-matter": "^4.0.3",
    "marked": "^12.0.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "typescript": "^5.5.0",
    "vitest": "^2.0.0"
  }
}
```

- [ ] **Step 2: Create `packages/content/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "dist"
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Write the failing tests**

Create `packages/content/src/index.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { readCollection, readEntry } from './index.js'

let contentDir: string

beforeEach(() => {
  contentDir = mkdtempSync(join(tmpdir(), 'wald-content-'))
  mkdirSync(join(contentDir, 'blog'))
})

describe('readCollection', () => {
  it('returns all entries sorted by filename', async () => {
    writeFileSync(join(contentDir, 'blog', 'beta.md'), '---\ntitle: Beta\n---\nBody')
    writeFileSync(join(contentDir, 'blog', 'alpha.md'), '---\ntitle: Alpha\n---\nBody')
    const entries = await readCollection('blog', contentDir)
    expect(entries).toHaveLength(2)
    expect(entries[0].slug).toBe('alpha')
    expect(entries[1].slug).toBe('beta')
  })

  it('parses frontmatter into data', async () => {
    writeFileSync(join(contentDir, 'blog', 'post.md'), '---\ntitle: My Post\ndate: 2026-06-28\n---\nContent')
    const [entry] = await readCollection('blog', contentDir)
    expect(entry.data.title).toBe('My Post')
    expect(entry.data.date).toBeTruthy()
  })

  it('renders markdown body as HTML', async () => {
    writeFileSync(join(contentDir, 'blog', 'post.md'), '---\n---\n# Hello\n\nParagraph.')
    const [entry] = await readCollection('blog', contentDir)
    expect(entry.body).toContain('<h1>')
    expect(entry.body).toContain('<p>')
  })
})

describe('readEntry', () => {
  it('returns a single entry by slug', async () => {
    writeFileSync(join(contentDir, 'blog', 'hello-world.md'), '---\ntitle: Hello World\n---\nContent')
    const entry = await readEntry('blog', 'hello-world', contentDir)
    expect(entry.slug).toBe('hello-world')
    expect(entry.data.title).toBe('Hello World')
  })

  it('throws when entry does not exist', async () => {
    await expect(readEntry('blog', 'nonexistent', contentDir)).rejects.toThrow()
  })
})
```

- [ ] **Step 4: Run to verify tests fail**

```bash
cd packages/content && pnpm install && pnpm test
```

Expected: FAIL — `Cannot find module './index.js'`

- [ ] **Step 5: Create `packages/content/src/index.ts`**

```ts
import { readdir, readFile } from 'node:fs/promises'
import { join, basename } from 'node:path'
import matter from 'gray-matter'
import { marked } from 'marked'

export type Entry = {
  slug: string
  data: Record<string, unknown>
  body: string
}

export async function readCollection(name: string, contentDir: string): Promise<Entry[]> {
  const dir = join(contentDir, name)
  const files = (await readdir(dir)).filter(f => f.endsWith('.md')).sort()
  return Promise.all(files.map(file => parseEntry(join(dir, file))))
}

export async function readEntry(collection: string, slug: string, contentDir: string): Promise<Entry> {
  const file = join(contentDir, collection, `${slug}.md`)
  return parseEntry(file)
}

async function parseEntry(filePath: string): Promise<Entry> {
  const raw = await readFile(filePath, 'utf8')
  const { data, content } = matter(raw)
  const body = await marked(content)
  const slug = basename(filePath, '.md')
  return { slug, data: data as Record<string, unknown>, body }
}
```

- [ ] **Step 6: Run to verify 5 tests pass**

```bash
cd packages/content && pnpm test
```

Expected: 5 tests passing.

- [ ] **Step 7: Commit**

```bash
git add packages/content/
git commit -m "feat(content): add @waldjs/content package with readCollection and readEntry"
```

---

## Task 2: Export hoisting in compiler transform

The compiler currently places all frontmatter code inside the `createTree` callback. `export` declarations inside a function body are a syntax error. This task detects `export` blocks in frontmatter and hoists them to module level.

**Files:**
- Modify: `packages/compiler/src/transform/index.ts`
- Modify: `packages/compiler/src/transform/index.test.ts`

- [ ] **Step 1: Add failing tests**

Add to `packages/compiler/src/transform/index.test.ts` (append inside the `describe('transform', ...)` block):

```ts
  it('hoists export function to module level before export default', () => {
    const ast: WaldDocument = {
      type: 'document',
      frontmatter: {
        type: 'frontmatter',
        code: 'export async function getStaticPaths() {\n  return [{ params: { slug: "hello" } }]\n}\nconst x = 1',
      },
      template: [],
    }
    const output = transform(ast)
    const exportFnPos = output.indexOf('export async function getStaticPaths')
    const exportDefaultPos = output.indexOf('export default createTree')
    expect(exportFnPos).toBeGreaterThanOrEqual(0)
    expect(exportFnPos).toBeLessThan(exportDefaultPos)
  })

  it('keeps non-export statements inside the createTree callback', () => {
    const ast: WaldDocument = {
      type: 'document',
      frontmatter: {
        type: 'frontmatter',
        code: 'export async function getStaticPaths() {\n  return []\n}\nconst x = 1',
      },
      template: [],
    }
    const output = transform(ast)
    const exportDefaultPos = output.indexOf('export default createTree')
    const constXPos = output.indexOf('const x = 1')
    expect(constXPos).toBeGreaterThan(exportDefaultPos)
  })

  it('hoists import statements to module level before export default', () => {
    const ast: WaldDocument = {
      type: 'document',
      frontmatter: {
        type: 'frontmatter',
        code: "import { getCollection } from 'wald:content'\nconst posts = await getCollection('blog')",
      },
      template: [],
    }
    const output = transform(ast)
    const importPos = output.indexOf("import { getCollection } from 'wald:content'")
    const exportDefaultPos = output.indexOf('export default createTree')
    expect(importPos).toBeGreaterThanOrEqual(0)
    expect(importPos).toBeLessThan(exportDefaultPos)
    // the await call stays inside the callback
    const postsPos = output.indexOf("const posts = await getCollection('blog')")
    expect(postsPos).toBeGreaterThan(exportDefaultPos)
  })
```

- [ ] **Step 2: Run to verify new tests fail**

```bash
cd packages/compiler && pnpm test -- transform
```

Expected: 3 new tests FAIL (the hoisted function/import appears inside createTree, not before it).

- [ ] **Step 3: Update `packages/compiler/src/transform/index.ts`**

Replace the full file:

```ts
import type { WaldDocument, TemplateNode, ElementNode, AttributeNode } from '../ast/types.js'

const VOID_ELEMENTS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
  'link', 'meta', 'param', 'source', 'track', 'wbr',
])

export function transform(ast: WaldDocument): string {
  const templateCode = renderNodes(ast.template)
  const code = ast.frontmatter.code ?? ''
  const { hoisted, body } = extractExports(code)

  const bodyIndented = body
    ? body.split('\n').map(line => `  ${line}`).join('\n')
    : ''

  const parts = [
    `import { createTree, renderTemplate } from '@waldjs/runtime'`,
    ``,
  ]

  if (hoisted) {
    parts.push(hoisted)
    parts.push(``)
  }

  parts.push(
    `export default createTree(async ($$result, $$props) => {`,
    bodyIndented,
    ``,
    `  return renderTemplate\`${templateCode}\``,
    `})`,
  )

  return parts.join('\n')
}

function extractExports(code: string): { hoisted: string; body: string } {
  const lines = code.split('\n')
  const hoistedBlocks: string[] = []
  const bodyLines: string[] = []
  let i = 0

  while (i < lines.length) {
    const trimmed = lines[i].trimStart()
    if (trimmed.startsWith('import ')) {
      // import statements are always single-line in frontmatter
      hoistedBlocks.push(lines[i])
      i++
    } else if (trimmed.startsWith('export ')) {
      // export blocks may span multiple lines — collect until balanced braces
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
  }
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

- [ ] **Step 4: Run all transform tests**

```bash
cd packages/compiler && pnpm test -- transform
```

Expected: all tests pass (existing 6 + new 3 = 9 total).

- [ ] **Step 5: Commit**

```bash
git add packages/compiler/src/transform/
git commit -m "feat(compiler): hoist import and export declarations from frontmatter to module level"
```

---

## Task 3: `wald:content` virtual module in Vite plugin

**Files:**
- Modify: `packages/compiler/src/vite/plugin.ts`
- Create: `packages/compiler/src/vite/plugin.test.ts`
- Modify: `packages/compiler/package.json`

- [ ] **Step 1: Add `@waldjs/content` to compiler dependencies**

Edit `packages/compiler/package.json` — add to `"dependencies"`:

```json
"dependencies": {
  "@waldjs/content": "workspace:*",
  "@waldjs/runtime": "workspace:*",
  "vite": "^5.0.0"
}
```

Then run:

```bash
cd packages/compiler && pnpm install
```

- [ ] **Step 2: Write the failing tests**

Create `packages/compiler/src/vite/plugin.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { waldPlugin } from './plugin.js'

describe('waldPlugin', () => {
  it('resolves wald:content to a virtual module id', () => {
    const plugins = waldPlugin()
    const contentPlugin = plugins.find(p => p.name === 'vite-plugin-wald-content')!
    const resolved = (contentPlugin.resolveId as Function)('wald:content', undefined, {})
    expect(resolved).toBe('\0wald:content')
  })

  it('loads wald:content with getCollection and getEntry exports', () => {
    const plugins = waldPlugin()
    const contentPlugin = plugins.find(p => p.name === 'vite-plugin-wald-content')!
    const code = (contentPlugin.load as Function)('\0wald:content')
    expect(code).toContain('export const getCollection')
    expect(code).toContain('export const getEntry')
  })
})
```

- [ ] **Step 3: Run to verify tests fail**

```bash
cd packages/compiler && pnpm test -- plugin
```

Expected: FAIL — `waldPlugin()` returns a single Plugin, not an array; `find` fails.

- [ ] **Step 4: Update `packages/compiler/src/vite/plugin.ts`**

```ts
import type { Plugin } from 'vite'
import { compile } from '../compile.js'
import { join } from 'node:path'

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
        return compile(code, id)
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

- [ ] **Step 5: Run to verify 2 tests pass**

```bash
cd packages/compiler && pnpm test -- plugin
```

Expected: 2 tests passing.

- [ ] **Step 6: Update compiler `index.ts` export type**

The return type of `waldPlugin` changed from `Plugin` to `Plugin[]`. Check `packages/compiler/src/index.ts` — the export line is:

```ts
export { waldPlugin } from './vite/plugin.js'
```

No change needed — the function is re-exported as-is. But callers that typed `waldPlugin(): Plugin` may need updating. The `grow.ts` uses `plugins: [waldPlugin()]` — since Vite accepts `PluginOption[]` and `Plugin[]` is a valid `PluginOption`, this still works without changes.

Verify the compiler builds:

```bash
cd packages/compiler && pnpm build
```

Expected: no TypeScript errors.

- [ ] **Step 7: Commit**

```bash
git add packages/compiler/src/vite/plugin.ts packages/compiler/src/vite/plugin.test.ts packages/compiler/package.json
git commit -m "feat(compiler): add wald:content virtual module to waldPlugin"
```

---

## Task 4: `wald build` — getStaticPaths + wald:content patching

**Files:**
- Modify: `packages/cli/src/commands/build.ts`
- Modify: `packages/cli/src/commands/build.test.ts`
- Modify: `packages/cli/package.json`

- [ ] **Step 1: Add `@waldjs/content` to CLI dependencies**

Edit `packages/cli/package.json` — add to `"dependencies"`:

```json
"@waldjs/content": "workspace:*"
```

Then:

```bash
cd packages/cli && pnpm install
```

- [ ] **Step 2: Write the failing test**

Add to `packages/cli/src/commands/build.test.ts` (append inside the `describe('buildPages', ...)` block, also add `mkdirSync` to the existing import if not present):

```ts
  it('generates HTML for each path returned by getStaticPaths()', async () => {
    const pagesDir = join(tmpDir, 'src', 'pages')
    const distDir = join(tmpDir, 'dist')
    const contentDir = join(tmpDir, 'content')

    mkdirSync(join(pagesDir, 'blog'), { recursive: true })
    mkdirSync(join(contentDir, 'blog'), { recursive: true })

    writeFileSync(join(contentDir, 'blog', 'hello.md'), '---\ntitle: Hello\n---\nContent')
    writeFileSync(join(contentDir, 'blog', 'world.md'), '---\ntitle: World\n---\nContent')

    writeFileSync(
      join(pagesDir, 'blog', '[slug].wald'),
      [
        '---',
        "import { getCollection, getEntry } from 'wald:content'",
        'export async function getStaticPaths() {',
        '  const posts = await getCollection(\'blog\')',
        '  return posts.map(p => ({ params: { slug: p.slug } }))',
        '}',
        "const post = await getEntry('blog', $$props.slug)",
        '---',
        '<h1>{post.data.title}</h1>',
      ].join('\n')
    )

    await buildPages(pagesDir, distDir, undefined, contentDir)

    expect(readFileSync(join(distDir, 'blog', 'hello', 'index.html'), 'utf8')).toContain('<h1>Hello</h1>')
    expect(readFileSync(join(distDir, 'blog', 'world', 'index.html'), 'utf8')).toContain('<h1>World</h1>')
  })
```

- [ ] **Step 3: Run to verify test fails**

```bash
cd packages/cli && pnpm test -- build
```

Expected: FAIL — `buildPages` doesn't accept `contentDir` and doesn't handle dynamic routes.

- [ ] **Step 4: Update `packages/cli/src/commands/build.ts`**

Replace the full file:

```ts
import { mkdirSync, writeFileSync, readFileSync, existsSync, cpSync } from 'node:fs'
import { join } from 'node:path'
import { defineCommand } from 'citty'
import ora from 'ora'
import { compile } from '@waldjs/compiler'
import { scanRoutes } from '../router/index.js'
import { wrapHtml } from '../shell.js'

function resolveRuntimeUrl(): string {
  return new URL('../../node_modules/@waldjs/runtime/dist/index.js', import.meta.url).href
}

function resolveContentUrl(): string {
  return new URL('../../node_modules/@waldjs/content/dist/index.js', import.meta.url).href
}

function buildContentModuleUrl(contentDir: string): string {
  const contentRuntimeUrl = resolveContentUrl()
  const code = [
    `import { readCollection as _rc, readEntry as _re } from ${JSON.stringify(contentRuntimeUrl)}`,
    `const contentDir = ${JSON.stringify(contentDir)}`,
    `export const getCollection = (name) => _rc(name, contentDir)`,
    `export const getEntry = (collection, slug) => _re(collection, slug, contentDir)`,
  ].join('\n')
  return `data:text/javascript,${encodeURIComponent(code)}`
}

function computeOutPath(distDir: string, pattern: string, params: Record<string, string>): string {
  let path = pattern
  for (const [key, value] of Object.entries(params)) {
    path = path.replace(`:${key}`, value)
  }
  return join(distDir, path.slice(1), 'index.html')
}

export async function buildPages(
  pagesDir: string,
  distDir: string,
  publicDir?: string,
  contentDir?: string,
): Promise<void> {
  const routes = scanRoutes(pagesDir)
  const staticRoutes = routes.filter(r => r.params.length === 0)
  const dynamicRoutes = routes.filter(r => r.params.length > 0)

  const runtimeUrl = resolveRuntimeUrl()
  const contentModuleUrl = contentDir ? buildContentModuleUrl(contentDir) : null

  function patchModule(jsModule: string): string {
    let patched = jsModule.replace("'@waldjs/runtime'", JSON.stringify(runtimeUrl))
    if (contentModuleUrl) {
      patched = patched.replace("'wald:content'", JSON.stringify(contentModuleUrl))
    }
    return patched
  }

  for (const route of staticRoutes) {
    const source = readFileSync(route.file, 'utf8')
    const patched = patchModule(compile(source, route.file))
    const mod = await import(`data:text/javascript,${encodeURIComponent(patched)}`) as {
      default: { render: (props?: Record<string, unknown>) => Promise<string> }
    }
    const html = wrapHtml(await mod.default.render())
    const outPath = route.pattern === '/'
      ? join(distDir, 'index.html')
      : join(distDir, route.pattern.slice(1), 'index.html')
    mkdirSync(join(outPath, '..'), { recursive: true })
    writeFileSync(outPath, html)
  }

  for (const route of dynamicRoutes) {
    const source = readFileSync(route.file, 'utf8')
    const patched = patchModule(compile(source, route.file))
    const mod = await import(`data:text/javascript,${encodeURIComponent(patched)}`) as {
      default: { render: (props?: Record<string, unknown>) => Promise<string> }
      getStaticPaths?: () => Promise<Array<{ params: Record<string, string> }>>
    }

    if (!mod.getStaticPaths) {
      console.warn(`⚠ Skipping dynamic route ${route.pattern} — no getStaticPaths() export`)
      continue
    }

    const paths = await mod.getStaticPaths()
    for (const { params } of paths) {
      const html = wrapHtml(await mod.default.render(params))
      const outPath = computeOutPath(distDir, route.pattern, params)
      mkdirSync(join(outPath, '..'), { recursive: true })
      writeFileSync(outPath, html)
    }
  }

  if (publicDir && existsSync(publicDir)) {
    cpSync(publicDir, distDir, { recursive: true })
  }
}

export const buildCommand = defineCommand({
  meta: { description: 'Build your forest for production' },
  async run() {
    const cwd = process.cwd()
    const pagesDir = join(cwd, 'src', 'pages')
    const distDir = join(cwd, 'dist')
    const publicDir = join(cwd, 'public')
    const contentDir = join(cwd, 'content')

    const spinner = ora('Building your forest...').start()
    try {
      await buildPages(pagesDir, distDir, publicDir, contentDir)
      spinner.succeed('Build complete → dist/')
    } catch (e) {
      spinner.fail(`Build failed: ${e}`)
      throw e
    }
  },
})
```

- [ ] **Step 5: Run all build tests**

```bash
cd packages/cli && pnpm test -- build
```

Expected: 5 tests passing (4 existing + 1 new).

- [ ] **Step 6: Commit**

```bash
git add packages/cli/src/commands/build.ts packages/cli/src/commands/build.test.ts packages/cli/package.json
git commit -m "feat(cli): add getStaticPaths support and wald:content patching to wald build"
```

---

## Task 5: `wald plant` — scaffold content/ and blog pages

**Files:**
- Modify: `packages/cli/src/commands/plant.ts`
- Modify: `packages/cli/src/commands/plant.test.ts`

- [ ] **Step 1: Add failing test**

Add to `packages/cli/src/commands/plant.test.ts` (append inside `describe('scaffold', ...)` block):

```ts
  it('creates content/blog/hello-world.md with frontmatter', async () => {
    const base = mkdtempSync(join(tmpdir(), 'wald-plant-'))
    const dir = join(base, 'my-forest')
    await scaffold(dir)
    const content = readFileSync(join(dir, 'content', 'blog', 'hello-world.md'), 'utf8')
    expect(content).toContain('title:')
    expect(content).toContain('date:')
  })
```

- [ ] **Step 2: Run to verify test fails**

```bash
cd packages/cli && pnpm test -- plant
```

Expected: FAIL — `content/blog/hello-world.md` does not exist.

- [ ] **Step 3: Update `packages/cli/src/commands/plant.ts`**

Replace the full file:

```ts
import { mkdirSync, writeFileSync } from 'node:fs'
import { join, basename } from 'node:path'
import { defineCommand } from 'citty'
import ora from 'ora'

export async function scaffold(targetDir: string): Promise<void> {
  const name = basename(targetDir)

  mkdirSync(join(targetDir, 'src', 'pages', 'blog'), { recursive: true })
  mkdirSync(join(targetDir, 'content', 'blog'), { recursive: true })
  mkdirSync(join(targetDir, 'public'), { recursive: true })

  writeFileSync(
    join(targetDir, 'src', 'pages', 'index.wald'),
    `---\nconst title = "Hello Wald"\n---\n<h1>{title}</h1>\n<p>Welcome to your forest.</p>\n`
  )

  writeFileSync(
    join(targetDir, 'src', 'pages', 'blog', 'index.wald'),
    [
      '---',
      "import { getCollection } from 'wald:content'",
      "const posts = await getCollection('blog')",
      '---',
      '<h1>Blog</h1>',
      "<ul>{posts.map(p => `<li><a href=\"/blog/${p.slug}\">${p.data.title}</a></li>`).join('')}</ul>",
      '',
    ].join('\n')
  )

  writeFileSync(
    join(targetDir, 'src', 'pages', 'blog', '[slug].wald'),
    [
      '---',
      "import { getCollection, getEntry } from 'wald:content'",
      'export async function getStaticPaths() {',
      "  const posts = await getCollection('blog')",
      '  return posts.map(p => ({ params: { slug: p.slug } }))',
      '}',
      "const post = await getEntry('blog', $$props.slug)",
      '---',
      '<h1>{post.data.title}</h1>',
      '<div>{post.body}</div>',
      '',
    ].join('\n')
  )

  const today = new Date().toISOString().slice(0, 10)
  writeFileSync(
    join(targetDir, 'content', 'blog', 'hello-world.md'),
    `---\ntitle: Hello World\ndate: ${today}\n---\n\nWelcome to your first post.\n`
  )

  writeFileSync(
    join(targetDir, 'package.json'),
    JSON.stringify(
      {
        name,
        private: true,
        type: 'module',
        scripts: {
          dev: 'wald grow',
          build: 'wald build',
          preview: 'wald preview',
        },
        dependencies: {
          '@waldjs/cli': 'latest',
        },
      },
      null,
      2
    ) + '\n'
  )

  writeFileSync(join(targetDir, '.gitignore'), 'node_modules\ndist\n.env\n.DS_Store\n')
}

export const plantCommand = defineCommand({
  meta: { description: 'Create a new WaldJS project' },
  args: {
    name: { type: 'positional', description: 'Project name', required: true },
  },
  async run({ args }) {
    const targetDir = join(process.cwd(), args.name)
    const spinner = ora(`Creating ${args.name}...`).start()
    await scaffold(targetDir)
    spinner.succeed(`Created ${args.name}`)
    console.log(`\n  cd ${args.name}`)
    console.log(`  pnpm install`)
    console.log(`  pnpm dev`)
  },
})
```

- [ ] **Step 4: Run all plant tests**

```bash
cd packages/cli && pnpm test -- plant
```

Expected: 5 tests passing (4 existing + 1 new).

- [ ] **Step 5: Commit**

```bash
git add packages/cli/src/commands/plant.ts packages/cli/src/commands/plant.test.ts
git commit -m "feat(cli): scaffold content/ and blog pages in wald plant"
```

---

## Task 6: Build verification

**Files:** None created. Validates the full monorepo.

- [ ] **Step 1: Install dependencies from root**

```bash
pnpm install
```

Expected: all workspace packages resolved, `@waldjs/content` linked.

- [ ] **Step 2: Full build**

```bash
pnpm build
```

Expected: all 4 packages build successfully.

- [ ] **Step 3: Full test suite**

```bash
pnpm test
```

Expected: all tests passing. Count at this point:
- `@waldjs/content`: 5
- `@waldjs/compiler`: 8 (transform) + 2 (plugin) + existing = ~18 total
- `@waldjs/cli`: 5 (build) + 5 (plant) + 8 (router) + 3 (grow) + 1 (preview) + 1 (shell) = 23 total
- `@waldjs/basic-example`: 3

- [ ] **Step 4: Verify CLI binary**

```bash
node packages/cli/bin/wald.js --help
```

Expected: shows plant/grow/build/preview.

- [ ] **Step 5: Commit if any stray changes**

```bash
git status
```

If clean: done. If any stray files: commit them with a descriptive message.
