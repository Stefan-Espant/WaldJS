import { readFileSync, readdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import type { UserConfig } from 'vite'
import { compile } from '@waldjs/compiler'
import { WALD_GENERATOR } from './version.js'
import {
  WALD_RUNTIME_PACKAGES,
  contentModuleSource,
  imageModuleSource,
  resolveWaldPackage,
  type WaldImageOptions,
} from './wald-modules.js'

// The SSR bundle only has to turn .wald pages into modules that Node imports
// right after, in the same process. esbuild does that in a fraction of Vite's
// startup + build time, so `wald build` uses it whenever the result is
// guaranteed to be the same; anything that needs Vite's own semantics keeps
// the Vite pipeline (and a failed esbuild run falls back to Vite too).

// Vite-only features: env replacement, glob imports and query-suffixed imports.
const VITE_ONLY_SYNTAX = /import\.meta\.(env|glob|hot)\b|['"][^'"\n]+\?(raw|url|inline|worker|sharedworker)['"]/
const SOURCE_FILE = /\.(wald|ts|mts|js|mjs)$/

export function canBundleSsrWithEsbuild(vite: UserConfig | undefined, srcDir: string): boolean {
  if (process.env.WALD_SSR_BUNDLER === 'vite') return false
  // Any Vite option (plugins, resolve.alias, define, ...) can change what the
  // SSR bundle contains. Only ssr.external is safe: this path leaves every
  // package external anyway, exactly like an npm-installed project under Vite.
  const config = (vite ?? {}) as Record<string, unknown>
  if (Object.keys(config).some(key => key !== 'ssr')) return false
  const ssr = (config.ssr ?? {}) as Record<string, unknown>
  if (Object.keys(ssr).some(key => key !== 'external')) return false
  return !usesViteOnlySyntax(srcDir)
}

function usesViteOnlySyntax(dir: string): boolean {
  let entries
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch {
    return false
  }
  for (const entry of entries) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules' && usesViteOnlySyntax(full)) return true
    } else if (SOURCE_FILE.test(entry.name) && VITE_ONLY_SYNTAX.test(readFileSync(full, 'utf8'))) {
      return true
    }
  }
  return false
}

export async function bundleSsrWithEsbuild(
  input: Record<string, string>,
  outDir: string,
  cwd: string,
  image: WaldImageOptions | undefined,
): Promise<void> {
  const { build } = await import('esbuild')
  rmSync(outDir, { recursive: true, force: true })
  await build({
    entryPoints: input,
    outdir: outDir,
    bundle: true,
    splitting: true,
    format: 'esm',
    platform: 'node',
    target: 'node18',
    // Bare imports stay runtime imports, as Vite does for installed packages.
    packages: 'external',
    logLevel: 'silent',
    plugins: [{
      name: 'wald',
      setup(b) {
        // Same resolution as the Vite plugin: the runtime packages come from
        // the CLI's own install, so pnpm projects that only depend on
        // @waldjs/cli still find them.
        b.onResolve({ filter: /^@waldjs\/(runtime|content|canopy)$/ }, args => {
          if (!WALD_RUNTIME_PACKAGES.has(args.path)) return undefined
          const resolved = resolveWaldPackage(args.path)
          return resolved ? { path: pathToFileURL(resolved).href, external: true } : undefined
        })
        b.onResolve({ filter: /^wald:(content|image)$/ }, args => ({ path: args.path, namespace: 'wald-virtual' }))
        b.onLoad({ filter: /.*/, namespace: 'wald-virtual' }, args => ({
          contents: args.path === 'wald:content' ? contentModuleSource(cwd) : imageModuleSource(cwd, image),
          loader: 'js',
          resolveDir: cwd,
        }))
        b.onLoad({ filter: /\.wald$/ }, args => ({
          contents: compile(readFileSync(args.path, 'utf8'), args.path, { generator: WALD_GENERATOR }),
          loader: 'ts',
        }))
      },
    }],
  })
}
