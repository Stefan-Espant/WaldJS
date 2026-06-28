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
    let patched = jsModule.replace(/(['"])@waldjs\/runtime\1/g, JSON.stringify(runtimeUrl))
    if (contentModuleUrl) {
      patched = patched.replace(/(['"])wald:content\1/g, JSON.stringify(contentModuleUrl))
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
