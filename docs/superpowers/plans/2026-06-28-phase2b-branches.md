# Phase 2b — Branches: Components & Layouts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Herbruikbare `.wald` componenten en layouts met volledige HTML-shell controle toevoegen aan WaldJS.

**Architecture:** Componenten zijn identiek aan pagina's (beide `Tree` objecten). De runtime krijgt een `SafeHtml` class zodat component-output niet dubbel ge-escaped wordt. De compiler vult de bestaande `ComponentNode` stub in. `wald build` compileert `.wald` imports recursief zodat layouts werken. `wald grow` en `wald build` detecteren automatisch of output een volledige HTML-shell bevat.

**Tech Stack:** TypeScript, Vite, Node.js, Vitest, pnpm workspaces. Alle code zit in het monorepo op branch `phase2b/branches` (gebaseerd op `phase2a/sapling`).

---

## Worktree opzetten

Voer dit uit vanuit de repo-root (`/Users/stefan/Desktop/semantique-agency/repositories/waldjs`):

```bash
git worktree add .worktrees/phase2b-branches -b phase2b/branches phase2a/sapling
cd .worktrees/phase2b-branches
pnpm install
pnpm build
pnpm test
```

Expected: alle 83 bestaande tests slagen. Werk verder vanuit `.worktrees/phase2b-branches`.

---

## Bestandsoverzicht

| Bestand | Actie | Verantwoordelijkheid |
|---|---|---|
| `packages/runtime/src/index.ts` | Modify | `SafeHtml` class toevoegen, `renderTemplate` updaten |
| `packages/runtime/src/index.test.ts` | Modify | 2 tests voor `SafeHtml` toevoegen |
| `packages/compiler/src/transform/index.ts` | Modify | `renderComponent` functie, `SafeHtml` in import |
| `packages/compiler/src/transform/index.test.ts` | Modify | 3 tests voor component rendering |
| `packages/cli/src/shell.ts` | Modify | `maybeWrap` export toevoegen |
| `packages/cli/src/shell.test.ts` | Create | 4 tests voor `maybeWrap` |
| `packages/cli/src/commands/grow.ts` | Modify | `wrapHtml` → `maybeWrap` (2 plaatsen) |
| `packages/cli/src/commands/build.ts` | Modify | `compileWaldFile` recursief, `maybeWrap`, imports uitbreiden |
| `packages/cli/src/commands/build.test.ts` | Modify | 1 test: layout-pagina genereert correcte HTML-shell |
| `packages/cli/src/commands/plant.ts` | Modify | Scaffold `src/layouts/` + `src/components/` + bijgewerkte `index.wald` |
| `packages/cli/src/commands/plant.test.ts` | Modify | 2 tests: Layout.wald en Card.wald bestaan |

---

## Task 1: `SafeHtml` in de runtime

**Files:**
- Modify: `packages/runtime/src/index.ts`
- Modify: `packages/runtime/src/index.test.ts`

- [ ] **Stap 1: Schrijf de falende tests**

Voeg toe aan het einde van `packages/runtime/src/index.test.ts` (na de `createTree` describe block):

```ts
describe('SafeHtml', () => {
  it('renderTemplate inserts SafeHtml without escaping', () => {
    const result = renderTemplate`<div>${new SafeHtml('<b>bold</b>')}</div>`
    expect(result).toBe('<div><b>bold</b></div>')
  })

  it('renderTemplate still escapes plain strings alongside SafeHtml', () => {
    const result = renderTemplate`${new SafeHtml('<b>safe</b>')} ${'<bad>'}`
    expect(result).toBe('<b>safe</b> &lt;bad&gt;')
  })
})
```

Voeg `SafeHtml` toe aan de import bovenaan het testbestand:

```ts
import { createTree, renderTemplate, SafeHtml } from './index.js'
```

- [ ] **Stap 2: Verifieer dat de tests falen**

```bash
cd packages/runtime && pnpm test
```

Expected: FAIL — `SafeHtml is not exported from './index.js'`

- [ ] **Stap 3: Implementeer `SafeHtml` en update `renderTemplate`**

Vervang de volledige inhoud van `packages/runtime/src/index.ts`:

```ts
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

- [ ] **Stap 4: Verifieer dat alle runtime tests slagen**

```bash
cd packages/runtime && pnpm test
```

Expected: 11 tests passing (9 bestaand + 2 nieuw).

- [ ] **Stap 5: Commit**

```bash
git add packages/runtime/src/index.ts packages/runtime/src/index.test.ts
git commit -m "feat(runtime): add SafeHtml class for unescaped component output"
```

---

## Task 2: `ComponentNode` rendering in de compiler transform

**Files:**
- Modify: `packages/compiler/src/transform/index.ts`
- Modify: `packages/compiler/src/transform/index.test.ts`

**Context:** De `renderNode` functie heeft al een `case 'component': return ''` stub. Die vullen we in. De compiler genereert code zoals `${new SafeHtml(await Card.render({ title: "Hoi" }))}`. Voor componenten mét children wordt de kinderinhoud vooraf gerenderd als geneste `renderTemplate` en doorgegeven als `pond` prop.

- [ ] **Stap 1: Schrijf de falende tests**

Voeg toe aan `packages/compiler/src/transform/index.test.ts` (na de bestaande describe block):

```ts
describe('component rendering', () => {
  it('renders a self-closing component with string props', () => {
    const source = `---\nimport Card from './Card.wald'\n---\n<Card title="Hoi" />`
    const result = compile(source, 'test.wald')
    expect(result).toContain('SafeHtml')
    expect(result).toContain('await Card.render(')
    expect(result).toContain('title: "Hoi"')
  })

  it('renders a component with expression props', () => {
    const source = `---\nimport Card from './Card.wald'\nconst t = 'test'\n---\n<Card title={t} />`
    const result = compile(source, 'test.wald')
    expect(result).toContain('title: (t)')
  })

  it('renders a layout component with children as pond', () => {
    const source = `---\nimport Layout from './Layout.wald'\n---\n<Layout title="Home"><h1>Content</h1></Layout>`
    const result = compile(source, 'test.wald')
    expect(result).toContain('pond:')
    expect(result).toContain('await Layout.render(')
    expect(result).toContain('<h1>Content</h1>')
  })
})
```

- [ ] **Stap 2: Verifieer dat de tests falen**

```bash
cd packages/compiler && pnpm test -- transform
```

Expected: FAIL — alle 3 component tests falen (component geeft `''` terug).

- [ ] **Stap 3: Implementeer `renderComponent` en update de import**

Vervang de volledige inhoud van `packages/compiler/src/transform/index.ts`:

```ts
import type { WaldDocument, TemplateNode, ElementNode, ComponentNode, AttributeNode } from '../ast/types.js'

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
    `import { createTree, renderTemplate, SafeHtml } from '@waldjs/runtime'`,
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
      hoistedBlocks.push(lines[i])
      i++
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
    case 'component': return renderComponent(node)
  }
}

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

- [ ] **Stap 4: Verifieer dat alle compiler tests slagen**

```bash
cd packages/compiler && pnpm test
```

Expected: 45 tests passing (42 bestaand + 3 nieuw).

- [ ] **Stap 5: Commit**

```bash
git add packages/compiler/src/transform/index.ts packages/compiler/src/transform/index.test.ts
git commit -m "feat(compiler): render ComponentNode with SafeHtml and pond support"
```

---

## Task 3: `maybeWrap` in shell + `wald grow` update

**Files:**
- Modify: `packages/cli/src/shell.ts`
- Create: `packages/cli/src/shell.test.ts`
- Modify: `packages/cli/src/commands/grow.ts`

- [ ] **Stap 1: Schrijf de falende tests**

Maak nieuw bestand `packages/cli/src/shell.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { maybeWrap } from './shell.js'

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
```

- [ ] **Stap 2: Verifieer dat de tests falen**

```bash
cd packages/cli && pnpm test -- shell
```

Expected: FAIL — `maybeWrap is not exported from './shell.js'`

- [ ] **Stap 3: Voeg `maybeWrap` toe aan `shell.ts`**

Vervang de volledige inhoud van `packages/cli/src/shell.ts`:

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
```

- [ ] **Stap 4: Verifieer shell tests slagen**

```bash
cd packages/cli && pnpm test -- shell
```

Expected: 4 tests passing.

- [ ] **Stap 5: Update `grow.ts` — `wrapHtml` → `maybeWrap`**

In `packages/cli/src/commands/grow.ts`:

Verander de import bovenaan:
```ts
import { maybeWrap } from '../shell.js'
```

Verander in `handleRequest` (regel ~18):
```ts
return { status: 200, body: maybeWrap(html) }
```

Verander in de `growCommand` `run()` (regel ~43):
```ts
const full = maybeWrap(html)
```

- [ ] **Stap 6: Verifieer alle CLI tests slagen**

```bash
cd packages/cli && pnpm test
```

Expected: alle tests slagen (inclusief de 4 nieuwe shell tests).

- [ ] **Stap 7: Commit**

```bash
git add packages/cli/src/shell.ts packages/cli/src/shell.test.ts packages/cli/src/commands/grow.ts
git commit -m "feat(cli): add maybeWrap and update grow to skip wrapHtml for full HTML output"
```

---

## Task 4: `wald build` — recursieve `.wald` import compilatie + `maybeWrap`

**Files:**
- Modify: `packages/cli/src/commands/build.ts`
- Modify: `packages/cli/src/commands/build.test.ts`

**Context:** Huidige `build.ts` gebruikt een `patchModule` functie die alleen `@waldjs/runtime` en `wald:content` patches. Als een pagina `import Layout from '../layouts/Layout.wald'` heeft, werkt dit niet in de `data:` URL eval context — Node.js kan `.wald` bestanden niet laden. De oplossing: `compileWaldFile` compileert elk `.wald` bestand recursief en patcht alle `.wald` imports naar hun eigen `data:` URLs. Dit vervangt `patchModule` volledig.

- [ ] **Stap 1: Schrijf de falende test**

Voeg toe aan `packages/cli/src/commands/build.test.ts` (na de bestaande tests, binnen de `describe` block):

```ts
  it('renders layout HTML shell when page uses a layout component', async () => {
    const pagesDir = join(tmpDir, 'src', 'pages')
    const layoutsDir = join(tmpDir, 'src', 'layouts')
    const distDir = join(tmpDir, 'dist')

    mkdirSync(pagesDir, { recursive: true })
    mkdirSync(layoutsDir, { recursive: true })

    writeFileSync(
      join(layoutsDir, 'Layout.wald'),
      [
        '---',
        'const { title, pond } = $$props',
        '---',
        '<!DOCTYPE html>',
        '<html>',
        '<head><title>{title}</title></head>',
        '<body>{pond}</body>',
        '</html>',
      ].join('\n')
    )

    writeFileSync(
      join(pagesDir, 'index.wald'),
      [
        '---',
        `import Layout from '../layouts/Layout.wald'`,
        'const title = "Home"',
        '---',
        '<Layout title={title}>',
        '<h1>Hello</h1>',
        '</Layout>',
      ].join('\n')
    )

    await buildPages(pagesDir, distDir)

    const html = readFileSync(join(distDir, 'index.html'), 'utf8')
    expect(html).toContain('<title>Home</title>')
    expect(html).toContain('<h1>Hello</h1>')
    expect(html).not.toContain('<!DOCTYPE html><!DOCTYPE html>')
  })
```

- [ ] **Stap 2: Verifieer dat de test faalt**

```bash
cd packages/cli && pnpm test -- build
```

Expected: FAIL — de layout import wordt niet gevonden in de `data:` URL context.

- [ ] **Stap 3: Vervang `build.ts` met de recursieve implementatie**

Vervang de volledige inhoud van `packages/cli/src/commands/build.ts`:

```ts
import { mkdirSync, writeFileSync, readFileSync, existsSync, cpSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import { defineCommand } from 'citty'
import ora from 'ora'
import { compile } from '@waldjs/compiler'
import { scanRoutes } from '../router/index.js'
import { maybeWrap } from '../shell.js'

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

async function compileWaldFile(
  filePath: string,
  cache: Map<string, string>,
  runtimeUrl: string,
  contentModuleUrl: string | null,
): Promise<string> {
  if (cache.has(filePath)) return cache.get(filePath)!

  const source = readFileSync(filePath, 'utf8')
  let compiled = compile(source, filePath)

  compiled = compiled.replace(/(['"])@waldjs\/runtime\1/g, JSON.stringify(runtimeUrl))
  if (contentModuleUrl) {
    compiled = compiled.replace(/(['"])wald:content\1/g, JSON.stringify(contentModuleUrl))
  }

  // Recursief: patch .wald imports naar hun eigen data: URLs
  const waldImportRe = /from\s+(['"])(\.\.?\/[^'"]+\.wald)\1/g
  let m: RegExpExecArray | null
  const patches: Array<[string, string]> = []
  while ((m = waldImportRe.exec(compiled)) !== null) {
    const quote = m[1]
    const relPath = m[2]
    const absPath = resolve(dirname(filePath), relPath)
    const depDataUrl = await compileWaldFile(absPath, cache, runtimeUrl, contentModuleUrl)
    patches.push([`from ${quote}${relPath}${quote}`, `from ${JSON.stringify(depDataUrl)}`])
  }
  for (const [from, to] of patches) {
    compiled = compiled.replace(from, to)
  }

  const dataUrl = `data:text/javascript,${encodeURIComponent(compiled)}`
  cache.set(filePath, dataUrl)
  return dataUrl
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
  const cache = new Map<string, string>()

  for (const route of staticRoutes) {
    const dataUrl = await compileWaldFile(route.file, cache, runtimeUrl, contentModuleUrl)
    const mod = await import(dataUrl) as {
      default: { render: (props?: Record<string, unknown>) => Promise<string> }
    }
    const html = maybeWrap(await mod.default.render())
    const outPath = route.pattern === '/'
      ? join(distDir, 'index.html')
      : join(distDir, route.pattern.slice(1), 'index.html')
    mkdirSync(join(outPath, '..'), { recursive: true })
    writeFileSync(outPath, html)
  }

  for (const route of dynamicRoutes) {
    const dataUrl = await compileWaldFile(route.file, cache, runtimeUrl, contentModuleUrl)
    const mod = await import(dataUrl) as {
      default: { render: (props?: Record<string, unknown>) => Promise<string> }
      getStaticPaths?: () => Promise<Array<{ params: Record<string, string> }>>
    }

    if (!mod.getStaticPaths) {
      console.warn(`⚠ Skipping dynamic route ${route.pattern} — no getStaticPaths() export`)
      continue
    }

    const paths = await mod.getStaticPaths()
    for (const { params } of paths) {
      const html = maybeWrap(await mod.default.render(params))
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

- [ ] **Stap 4: Verifieer alle build tests slagen**

```bash
cd packages/cli && pnpm test -- build
```

Expected: 7 tests passing (6 bestaand + 1 nieuw).

- [ ] **Stap 5: Verifieer alle CLI tests slagen**

```bash
cd packages/cli && pnpm test
```

Expected: alle tests slagen.

- [ ] **Stap 6: Commit**

```bash
git add packages/cli/src/commands/build.ts packages/cli/src/commands/build.test.ts
git commit -m "feat(cli): compile .wald imports recursively in wald build, add maybeWrap"
```

---

## Task 5: `wald plant` scaffold uitbreiden

**Files:**
- Modify: `packages/cli/src/commands/plant.ts`
- Modify: `packages/cli/src/commands/plant.test.ts`

- [ ] **Stap 1: Schrijf de falende tests**

Voeg toe aan het einde van de `describe('scaffold', ...)` block in `packages/cli/src/commands/plant.test.ts`:

```ts
  it('creates src/layouts/Layout.wald with pond and full HTML shell', async () => {
    const base = mkdtempSync(join(tmpdir(), 'wald-plant-'))
    const dir = join(base, 'my-forest')
    await scaffold(dir)
    const content = readFileSync(join(dir, 'src', 'layouts', 'Layout.wald'), 'utf8')
    expect(content).toContain('pond')
    expect(content).toContain('<!DOCTYPE html>')
  })

  it('creates src/components/Card.wald with $$props', async () => {
    const base = mkdtempSync(join(tmpdir(), 'wald-plant-'))
    const dir = join(base, 'my-forest')
    await scaffold(dir)
    const content = readFileSync(join(dir, 'src', 'components', 'Card.wald'), 'utf8')
    expect(content).toContain('$$props')
  })
```

- [ ] **Stap 2: Verifieer dat de tests falen**

```bash
cd packages/cli && pnpm test -- plant
```

Expected: FAIL — `src/layouts/Layout.wald` en `src/components/Card.wald` bestaan niet.

- [ ] **Stap 3: Update `scaffold()` in `plant.ts`**

Vervang de volledige inhoud van `packages/cli/src/commands/plant.ts`:

```ts
import { mkdirSync, writeFileSync } from 'node:fs'
import { join, basename } from 'node:path'
import { defineCommand } from 'citty'
import ora from 'ora'

export async function scaffold(targetDir: string): Promise<void> {
  const name = basename(targetDir)

  mkdirSync(join(targetDir, 'src', 'pages', 'blog'), { recursive: true })
  mkdirSync(join(targetDir, 'src', 'layouts'), { recursive: true })
  mkdirSync(join(targetDir, 'src', 'components'), { recursive: true })
  mkdirSync(join(targetDir, 'content', 'blog'), { recursive: true })
  mkdirSync(join(targetDir, 'public'), { recursive: true })

  writeFileSync(
    join(targetDir, 'src', 'layouts', 'Layout.wald'),
    [
      '---',
      'const { title, pond } = $$props',
      '---',
      '<!DOCTYPE html>',
      '<html lang="en">',
      '  <head>',
      '    <meta charset="UTF-8" />',
      '    <meta name="viewport" content="width=device-width" />',
      '    <title>{title}</title>',
      '  </head>',
      '  <body>',
      '    {pond}',
      '  </body>',
      '</html>',
      '',
    ].join('\n')
  )

  writeFileSync(
    join(targetDir, 'src', 'components', 'Card.wald'),
    [
      '---',
      'const { title, body } = $$props',
      '---',
      '<article>',
      '  <h2>{title}</h2>',
      '  <p>{body}</p>',
      '</article>',
      '',
    ].join('\n')
  )

  writeFileSync(
    join(targetDir, 'src', 'pages', 'index.wald'),
    [
      '---',
      "import Layout from '../layouts/Layout.wald'",
      "import Card from '../components/Card.wald'",
      "const title = 'Hello Wald'",
      '---',
      '<Layout title={title}>',
      '  <Card title="Welkom" body="Je eerste WaldJS project." />',
      '</Layout>',
      '',
    ].join('\n')
  )

  writeFileSync(
    join(targetDir, 'src', 'pages', 'blog', 'index.wald'),
    [
      '---',
      "import Layout from '../../layouts/Layout.wald'",
      "import { getCollection } from 'wald:content'",
      "const posts = await getCollection('blog')",
      "const count = posts.length",
      '---',
      "<Layout title='Blog'>",
      '  <h1>Blog</h1>',
      '  <p>Found {count} posts</p>',
      '</Layout>',
      '',
    ].join('\n')
  )

  writeFileSync(
    join(targetDir, 'src', 'pages', 'blog', '[slug].wald'),
    [
      '---',
      "import Layout from '../../layouts/Layout.wald'",
      "import { getCollection, getEntry } from 'wald:content'",
      'export async function getStaticPaths() {',
      "  const posts = await getCollection('blog')",
      '  return posts.map(p => ({ params: { slug: p.slug } }))',
      '}',
      "const post = await getEntry('blog', $$props.slug)",
      '---',
      '<Layout title={post.data.title}>',
      '  <h1>{post.data.title}</h1>',
      '  {post.body}',
      '</Layout>',
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

- [ ] **Stap 4: Verifieer alle plant tests slagen**

```bash
cd packages/cli && pnpm test -- plant
```

Expected: 7 tests passing (5 bestaand + 2 nieuw).

- [ ] **Stap 5: Commit**

```bash
git add packages/cli/src/commands/plant.ts packages/cli/src/commands/plant.test.ts
git commit -m "feat(cli): scaffold Layout.wald, Card.wald and updated index.wald in wald plant"
```

---

## Task 6: Build verificatie

**Files:** geen wijzigingen — alleen verificatie.

- [ ] **Stap 1: Bouw alle packages**

```bash
pnpm build
```

Expected: 4 packages bouwen zonder TypeScript errors.

- [ ] **Stap 2: Draai alle tests**

```bash
pnpm test
```

Expected: alle tests slagen. Totaal verwacht: ~90 tests (83 bestaand + 2 runtime + 3 compiler + 4 shell + 1 build + 2 plant).

- [ ] **Stap 3: Verifieer CLI binary**

```bash
node packages/cli/bin/wald.js --help
```

Expected: help output met `plant | grow | build | preview`.

- [ ] **Stap 4: Commit (alleen als er build artifacts zijn)**

Als `pnpm build` gewijzigde bestanden achterlaat in `dist/`:
```bash
git add packages/*/dist/
git commit -m "chore: rebuild dist after Phase 2b"
```

Anders: geen commit nodig.
