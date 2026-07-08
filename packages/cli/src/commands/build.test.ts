import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import { tmpdir } from 'node:os'
import type { WaldConfig } from '../config.js'
import { runCheck } from './check.js'

// Mock vite.build() — simulates what Vite SSR would do by compiling .wald files
// with the same data: URL technique as the old pipeline, writing wrapper modules
// to the SSR output dir so the pre-render step can import them.
vi.mock('vite', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vite')>()
  return {
    ...actual,
    build: vi.fn(async (cfg: any) => {
      const { compile } = await import('@waldjs/compiler')
      const { readFileSync: fsRead, writeFileSync: fsWrite, mkdirSync: fsMkdir } = await import('node:fs')
      const { join: pJoin, dirname: pDirname, resolve: pResolve } = await import('node:path')

      if (cfg.build.ssr === false) {
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

vi.mock('./check.js', () => ({
  runCheck: vi.fn(),
}))

import { buildPages, buildCommand, formatBuildSummary } from './build.js'

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

  it('returns build stats for summary output', async () => {
    const pagesDir = join(tmpDir, 'src', 'pages')
    const distDir = join(tmpDir, 'dist')
    mkdirSync(pagesDir, { recursive: true })
    writeFileSync(join(pagesDir, 'index.wald'), '<p>home</p>')

    const stats = await buildPages(pagesDir, makeConfig(distDir))

    expect(stats.staticRoutes).toBe(1)
    expect(stats.dynamicRoutes).toBe(0)
    expect(stats.dynamicPages).toBe(0)
    expect(stats.warnings).toEqual([])
    expect(stats.canopyEntries).toBe(0)
    expect(stats.copiedPublic).toBe(false)
    expect(stats.copiedAssets).toBe(false)
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

  it('skips dynamic routes without throwing', async () => {
    const pagesDir = join(tmpDir, 'src', 'pages')
    const distDir = join(tmpDir, 'dist')
    mkdirSync(join(pagesDir, 'blog'), { recursive: true })
    writeFileSync(join(pagesDir, 'blog', '[slug].wald'), '<h1>Post</h1>')

    await buildPages(pagesDir, makeConfig(distDir))

    expect(existsSync(join(distDir, 'blog', '[slug]', 'index.html'))).toBe(false)
  })

  it('reports warnings through the reporter instead of printing inline', async () => {
    const pagesDir = join(tmpDir, 'src', 'pages')
    const distDir = join(tmpDir, 'dist')
    mkdirSync(join(pagesDir, 'blog'), { recursive: true })
    writeFileSync(join(pagesDir, 'blog', '[slug].wald'), '<h1>Post</h1>')

    const reported: string[] = []
    const stats = await buildPages(pagesDir, makeConfig(distDir), undefined, undefined, {
      onWarning(warning) {
        reported.push(warning)
      },
    })

    expect(reported).toContain('Skipping dynamic route /blog/:slug — no getStaticPaths() export')
    expect(stats.warnings).toContain('Skipping dynamic route /blog/:slug — no getStaticPaths() export')
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

  it('copies src/assets/ to dist/assets/ when it exists', async () => {
    const pagesDir = join(tmpDir, 'src', 'pages')
    const assetsDir = join(tmpDir, 'src', 'assets', 'js')
    const distDir = join(tmpDir, 'dist')
    mkdirSync(pagesDir, { recursive: true })
    mkdirSync(assetsDir, { recursive: true })
    writeFileSync(join(pagesDir, 'index.wald'), '<p>home</p>')
    writeFileSync(join(assetsDir, 'site.js'), 'console.log("site")')

    const stats = await buildPages(pagesDir, makeConfig(distDir))

    expect(existsSync(join(distDir, 'assets', 'js', 'site.js'))).toBe(true)
    expect(stats.copiedAssets).toBe(true)
  })

  it('renders a static route that uses getCollection from wald:content', async () => {
    const pagesDir = join(tmpDir, 'src', 'pages')
    const distDir = join(tmpDir, 'dist')
    const contentDir = join(tmpDir, 'content')

    mkdirSync(join(pagesDir, 'blog'), { recursive: true })
    mkdirSync(join(contentDir, 'blog'), { recursive: true })
    writeFileSync(join(contentDir, 'blog', 'one.md'), '---\ntitle: One\n---\nBody')
    writeFileSync(join(contentDir, 'blog', 'two.md'), '---\ntitle: Two\n---\nBody')

    writeFileSync(
      join(pagesDir, 'blog', 'index.wald'),
      [
        '---',
        "import { getCollection } from 'wald:content'",
        "const posts = await getCollection('blog')",
        "const count = posts.length",
        '---',
        '<p>Found {count} posts</p>',
      ].join('\n')
    )

    await buildPages(pagesDir, makeConfig(distDir), undefined, contentDir)

    const html = readFileSync(join(distDir, 'blog', 'index.html'), 'utf8')
    expect(html).toContain('<p>Found 2 posts</p>')
  })

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

    await buildPages(pagesDir, makeConfig(distDir))

    const html = readFileSync(join(distDir, 'index.html'), 'utf8')
    expect(html).toContain('<title>Home</title>')
    expect(html).toContain('<h1>Hello</h1>')
    expect(html).not.toContain('<!DOCTYPE html><!DOCTYPE html>')
  })

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
        "  const posts = await getCollection('blog')",
        '  return posts.map(p => ({ params: { slug: p.slug } }))',
        '}',
        "const post = await getEntry('blog', $$props.slug)",
        '---',
        '<h1>{post.data.title}</h1>',
      ].join('\n')
    )

    await buildPages(pagesDir, makeConfig(distDir), undefined, contentDir)

    expect(readFileSync(join(distDir, 'blog', 'hello', 'index.html'), 'utf8')).toContain('<h1>Hello</h1>')
    expect(readFileSync(join(distDir, 'blog', 'world', 'index.html'), 'utf8')).toContain('<h1>World</h1>')
  })

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

    await buildPages(pagesDir, makeConfig(distDir))

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

    await buildPages(pagesDir, makeConfig(distDir))

    const html = readFileSync(join(distDir, 'index.html'), 'utf8')
    expect((html.match(/<script>/g) ?? []).length).toBe(1)
  })

  it('removes .wald-ssr temp dir after build', async () => {
    const pagesDir = join(tmpDir, 'src', 'pages')
    const distDir = join(tmpDir, 'dist')
    mkdirSync(pagesDir, { recursive: true })
    writeFileSync(join(pagesDir, 'index.wald'), '<p>hi</p>')

    await buildPages(pagesDir, makeConfig(distDir))

    expect(existsSync(join(tmpDir, '.wald-ssr'))).toBe(false)
  })

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
        'const { initial } = $$props',
        '---',
        '<button>{initial}</button>',
        '<script>export default function(root) { root.dataset.ready = "yes" }</script>',
      ].join('\n')
    )

    writeFileSync(
      join(pagesDir, 'index.wald'),
      ["---", "import Counter from '../components/Counter.wald'", '---', '<Counter canopy:load initial={3} />'].join('\n')
    )

    await buildPages(pagesDir, makeConfig(distDir))

    const html = readFileSync(join(distDir, 'index.html'), 'utf8')
    expect(html).not.toContain('wald:canopy:Counter')
    expect(html).toContain('data-src="/assets/counter-testhash.js"')
    expect(html).toContain('<script type="module" src="/assets/wald-canopy-testhash.js"></script>')
  })

  it('does not hoist the inline script of a component used with canopy', async () => {
    const pagesDir = join(tmpDir, 'src', 'pages')
    const componentsDir = join(tmpDir, 'src', 'components')
    const distDir = join(tmpDir, 'dist')
    mkdirSync(pagesDir, { recursive: true })
    mkdirSync(componentsDir, { recursive: true })

    writeFileSync(
      join(componentsDir, 'Counter.wald'),
      [
        '---',
        'const { initial } = $$props',
        '---',
        '<button>{initial}</button>',
        '<script>export default function(root) { root.dataset.ready = "yes" }</script>',
      ].join('\n')
    )

    writeFileSync(
      join(pagesDir, 'index.wald'),
      ["---", "import Counter from '../components/Counter.wald'", '---', '<Counter canopy:load initial={3} />'].join('\n')
    )

    await buildPages(pagesDir, makeConfig(distDir))

    const html = readFileSync(join(distDir, 'index.html'), 'utf8')
    expect(html).not.toContain('export default function(root) { root.dataset.ready = "yes" }')
  })

  it('does not inject the canopy runtime script when no page uses canopy', async () => {
    const pagesDir = join(tmpDir, 'src', 'pages')
    const distDir = join(tmpDir, 'dist')
    mkdirSync(pagesDir, { recursive: true })
    writeFileSync(join(pagesDir, 'index.wald'), '<p>Hello</p>')

    await buildPages(pagesDir, makeConfig(distDir))

    const html = readFileSync(join(distDir, 'index.html'), 'utf8')
    expect(html).not.toContain('wald-canopy')
    expect(html).not.toContain('<script type="module" src="/assets/wald-canopy-testhash.js"></script>')
  })
})

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
    try {
      await (buildCommand.run as Function)({ args: {} })
    } catch {
      // real build may fail, but we only care that runCheck was not called
    }
    expect(runCheck).not.toHaveBeenCalled()
  })
})

describe('formatBuildSummary', () => {
  it('renders compact summary lines', () => {
    expect(formatBuildSummary({
      staticRoutes: 2,
      dynamicRoutes: 1,
      dynamicPages: 3,
      warnings: ['one'],
      canopyEntries: 4,
      copiedPublic: true,
      copiedAssets: true,
    }, 'dist')).toEqual([
      '  Output:   dist/',
      '  Pages:    2 static routes',
      '  Dynamic:  1 route -> 3 pages',
      '  Canopy:   4 canopies',
      '  Warnings: 1',
    ])
  })
})
