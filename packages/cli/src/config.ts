import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { rmSync, writeFileSync } from 'node:fs'
import type { UserConfig } from 'vite'
import { staticAdapter, type WaldAdapter } from './adapters.js'

export interface WaldConfig {
  outDir?: string
  base?: string
  vite?: UserConfig
  adapter?: WaldAdapter
  /** Add <meta name="generator" content="WaldJS v…"> to pages that don't declare one. Default true. */
  generator?: boolean
}

export function defineConfig(config: WaldConfig): WaldConfig {
  return config
}

const DEFAULTS: Required<WaldConfig> = {
  outDir: 'dist',
  base: '/',
  vite: {},
  adapter: staticAdapter(),
  generator: true,
}

export async function loadWaldConfig(root = process.cwd()): Promise<Required<WaldConfig>> {
  const configFile = join(root, 'wald.config.ts')
  if (!existsSync(configFile)) return { ...DEFAULTS }

  const config = await importConfigFile(configFile, root)
  if (!config) return { ...DEFAULTS }
  const merged = { ...DEFAULTS, ...config }
  if (merged.adapter?.outDir) merged.outDir = merged.adapter.outDir
  return merged
}

// Bundles wald.config.ts with esbuild (packages stay external) into a temporary
// .mjs next to it and imports that: the same thing Vite's loadConfigFromFile
// does, without loading Vite (~100 ms) for every build. Falls back to Vite's
// loader if this fails.
async function importConfigFile(configFile: string, root: string): Promise<WaldConfig | undefined> {
  try {
    const { build } = await import('esbuild')
    const result = await build({
      entryPoints: [configFile],
      bundle: true,
      write: false,
      platform: 'node',
      format: 'esm',
      target: 'node18',
      packages: 'external',
      logLevel: 'silent',
    })
    const tempFile = `${configFile}.timestamp-${Date.now()}-${process.pid}.mjs`
    writeFileSync(tempFile, result.outputFiles[0].text)
    try {
      const mod = await import(pathToFileURL(tempFile).href)
      const exported = mod.default
      return typeof exported === 'function'
        ? await exported({ command: 'build', mode: 'production' })
        : exported
    } finally {
      rmSync(tempFile, { force: true })
    }
  } catch {
    const { loadConfigFromFile } = await import('vite')
    const result = await loadConfigFromFile({ command: 'build', mode: 'production' }, configFile, root)
    return result?.config as WaldConfig | undefined
  }
}

