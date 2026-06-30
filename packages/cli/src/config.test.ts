import { describe, it, expect, beforeEach } from 'vitest'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { loadWaldConfig, defineConfig } from './config.js'

let tmpDir: string

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'wald-config-'))
})

describe('defineConfig', () => {
  it('returns the config object unchanged', () => {
    const input = { outDir: 'build', base: '/app/' }
    expect(defineConfig(input)).toBe(input)
  })
})

describe('loadWaldConfig', () => {
  it('returns defaults when no wald.config.ts exists', async () => {
    const config = await loadWaldConfig(tmpDir)
    expect(config).toEqual({ outDir: 'dist', base: '/', vite: {} })
  })

  it('merges partial config with defaults', async () => {
    writeFileSync(
      join(tmpDir, 'wald.config.ts'),
      `export default { outDir: 'build' }`
    )
    const config = await loadWaldConfig(tmpDir)
    expect(config.outDir).toBe('build')
    expect(config.base).toBe('/')
    expect(config.vite).toEqual({})
  })

  it('returns all user-specified values', async () => {
    writeFileSync(
      join(tmpDir, 'wald.config.ts'),
      `export default { outDir: 'public', base: '/app/', vite: { server: { port: 3000 } } }`
    )
    const config = await loadWaldConfig(tmpDir)
    expect(config.outDir).toBe('public')
    expect(config.base).toBe('/app/')
    expect(config.vite).toEqual({ server: { port: 3000 } })
  })
})
