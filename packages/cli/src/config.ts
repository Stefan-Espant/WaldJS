import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { loadConfigFromFile, type UserConfig } from 'vite'
import { staticAdapter, type WaldAdapter } from './adapters.js'

export interface WaldConfig {
  outDir?: string
  base?: string
  vite?: UserConfig
  adapter?: WaldAdapter
}

export function defineConfig(config: WaldConfig): WaldConfig {
  return config
}

const DEFAULTS: Required<WaldConfig> = {
  outDir: 'dist',
  base: '/',
  vite: {},
  adapter: staticAdapter(),
}

export async function loadWaldConfig(root = process.cwd()): Promise<Required<WaldConfig>> {
  const configFile = join(root, 'wald.config.ts')
  if (!existsSync(configFile)) return { ...DEFAULTS }

  const result = await loadConfigFromFile(
    { command: 'build', mode: 'production' },
    configFile,
    root,
  )
  if (!result) return { ...DEFAULTS }
  const merged = { ...DEFAULTS, ...(result.config as WaldConfig) }
  if (merged.adapter?.outDir) merged.outDir = merged.adapter.outDir
  return merged
}
