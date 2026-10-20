import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

// Helpers shared by the Vite plugin and the esbuild SSR path. Kept free of any
// `vite` import: loading Vite costs ~100 ms, which `wald build` only pays when
// it actually needs Vite.

export type WaldImageOptions = { outDir: string; publicPath: string }

export const WALD_RUNTIME_PACKAGES = new Set(['@waldjs/runtime', '@waldjs/content', '@waldjs/canopy'])

// Compiled .wald files unconditionally import from '@waldjs/runtime' (and
// pages using content collections import '@waldjs/content'), but a freshly
// scaffolded project has no node_modules of its own until `npm install`
// runs — and even then, hoisting isn't guaranteed to land these at the
// project root. The CLI always ships with its own copies of these packages
// as its own dependencies, so resolve them relative to the CLI's install
// location instead of assuming anything about the target project's layout.
// Mirrors checker.ts's resolveRuntimeTypes() walk for the same reason.
export function resolveWaldPackage(pkgId: string): string | undefined {
  const name = pkgId.split('/')[1]
  let dir = dirname(fileURLToPath(import.meta.url))
  while (true) {
    const candidate = join(dir, 'node_modules', '@waldjs', name, 'dist', 'index.js')
    if (existsSync(candidate)) return candidate
    const parent = dirname(dir)
    if (parent === dir) return undefined
    dir = parent
  }
}

// Source of the `wald:content` and `wald:image` virtual modules. Shared with
// the esbuild SSR path (ssr-esbuild.ts) so both bundlers emit the same code.
export function contentModuleSource(cwd: string): string {
  const contentDir = JSON.stringify(join(cwd, 'content'))
  return [
    `import { readCollection as _rc, readEntry as _re, readTranslations as _rt } from '@waldjs/content'`,
    `const contentDir = ${contentDir}`,
    `export const getCollection = (name, options) => _rc(name, contentDir, options)`,
    `export const getEntry = (collection, slug, options) => _re(collection, slug, contentDir, options)`,
    `export const getTranslations = (collection, slug) => _rt(collection, slug, contentDir)`,
  ].join('\n')
}

export function imageModuleSource(cwd: string, image: WaldImageOptions | undefined): string {
  const context = JSON.stringify({
    assetsDir: join(cwd, 'src', 'assets'),
    outDir: image?.outDir,
    publicPath: image?.publicPath ?? '/assets/optimized',
  })
  return [
    `import { createTree } from '@waldjs/runtime'`,
    `import { renderImage } from '@waldjs/cli'`,
    `const $$imageContext = ${context}`,
    `export const Image = createTree(async ($$result, $$props) => renderImage($$props, $$imageContext))`,
  ].join('\n')
}
