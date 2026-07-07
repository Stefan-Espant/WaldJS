import { mkdirSync, writeFileSync, existsSync, cpSync, rmSync } from 'node:fs'
import { join, relative, dirname, resolve } from 'node:path'
import { defineCommand } from 'citty'
import { build, mergeConfig } from 'vite'
import { waldPlugin } from '../vite-plugin.js'
import { loadWaldConfig, type WaldConfig } from '../config.js'
import { scanRoutes } from '../router/index.js'
import { maybeWrap, hoistScripts } from '../shell.js'
import { runCheck } from './check.js'
import { withGrowingTree } from '../growing-tree.js'

function resolveOutPath(distDir: string, pattern: string, params: Record<string, string> = {}): string {
  let path = pattern
  for (const [key, value] of Object.entries(params)) {
    path = path.replace(`:${key}`, value)
  }
  return pattern === '/'
    ? join(distDir, 'index.html')
    : join(distDir, path.slice(1), 'index.html')
}

function formatSize(bytes: number): string {
  return bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} kB`
}

function logRoute(pattern: string, label: string, padTo: number): void {
  const padded = pattern.padEnd(padTo)
  if (!process.stdout.isTTY) {
    console.log(`  ✓ ${pattern}  ${label}`)
    return
  }
  console.log(`  \x1b[32m✓\x1b[0m ${padded}  \x1b[2m${label}\x1b[0m`)
}

export async function buildPages(
  pagesDir: string,
  config: Required<WaldConfig>,
  publicDir?: string,
  contentDir?: string,
): Promise<{ routeCount: number; ms: number; bytes: number }> {
  const start = Date.now()
  const distDir = config.outDir
  const routes = scanRoutes(pagesDir)
  const staticRoutes = routes.filter(r => r.params.length === 0)
  const dynamicRoutes = routes.filter(r => r.params.length > 0)
  const padTo = Math.max(...routes.map(r => r.pattern.length), 0)

  const ssrDir = join(dirname(distDir), '.wald-ssr')

  const input = Object.fromEntries(
    routes.map(r => [relative(pagesDir, r.file).replace(/\.wald$/, ''), r.file]),
  )

  // Pass 1 — Bundle all .wald pages into an SSR build.
  // config.vite goes first so WaldJS required settings in second arg always win
  // (prevents user from accidentally overriding ssr: true or outDir).
  await withGrowingTree('Compiling...', build(mergeConfig(
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
  )))

  let routeCount = 0
  let totalBytes = 0
  try {
    // Pass 2 — Pre-render each static route to an HTML file.
    for (const route of staticRoutes) {
      const key = relative(pagesDir, route.file).replace(/\.wald$/, '')
      const modulePath = resolve(join(ssrDir, key + '.js'))
      const mod = await import(modulePath) as {
        default: { render: (props?: Record<string, unknown>) => Promise<string> }
      }
      const html = hoistScripts(maybeWrap(await mod.default.render()))
      const outPath = resolveOutPath(distDir, route.pattern)
      mkdirSync(dirname(outPath), { recursive: true })
      writeFileSync(outPath, html)
      routeCount++
      const bytes = Buffer.byteLength(html)
      totalBytes += bytes
      logRoute(route.pattern, formatSize(bytes), padTo)
    }

    // Dynamic routes are logged once per pattern (not per generated path) —
    // a content-heavy getStaticPaths() could produce hundreds of pages, and
    // printing every single one would drown out the rest of the build output.
    for (const route of dynamicRoutes) {
      const key = relative(pagesDir, route.file).replace(/\.wald$/, '')
      const modulePath = resolve(join(ssrDir, key + '.js'))

      const mod = await import(modulePath) as {
        default: { render: (props?: Record<string, unknown>) => Promise<string> }
        getStaticPaths?: () => Promise<Array<{ params: Record<string, string> }>>
      }

      if (!mod.getStaticPaths) {
        console.warn(`⚠ Skipping dynamic route ${route.pattern} — no getStaticPaths() export`)
        continue
      }

      const paths = await mod.getStaticPaths()
      let patternBytes = 0
      for (const { params } of paths) {
        const html = hoistScripts(maybeWrap(await mod.default.render(params)))
        const outPath = resolveOutPath(distDir, route.pattern, params)
        mkdirSync(dirname(outPath), { recursive: true })
        writeFileSync(outPath, html)
        routeCount++
        patternBytes += Buffer.byteLength(html)
      }
      totalBytes += patternBytes
      const pathWord = paths.length === 1 ? 'path' : 'paths'
      logRoute(route.pattern, `${paths.length} ${pathWord}, ${formatSize(patternBytes)}`, padTo)
    }
  } finally {
    rmSync(ssrDir, { recursive: true, force: true })
  }

  if (publicDir && existsSync(publicDir)) {
    cpSync(publicDir, distDir, { recursive: true })
  }

  return { routeCount, ms: Date.now() - start, bytes: totalBytes }
}

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

    try {
      const { routeCount, ms, bytes } = await buildPages(pagesDir, config, publicDir, contentDir)
      const pageWord = routeCount === 1 ? 'page' : 'pages'
      console.log(`\n✔ ${routeCount} ${pageWord} (${formatSize(bytes)}) built in ${ms}ms → ${config.outDir}/`)
    } catch (e) {
      console.error(`✖ Build failed: ${e}`)
      throw e
    }
  },
})
