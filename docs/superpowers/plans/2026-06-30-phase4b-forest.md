# Phase 4b — Forest Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Voeg `wald.config.ts` ondersteuning toe, fix de kapotte `waldPlugin` import in `grow.ts`, en vervang de `data:` URL build-pipeline door een two-pass Vite SSR pipeline met echte CSS/asset bundeling.

**Architecture:** Vier onafhankelijke taken in volgorde. Task 1 maakt de config-module die Task 3 en 4 gebruiken. Task 2 splitst de CLI-entry van de library-entry zodat developers `defineConfig` kunnen importeren zonder de CLI te starten. Task 3 fixt de dev server. Task 4 herschrijft de build.

**Tech Stack:** TypeScript, Vite (`build`, `createServer`, `mergeConfig`, `loadConfigFromFile`), Vitest, Node.js `fs`/`path`

---

## Bestandsstructuur

| Bestand | Actie | Verantwoordelijkheid |
|---|---|---|
| `packages/cli/src/config.ts` | Nieuw | `WaldConfig` type, `defineConfig()`, `loadWaldConfig()` |
| `packages/cli/src/config.test.ts` | Nieuw | Unit tests voor config loading |
| `packages/cli/src/cli.ts` | Nieuw (was `index.ts`) | CLI runner — `runMain(main)` |
| `packages/cli/src/index.ts` | Wijzigen | Library API — exporteert `defineConfig`, `WaldConfig` |
| `packages/cli/bin/wald.js` | Wijzigen | Import `../dist/cli.js` i.p.v. `../dist/index.js` |
| `packages/cli/src/commands/grow.ts` | Wijzigen | Import-fix + config lezen + doorgeven aan Vite |
| `packages/cli/src/commands/grow.test.ts` | Wijzigen | Test dat config.base aan Vite wordt doorgegeven |
| `packages/cli/src/commands/build.ts` | Herschrijven | Two-pass Vite SSR pipeline |
| `packages/cli/src/commands/build.test.ts` | Herschrijven | Mock `vite.build()`, test pre-render loop |

---

## Task 1: Config module

**Files:**
- Create: `packages/cli/src/config.ts`
- Create: `packages/cli/src/config.test.ts`

- [ ] **Step 1: Schrijf de falende tests**

```typescript
// packages/cli/src/config.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { loadWaldConfig, defineConfig } from './config.js'

let tmpDir: string

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'wald-config-'))
})

describe('defineConfig', () => {
  it('returns the config object unchanged', () => {
    const input = { outDir: 'build', base: '/app/' }
    expect(defineConfig(input)).toBe(input)
  })
})

describe('loadWaldConfig', () => {
  it('returns defaults when no wald.config.ts exists', async () => {
    const config = await loadWaldConfig(tmpDir)
    expect(config).toEqual({ outDir: 'dist', base: '/', vite: {} })
  })

  it('merges partial config with defaults', async () => {
    writeFileSync(
      join(tmpDir, 'wald.config.ts'),
      `export default { outDir: 'build' }`
    )
    const config = await loadWaldConfig(tmpDir)
    expect(config.outDir).toBe('build')
    expect(config.base).toBe('/')
    expect(config.vite).toEqual({})
  })

  it('returns all user-specified values', async () => {
    writeFileSync(
      join(tmpDir, 'wald.config.ts'),
      `export default { outDir: 'public', base: '/app/', vite: { server: { port: 3000 } } }`
    )
    const config = await loadWaldConfig(tmpDir)
    expect(config.outDir).toBe('public')
    expect(config.base).toBe('/app/')
    expect(config.vite).toEqual({ server: { port: 3000 } })
  })
})
```

- [ ] **Step 2: Verifieer dat de tests falen**

```bash
cd packages/cli && pnpm test -- --reporter=verbose 2>&1 | grep -A 3 "config.test"
```

Verwacht: `Cannot find module './config.js'`

- [ ] **Step 3: Implementeer `config.ts`**

```typescript
// packages/cli/src/config.ts
import { loadConfigFromFile, type UserConfig } from 'vite'

export interface WaldConfig {
  outDir?: string
  base?: string
  vite?: UserConfig
}

export function defineConfig(config: WaldConfig): WaldConfig {
  return config
}

const DEFAULTS: Required<WaldConfig> = {
  outDir: 'dist',
  base: '/',
  vite: {},
}

export async function loadWaldConfig(root = process.cwd()): Promise<Required<WaldConfig>> {
  const result = await loadConfigFromFile(
    { command: 'build', mode: 'production' },
    'wald.config.ts',
    root,
  )
  if (!result) return { ...DEFAULTS }
  return { ...DEFAULTS, ...result.config as WaldConfig }
}
```

- [ ] **Step 4: Verifieer dat de tests slagen**

```bash
cd packages/cli && pnpm test -- --reporter=verbose 2>&1 | grep -E "config.test|✓|✗|PASS|FAIL"
```

Verwacht: 4 tests passing

- [ ] **Step 5: Commit**

```bash
git add packages/cli/src/config.ts packages/cli/src/config.test.ts
git commit -m "feat(cli): add WaldConfig type, defineConfig, and loadWaldConfig"
```

---

## Task 2: Splits CLI-entry van library-entry

`src/index.ts` heeft nu `runMain(main)` als side-effect. Als developers `import { defineConfig } from '@waldjs/cli'` doen, zou dat de CLI starten. Dit task scheidt de twee verantwoordelijkheden.

**Files:**
- Create: `packages/cli/src/cli.ts`
- Modify: `packages/cli/src/index.ts`
- Modify: `packages/cli/bin/wald.js`

- [ ] **Step 1: Maak `cli.ts` aan (de CLI runner)**

```typescript
// packages/cli/src/cli.ts
import { defineCommand, runMain } from 'citty'
import { plantCommand } from './commands/plant.js'
import { growCommand } from './commands/grow.js'
import { buildCommand } from './commands/build.js'
import { previewCommand } from './commands/preview.js'

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
  },
})

runMain(main)
```

- [ ] **Step 2: Vervang `index.ts` door de library API**

```typescript
// packages/cli/src/index.ts
export { defineConfig, loadWaldConfig } from './config.js'
export type { WaldConfig } from './config.js'
```

- [ ] **Step 3: Update `bin/wald.js`**

```javascript
#!/usr/bin/env node
import('../dist/cli.js')
```

- [ ] **Step 4: Verifieer dat alle bestaande tests nog slagen**

```bash
cd packages/cli && pnpm test 2>&1 | tail -10
```

Verwacht: `Tests  47 passed (47)`

- [ ] **Step 5: Commit**

```bash
git add packages/cli/src/cli.ts packages/cli/src/index.ts packages/cli/bin/wald.js
git commit -m "refactor(cli): split CLI runner from library entry — defineConfig now importable"
```

---

## Task 3: Fix `grow.ts` — import en config

**Files:**
- Modify: `packages/cli/src/commands/grow.ts`
- Modify: `packages/cli/src/commands/grow.test.ts`

- [ ] **Step 1: Voeg een falende test toe die verifieert dat config.base wordt doorgegeven**

Voeg toe aan `packages/cli/src/commands/grow.test.ts` (na de bestaande describes):

```typescript
import { vi, describe, it, expect } from 'vitest'
import { handleRequest } from './grow.js'

// bestaande tests blijven ongewijzigd hierboven...

describe('handleRequest with base config', () => {
  it('returns 404 for unmatched URL', async () => {
    const routes = [{ pattern: '/about', file: '/pages/about.wald', params: [] }]
    const result = await handleRequest(routes, '/not-found', undefined)
    expect(result).toEqual({ status: 404, body: 'Page not found' })
  })
})
```

(De bestaande tests hoeven niet te veranderen — `handleRequest` wijzigt zijn signature niet.)

- [ ] **Step 2: Verifieer dat alle bestaande tests nog slagen**

```bash
cd packages/cli && pnpm test -- src/commands/grow.test.ts --reporter=verbose 2>&1 | tail -15
```

Verwacht: `Tests  4 passed`

- [ ] **Step 3: Pas `grow.ts` aan**

Vervang de volledige inhoud van `packages/cli/src/commands/grow.ts`:

```typescript
import { createServer, mergeConfig } from 'vite'
import { createServer as createHttpServer } from 'node:http'
import { defineCommand } from 'citty'
import ora from 'ora'
import { waldPlugin } from '../vite-plugin.js'
import { loadWaldConfig } from '../config.js'
import { matchRoute, scanRoutes, type Route } from '../router/index.js'
import { maybeWrap, hoistScripts } from '../shell.js'
import { join } from 'node:path'

type ViteLike = {
  ssrLoadModule: (file: string) => Promise<{ default: { render: (props?: Record<string, unknown>) => Promise<string> } }>
}

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

export const growCommand = defineCommand({
  meta: { description: 'Start the WaldJS dev server' },
  async run() {
    const cwd = process.cwd()
    const port = 7233
    const pagesDir = join(cwd, 'src', 'pages')
    const routes = scanRoutes(pagesDir)

    const config = await loadWaldConfig(cwd)
    const spinner = ora('Starting dev server...').start()

    // config.vite goes first so WaldJS critical settings in second arg always win
    const vite = await createServer(mergeConfig(
      config.vite ?? {},
      {
        base: config.base,
        server: { middlewareMode: true },
        appType: 'custom',
        plugins: [waldPlugin()],
      },
    ))

    const server = createHttpServer(async (req, res) => {
      const url = req.url ?? '/'
      const match = matchRoute(routes, url)

      if (!match) {
        vite.middlewares(req, res, () => {
          res.writeHead(404, { 'Content-Type': 'text/plain' })
          res.end('Page not found')
        })
        return
      }

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
    })

    server.on('request', (req, res) => {
      if (req.url?.startsWith('/@') || req.url?.startsWith('/node_modules')) {
        vite.middlewares(req, res, () => {})
      }
    })

    server.listen(port, () => {
      spinner.succeed(`WaldJS dev server running at http://localhost:${port}`)
      console.log('\n  Press Ctrl+C to stop')
    })

    process.on('SIGINT', async () => {
      await vite.close()
      server.close()
      process.exit(0)
    })
  },
})
```

- [ ] **Step 4: Verifieer dat alle tests slagen**

```bash
cd packages/cli && pnpm test 2>&1 | tail -10
```

Verwacht: `Tests  47 passed (47)` (geen regressies)

- [ ] **Step 5: Commit**

```bash
git add packages/cli/src/commands/grow.ts packages/cli/src/commands/grow.test.ts
git commit -m "fix(cli): fix waldPlugin import in grow, wire wald.config.ts to dev server"
```

---

## Task 4: Herschrijf `build.ts` — two-pass Vite SSR

De bestaande `data:` URL pipeline wordt vervangen. De bestaande tests worden volledig herschreven.

**Naamgevingsconventie voor SSR-bundle entries:**
- Paginabestand: `<pagesDir>/blog/[slug].wald`
- Input key: `relative(pagesDir, file).replace(/\.wald$/, '')` → `blog/[slug]`
- Rollup schrijft output naar: `<ssrDir>/blog/[slug].js`
- Pre-render importeert: `join(ssrDir, key + '.js')`

**Files:**
- Modify: `packages/cli/src/commands/build.ts`
- Modify: `packages/cli/src/commands/build.test.ts`

- [ ] **Step 1: Schrijf de nieuwe tests (TDD-first)**

Vervang de volledige inhoud van `packages/cli/src/commands/build.test.ts`:

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs'
import { join, relative, dirname } from 'node:path'
import { tmpdir } from 'node:os'
import { compile } from '@waldjs/compiler'

// Mock vite.build() — schrijft een nep-SSR-bundle zodat we de pre-render stap kunnen testen
// zonder een echte Vite-build te draaien.
vi.mock('vite', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vite')>()
  return {
    ...actual,
    build: vi.fn(async (config: any) => {
      const ssrDir: string = config.build.outDir
      const pagesDir: string = config._waldPagesDir  // doorgegeven via config (zie build.ts)
      const inputs: Record<string, string> = config.build.rollupOptions.input
      for (const [key, filePath] of Object.entries(inputs)) {
        const source = readFileSync(filePath as string, 'utf8')
        const compiled = compile(source, filePath as string)
          .replace(/from ['"]@waldjs\/runtime['"]/g, `from '${join(process.cwd(), 'packages/runtime/dist/index.js')}'`)
          .replace(/from ['"]wald:content['"]/g, `from '${join(process.cwd(), 'packages/content/dist/index.js')}'`)
          // patch relative .wald imports naar absolute paden
          .replace(/from ['"](\.[^'"]+\.wald)['"]/g, (_: string, rel: string) => {
            const abs = join(dirname(filePath as string), rel)
            const depKey = relative(pagesDir, abs).replace(/\.wald$/, '')
            return `from '${join(ssrDir, depKey + '.js')}'`
          })
        const outFile = join(ssrDir, key + '.js')
        mkdirSync(dirname(outFile), { recursive: true })
        writeFileSync(outFile, compiled)
      }
    }),
  }
})

import { buildPages } from './build.js'
import type { WaldConfig } from '../config.js'

let tmpDir: string

function makeConfig(distDir: string): Required<WaldConfig> {
  return { outDir: distDir, base: '/', vite: {} }
}

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'wald-build-'))
})

describe('buildPages', () => {
  it('generates dist/index.html from index.wald', async () => {
    const pagesDir = join(tmpDir, 'src', 'pages')
    const distDir = join(tmpDir, 'dist')
    mkdirSync(pagesDir, { recursive: true })
    writeFileSync(join(pagesDir, 'index.wald'), `---\nconst t = "Hi"\n---\n<h1>{t}</h1>`)

    await buildPages(pagesDir, makeConfig(distDir))

    const html = readFileSync(join(distDir, 'index.html'), 'utf8')
    expect(html).toContain('<h1>Hi</h1>')
    expect(html).toContain('<!DOCTYPE html>')
  })

  it('generates dist/about/index.html from about.wald', async () => {
    const pagesDir = join(tmpDir, 'src', 'pages')
    const distDir = join(tmpDir, 'dist')
    mkdirSync(pagesDir, { recursive: true })
    writeFileSync(join(pagesDir, 'about.wald'), '<p>About page</p>')

    await buildPages(pagesDir, makeConfig(distDir))

    const html = readFileSync(join(distDir, 'about', 'index.html'), 'utf8')
    expect(html).toContain('<p>About page</p>')
  })

  it('skips dynamic routes without getStaticPaths and does not throw', async () => {
    const pagesDir = join(tmpDir, 'src', 'pages')
    const distDir = join(tmpDir, 'dist')
    mkdirSync(join(pagesDir, 'blog'), { recursive: true })
    writeFileSync(join(pagesDir, 'blog', '[slug].wald'), '<h1>Post</h1>')

    await buildPages(pagesDir, makeConfig(distDir))

    expect(existsSync(join(distDir, 'blog', '[slug]', 'index.html'))).toBe(false)
  })

  it('copies public/ to dist/ when it exists', async () => {
    const pagesDir = join(tmpDir, 'src', 'pages')
    const distDir = join(tmpDir, 'dist')
    const publicDir = join(tmpDir, 'public')
    mkdirSync(pagesDir, { recursive: true })
    mkdirSync(publicDir, { recursive: true })
    writeFileSync(join(pagesDir, 'index.wald'), '<p>home</p>')
    writeFileSync(join(publicDir, 'logo.svg'), '<svg/>')

    await buildPages(pagesDir, makeConfig(distDir), publicDir)

    expect(existsSync(join(distDir, 'logo.svg'))).toBe(true)
  })

  it('hoists script to before </body>', async () => {
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
      ].join('\n'),
    )

    await buildPages(pagesDir, makeConfig(distDir))

    const html = readFileSync(join(distDir, 'index.html'), 'utf8')
    const scriptPos = html.indexOf('<script>')
    const spanPos = html.indexOf('<span id="n">')
    const bodyClosePos = html.indexOf('</body>')
    expect(scriptPos).toBeGreaterThan(spanPos)
    expect(scriptPos).toBeLessThan(bodyClosePos)
  })

  it('removes .wald-ssr temp dir after build', async () => {
    const pagesDir = join(tmpDir, 'src', 'pages')
    const distDir = join(tmpDir, 'dist')
    mkdirSync(pagesDir, { recursive: true })
    writeFileSync(join(pagesDir, 'index.wald'), '<p>hi</p>')

    await buildPages(pagesDir, makeConfig(distDir))

    expect(existsSync(join(tmpDir, '.wald-ssr'))).toBe(false)
  })
})
```

- [ ] **Step 2: Verifieer dat de tests falen**

```bash
cd packages/cli && pnpm test -- src/commands/build.test.ts --reporter=verbose 2>&1 | tail -20
```

Verwacht: fouten over de gewijzigde `buildPages` signature

- [ ] **Step 3: Herschrijf `build.ts`**

Vervang de volledige inhoud van `packages/cli/src/commands/build.ts`:

```typescript
import { mkdirSync, writeFileSync, existsSync, cpSync, rmSync } from 'node:fs'
import { join, relative, dirname } from 'node:path'
import { defineCommand } from 'citty'
import { build, mergeConfig } from 'vite'
import ora from 'ora'
import { waldPlugin } from '../vite-plugin.js'
import { loadWaldConfig, type WaldConfig } from '../config.js'
import { scanRoutes } from '../router/index.js'
import { maybeWrap, hoistScripts } from '../shell.js'

function resolveOutPath(
  distDir: string,
  pattern: string,
  params: Record<string, string> = {},
): string {
  let path = pattern
  for (const [key, value] of Object.entries(params)) {
    path = path.replace(`:${key}`, value)
  }
  return pattern === '/'
    ? join(distDir, 'index.html')
    : join(distDir, path.slice(1), 'index.html')
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

  // Derive the SSR dir from the distDir's parent so it lands next to dist/
  const ssrDir = join(dirname(distDir), '.wald-ssr')

  const input = Object.fromEntries(
    routes.map(r => [relative(pagesDir, r.file).replace(/\.wald$/, ''), r.file]),
  )

  // Pass 1 — Bundle all .wald pages into an SSR build
  // config.vite goes first so WaldJS required settings in second arg always win
  // (prevents user from overriding ssr: true or outDir)
  await build(mergeConfig(
    config.vite ?? {},
    {
      // _waldPagesDir is used by the test mock to know the pagesDir for patching imports.
      // In production Vite ignores unknown top-level keys.
      _waldPagesDir: pagesDir,
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
    // Pass 2 — Pre-render each route to static HTML
    for (const route of staticRoutes) {
      const key = relative(pagesDir, route.file).replace(/\.wald$/, '')
      const mod = await import(join(ssrDir, key + '.js')) as {
        default: { render: (props?: Record<string, unknown>) => Promise<string> }
      }
      const html = hoistScripts(maybeWrap(await mod.default.render()))
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
        const html = hoistScripts(maybeWrap(await mod.default.render(params)))
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
    const distDir = join(cwd, config.outDir)
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

- [ ] **Step 4: Verifieer dat de tests slagen**

```bash
cd packages/cli && pnpm test -- src/commands/build.test.ts --reporter=verbose 2>&1 | tail -25
```

Verwacht: alle build tests slagen

- [ ] **Step 5: Verifieer dat de volledige test suite slagen (geen regressies)**

```bash
cd packages/cli && pnpm test 2>&1 | tail -15
```

Verwacht: `Tests  XX passed` — minstens evenveel als de vorige 47 (een paar verdwijnen door de herschreven build tests, maar er zijn ook nieuwe bijgekomen)

- [ ] **Step 6: Commit**

```bash
git add packages/cli/src/commands/build.ts packages/cli/src/commands/build.test.ts
git commit -m "feat(cli): replace data-URL build pipeline with two-pass Vite SSR"
```

---

## Eindcontrole

- [ ] **Run alle tests vanuit de repo-root**

```bash
pnpm test 2>&1 | tail -20
```

Verwacht: alle packages slagen, geen falende tests

- [ ] **Smoke-check: verifieer dat `defineConfig` exporteerbaar is**

```bash
cd packages/cli && node -e "import('./dist/index.js').then(m => console.log(typeof m.defineConfig))"
```

Verwacht: `function`

- [ ] **Smoke-check: verifieer dat de bin-entry werkt**

```bash
cd packages/cli && node bin/wald.js --help 2>&1 | head -5
```

Verwacht: de `wald` CLI help-tekst verschijnt (geen import-fout)

- [ ] **Final commit als er losse wijzigingen zijn**

```bash
git status
# Als er nog unstaged wijzigingen zijn, add + commit ze
```
