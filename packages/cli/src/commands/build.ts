import { mkdirSync, writeFileSync, readFileSync, existsSync, cpSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import { defineCommand } from 'citty'
import ora from 'ora'
import { compile } from '@waldjs/compiler'
import { scanRoutes } from '../router/index.js'
import { maybeWrap, hoistScripts } from '../shell.js'

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

  // Recursively patch .wald imports to their own data: URLs
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
    const html = hoistScripts(maybeWrap(await mod.default.render()))
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
      const html = hoistScripts(maybeWrap(await mod.default.render(params)))
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
