import { readFileSync } from 'node:fs'
import { dirname, relative, resolve } from 'node:path'
import type { Plugin, UserConfig } from 'vite'
import { parse, type ScriptNode } from '@waldjs/compiler'
import { resolveWaldPackage } from './wald-modules.js'

export type CanopyAssetMap = Map<string, string>

export function captureCanopyAssets(assetMap: CanopyAssetMap, base: string): Plugin {
  return {
    name: 'wald-canopy-asset-map',
    generateBundle(_options, bundle) {
      for (const chunk of Object.values(bundle)) {
        if (chunk.type === 'chunk' && chunk.isEntry && chunk.name) {
          assetMap.set(chunk.name, joinUrl(base, chunk.fileName))
        }
      }
    },
  }
}

export function joinUrl(base: string, fileName: string): string {
  return `${base.replace(/\/$/, '')}/${fileName}`
}

export async function buildCanopyClient(
  entries: Map<string, string>,
  distDir: string,
  base: string,
  viteConfig: UserConfig | undefined,
  { useEsbuild = false }: { useEsbuild?: boolean } = {},
): Promise<CanopyAssetMap> {
  const assetMap: CanopyAssetMap = new Map()
  if (entries.size === 0) return assetMap

  if (useEsbuild) {
    try {
      return await buildCanopyClientWithEsbuild(entries, distDir, base)
    } catch {
      assetMap.clear() // fall back to the Vite pipeline below
    }
  }

  // Vite is only loaded when there is something to bundle (~100 ms to import).
  const { build, mergeConfig } = await import('vite')
  const { waldPlugin } = await import('./vite-plugin.js')

  const input: Record<string, string> = { 'wald-canopy': '@waldjs/canopy' }
  for (const [name, file] of entries) {
    input[name] = `${file}?canopy-script`
  }

  await build(mergeConfig(
    viteConfig ?? {},
    {
      base,
      plugins: [...waldPlugin(), captureCanopyAssets(assetMap, base)],
      build: {
        ssr: false,
        outDir: distDir,
        emptyOutDir: false,
        // gzip sizes are only printed, never used; skip computing them.
        reportCompressedSize: false,
        rollupOptions: {
          input,
          preserveEntrySignatures: 'exports-only',
        },
      },
    } as any,
  ))

  return assetMap
}

// Vite's default browser targets for production builds ('modules').
const BROWSER_TARGETS = ['es2020', 'edge88', 'firefox78', 'chrome87', 'safari14']
const CANOPY_SUFFIX = '?canopy-script'

// Same output as the Vite pipeline (minified ES modules named
// assets/<name>-<hash>.js, the canopy runtime plus one entry per island),
// produced by esbuild without loading Vite. Used under the same conditions as
// the esbuild SSR path (see ssr-esbuild.ts).
async function buildCanopyClientWithEsbuild(
  entries: Map<string, string>,
  distDir: string,
  base: string,
): Promise<CanopyAssetMap> {
  const { build } = await import('esbuild')
  const runtime = resolveWaldPackage('@waldjs/canopy')
  if (!runtime) throw new Error('@waldjs/canopy not found')

  const entryPoints: Record<string, string> = { 'wald-canopy': runtime }
  for (const [name, file] of entries) entryPoints[name] = file + CANOPY_SUFFIX

  const result = await build({
    entryPoints,
    outdir: distDir,
    entryNames: 'assets/[name]-[hash]',
    chunkNames: 'assets/[name]-[hash]',
    bundle: true,
    splitting: true,
    format: 'esm',
    platform: 'browser',
    target: BROWSER_TARGETS,
    minify: true,
    metafile: true,
    logLevel: 'silent',
    plugins: [{
      name: 'wald-canopy-script',
      setup(b) {
        b.onResolve({ filter: /\.wald\?canopy-script$/ }, args => ({ path: args.path, namespace: 'canopy-script' }))
        b.onLoad({ filter: /.*/, namespace: 'canopy-script' }, args => {
          const file = args.path.slice(0, -CANOPY_SUFFIX.length)
          const ast = parse(readFileSync(file, 'utf8'))
          const script = ast.template.find((node): node is ScriptNode => node.type === 'script')
          const contents = script
            ? script.content.replace(/^<script[^>]*>/, '').replace(/<\/script>$/, '')
            : 'export default function() {}'
          return { contents, loader: 'ts', resolveDir: dirname(file) }
        })
        b.onResolve({ filter: /^@waldjs\/(runtime|canopy)$/ }, args => {
          const resolved = resolveWaldPackage(args.path)
          return resolved ? { path: resolved } : undefined
        })
      },
    }],
  })

  const assetMap: CanopyAssetMap = new Map()
  const names = Object.keys(entryPoints)
  for (const [outPath, output] of Object.entries(result.metafile.outputs)) {
    if (!output.entryPoint || !outPath.endsWith('.js')) continue
    const fileName = relative(distDir, resolve(outPath)).split('\\').join('/')
    const name = names.find(n => new RegExp(`^assets/${n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}-[A-Z0-9]+\\.js$`).test(fileName))
    if (name) assetMap.set(name, joinUrl(base, fileName))
  }
  if (assetMap.size !== names.length) throw new Error('canopy asset map incomplete')
  return assetMap
}

