import { mkdirSync, writeFileSync, readFileSync, existsSync, cpSync } from 'node:fs'
import { join } from 'node:path'
import { defineCommand } from 'citty'
import ora from 'ora'
import { compile } from '@waldjs/compiler'
import { scanRoutes } from '../router/index.js'
import { wrapHtml } from '../shell.js'

function resolveRuntimeUrl(): string {
  // Resolve relative to this file so it works in both Node.js (import.meta.url) and
  // Vitest's SSR mode (where import.meta.resolve is not a function).
  // From src/commands/build.ts or dist/commands/build.js the relative path is the same.
  return new URL('../../node_modules/@waldjs/runtime/dist/index.js', import.meta.url).href
}

export async function buildPages(pagesDir: string, distDir: string, publicDir?: string): Promise<void> {
  const routes = scanRoutes(pagesDir)
  const staticRoutes = routes.filter(r => r.params.length === 0)
  const dynamicRoutes = routes.filter(r => r.params.length > 0)

  for (const r of dynamicRoutes) {
    console.warn(`⚠ Skipping dynamic route ${r.pattern} — add getStaticPaths() in Phase 2`)
  }

  const runtimeUrl = resolveRuntimeUrl()

  for (const route of staticRoutes) {
    const source = readFileSync(route.file, 'utf8')
    const jsModule = compile(source, route.file)
    const patched = jsModule.replace("'@waldjs/runtime'", JSON.stringify(runtimeUrl))
    const mod = await import(`data:text/javascript,${encodeURIComponent(patched)}`) as {
      default: { render: (props?: Record<string, unknown>) => Promise<string> }
    }
    const content = await mod.default.render()
    const html = wrapHtml(content)

    const outPath =
      route.pattern === '/'
        ? join(distDir, 'index.html')
        : join(distDir, route.pattern.slice(1), 'index.html')

    mkdirSync(join(outPath, '..'), { recursive: true })
    writeFileSync(outPath, html)
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

    const spinner = ora('Building your forest...').start()
    try {
      await buildPages(pagesDir, distDir, publicDir)
      spinner.succeed('Build complete → dist/')
    } catch (e) {
      spinner.fail(`Build failed: ${e}`)
      throw e
    }
  },
})
