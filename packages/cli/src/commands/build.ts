import { mkdirSync, writeFileSync, existsSync, cpSync, rmSync } from 'node:fs'
import { join, relative, dirname, resolve } from 'node:path'
import { defineCommand } from 'citty'
import { build, mergeConfig } from 'vite'
import { buildCanopyClient, type CanopyAssetMap } from '../canopy-build.js'
import { collectCanopyScriptContents, scanCanopyEntries } from '../canopy-scan.js'
import { waldPlugin } from '../vite-plugin.js'
import { loadWaldConfig, type WaldConfig } from '../config.js'
import { scanRoutes } from '../router/index.js'
import { maybeWrap, hoistScripts } from '../shell.js'
import { withGrowingTree } from '../growing-tree.js'
import { runCheck } from './check.js'

export type BuildPhase =
  | 'Scanning routes'
  | 'Scanning canopies'
  | 'Bundling canopy client'
  | 'Bundling SSR pages'
  | 'Rendering static pages'
  | 'Rendering dynamic pages'
  | 'Copying public assets'
  | 'Copying source assets'
  | 'Applying adapter'

export type BuildStats = {
  staticRoutes: number
  dynamicRoutes: number
  dynamicPages: number
  warnings: string[]
  canopyEntries: number
  copiedPublic: boolean
  copiedAssets: boolean
  adapterName: string
}

type BuildReporter = {
  onPhase?: (phase: BuildPhase) => void
  onWarning?: (warning: string) => void
}

function createBuildLogger() {
  let lastPhase: BuildPhase | undefined
  return {
    start() {
      console.log('Building...')
    },
    phase(phase: BuildPhase) {
      if (phase === lastPhase) return
      lastPhase = phase
      console.log(`  ${phase}`)
    },
    success() {
      console.log('Build complete')
    },
    fail(error: unknown) {
      console.error(`Build failed: ${error}`)
    },
  }
}

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
  reporter: BuildReporter = {},
): Promise<BuildStats> {
  const rootDir = resolve(pagesDir, '..', '..')
  const distDir = resolve(rootDir, config.outDir)
  reporter.onPhase?.('Scanning routes')
  const routes = scanRoutes(pagesDir)
  const staticRoutes = routes.filter(r => r.params.length === 0)
  const dynamicRoutes = routes.filter(r => r.params.length > 0)
  const padTo = Math.max(...routes.map(r => r.pattern.length), 0)
  const warnings: string[] = []
  let dynamicPages = 0

  const ssrDir = join(dirname(distDir), '.wald-ssr')

  const input = Object.fromEntries(
    routes.map(r => [relative(pagesDir, r.file).replace(/\.wald$/, ''), r.file]),
  )

  const srcDir = dirname(pagesDir)
  const assetsDir = join(srcDir, 'assets')
  reporter.onPhase?.('Scanning canopies')
  const { entries: canopyEntries, warnings: canopyWarnings } = scanCanopyEntries(srcDir)
  for (const warning of canopyWarnings) {
    warnings.push(warning)
    reporter.onWarning?.(warning)
  }
  const canopyScriptContents = collectCanopyScriptContents(canopyEntries)
  reporter.onPhase?.('Bundling canopy client')
  const canopyAssets = await buildCanopyClient(canopyEntries, distDir, config.base, config.vite)

  reporter.onPhase?.('Bundling SSR pages')
  const ssrResult = await withGrowingTree('Bundling SSR pages...', build(mergeConfig(
    config.vite ?? {},
    {
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

  const entryFileNames = new Map<string, string>()
  const ssrOutputs = Array.isArray(ssrResult) ? ssrResult : [ssrResult]
  for (const result of ssrOutputs) {
    if (!result) continue
    for (const chunk of (result as any).output ?? []) {
      if (chunk.type === 'chunk' && chunk.isEntry && chunk.facadeModuleId) {
        entryFileNames.set(resolve(chunk.facadeModuleId), chunk.fileName)
      }
    }
  }

  const resolveModulePath = (routeFile: string, key: string) =>
    resolve(join(ssrDir, entryFileNames.get(resolve(routeFile)) ?? key + '.js'))

  try {
    reporter.onPhase?.('Rendering static pages')
    for (const route of staticRoutes) {
      const key = relative(pagesDir, route.file).replace(/\.wald$/, '')
      const modulePath = resolveModulePath(route.file, key)
      const mod = await import(modulePath) as {
        default: { render: (props?: Record<string, unknown>) => Promise<string> }
      }
      const rendered = stripCanopyScripts(await mod.default.render(), canopyScriptContents)
      const html = applyCanopyAssets(hoistScripts(maybeWrap(rendered)), canopyAssets)
      const outPath = resolveOutPath(distDir, route.pattern)
      mkdirSync(dirname(outPath), { recursive: true })
      writeFileSync(outPath, html)
      logRoute(route.pattern, formatSize(Buffer.byteLength(html)), padTo)
    }

    reporter.onPhase?.('Rendering dynamic pages')
    for (const route of dynamicRoutes) {
      const key = relative(pagesDir, route.file).replace(/\.wald$/, '')
      const modulePath = resolveModulePath(route.file, key)

      const mod = await import(modulePath) as {
        default: { render: (props?: Record<string, unknown>) => Promise<string> }
        getStaticPaths?: () => Promise<Array<{ params: Record<string, string> }>>
      }

      if (!mod.getStaticPaths) {
        const warning = `Skipping dynamic route ${route.pattern} — no getStaticPaths() export`
        warnings.push(warning)
        reporter.onWarning?.(warning)
        continue
      }

      const paths = await mod.getStaticPaths()
      let patternBytes = 0
      for (const { params } of paths) {
        dynamicPages++
        const rendered = stripCanopyScripts(await mod.default.render(params), canopyScriptContents)
        const html = applyCanopyAssets(hoistScripts(maybeWrap(rendered)), canopyAssets)
        const outPath = resolveOutPath(distDir, route.pattern, params)
        mkdirSync(dirname(outPath), { recursive: true })
        writeFileSync(outPath, html)
        patternBytes += Buffer.byteLength(html)
      }
      const pathWord = paths.length === 1 ? 'path' : 'paths'
      logRoute(route.pattern, `${paths.length} ${pathWord}, ${formatSize(patternBytes)}`, padTo)
    }
  } finally {
    rmSync(ssrDir, { recursive: true, force: true })
  }

  let copiedPublic = false
  if (publicDir && existsSync(publicDir)) {
    reporter.onPhase?.('Copying public assets')
    cpSync(publicDir, distDir, { recursive: true })
    copiedPublic = true
  }

  let copiedAssets = false
  if (existsSync(assetsDir)) {
    reporter.onPhase?.('Copying source assets')
    cpSync(assetsDir, join(distDir, 'assets'), { recursive: true })
    copiedAssets = true
  }

  reporter.onPhase?.('Applying adapter')
  await config.adapter.adapt?.({
    rootDir,
    outDir: distDir,
    outDirRelative: config.outDir,
    base: config.base,
    staticRoutes: staticRoutes.length,
    dynamicRoutes: dynamicRoutes.length,
    dynamicPages,
    canopyEntries: canopyEntries.size,
  })

  return {
    staticRoutes: staticRoutes.length,
    dynamicRoutes: dynamicRoutes.length,
    dynamicPages,
    warnings,
    canopyEntries: canopyEntries.size,
    copiedPublic,
    copiedAssets,
    adapterName: config.adapter.name,
  }
}

function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`
}

export function formatBuildSummary(stats: BuildStats, outDir: string): string[] {
  return [
    `  Output:   ${outDir}/`,
    `  Pages:    ${pluralize(stats.staticRoutes, 'static route')}`,
    `  Dynamic:  ${pluralize(stats.dynamicRoutes, 'route')} -> ${pluralize(stats.dynamicPages, 'page')}`,
    `  Canopy:   ${pluralize(stats.canopyEntries, 'canopy', 'canopies')}`,
    `  Adapter:  ${stats.adapterName}`,
    `  Warnings: ${stats.warnings.length}`,
  ]
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

    const logger = createBuildLogger()
    logger.start()
    const warnings: string[] = []
    try {
      const stats = await buildPages(pagesDir, config, publicDir, contentDir, {
        onPhase(phase) {
          logger.phase(phase)
        },
        onWarning(warning) {
          warnings.push(warning)
        },
      })
      logger.success()
      for (const line of formatBuildSummary(stats, config.outDir)) {
        console.log(line)
      }
      if (warnings.length > 0) {
        console.log('\nWarnings:')
        for (const warning of warnings) {
          console.log(`  - ${warning}`)
        }
      }
    } catch (e) {
      logger.fail(e)
      throw e
    }
  },
})
