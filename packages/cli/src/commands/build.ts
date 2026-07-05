import { mkdirSync, writeFileSync, existsSync, cpSync, rmSync } from 'node:fs'
import { join, relative, dirname, resolve } from 'node:path'
import { defineCommand } from 'citty'
import ora from 'ora'
import { build, mergeConfig } from 'vite'
import { waldPlugin } from '../vite-plugin.js'
import { loadWaldConfig, type WaldConfig } from '../config.js'
import { scanRoutes } from '../router/index.js'
import { maybeWrap, hoistScripts } from '../shell.js'

function resolveOutPath(distDir: string, pattern: string, params: Record<string, string> = {}): string {
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

  const ssrDir = join(dirname(distDir), '.wald-ssr')

  const input = Object.fromEntries(
    routes.map(r => [relative(pagesDir, r.file).replace(/\.wald$/, ''), r.file]),
  )

  // Pass 1 — Bundle all .wald pages into an SSR build.
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
      const modulePath = resolve(join(ssrDir, key + '.js'))
      const mod = await import(modulePath) as {
        default: { render: (props?: Record<string, unknown>) => Promise<string> }
      }
      const html = hoistScripts(maybeWrap(await mod.default.render()))
      const outPath = resolveOutPath(distDir, route.pattern)
      mkdirSync(dirname(outPath), { recursive: true })
      writeFileSync(outPath, html)
    }

    for (const route of dynamicRoutes) {
      const key = relative(pagesDir, route.file).replace(/\.wald$/, '')
      const modulePath = resolve(join(ssrDir, key + '.js'))

      // Check if module file exists
      if (!existsSync(modulePath)) {
        console.warn(`⚠ Skipping dynamic route ${route.pattern} — module not generated`)
        continue
      }

      let mod: {
        default: { render: (props?: Record<string, unknown>) => Promise<string> }
        getStaticPaths?: () => Promise<Array<{ params: Record<string, string> }>>
      }
      try {
        mod = await import(modulePath) as any
      } catch (e) {
        console.warn(`⚠ Skipping dynamic route ${route.pattern} — failed to load module: ${e instanceof Error ? e.message : String(e)}`)
        continue
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
