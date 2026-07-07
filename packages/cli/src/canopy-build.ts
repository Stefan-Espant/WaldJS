import { build, mergeConfig, type Plugin, type UserConfig } from 'vite'
import { waldPlugin } from './vite-plugin.js'

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

function joinUrl(base: string, fileName: string): string {
  return `${base.replace(/\/$/, '')}/${fileName}`
}

export async function buildCanopyClient(
  entries: Map<string, string>,
  distDir: string,
  base: string,
  viteConfig: UserConfig | undefined,
): Promise<CanopyAssetMap> {
  const assetMap: CanopyAssetMap = new Map()
  if (entries.size === 0) return assetMap

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
        rollupOptions: { input },
      },
    } as any,
  ))

  return assetMap
}
