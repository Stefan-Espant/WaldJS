import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { githubPagesAdapter, denoDeployAdapter, oesterAdapter, type WaldAdapterContext } from './adapters.js'

let tmpDir: string

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'wald-adapters-'))
})

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true })
})

function makeContext(outDir: string, overrides: Partial<WaldAdapterContext> = {}): WaldAdapterContext {
  return {
    rootDir: tmpDir,
    outDir,
    outDirRelative: 'dist',
    base: '/',
    staticRoutes: 1,
    dynamicRoutes: 0,
    dynamicPages: 0,
    canopyEntries: 0,
    ...overrides,
  }
}

describe('githubPagesAdapter', () => {
  it('writes an empty .nojekyll file', async () => {
    const outDir = join(tmpDir, 'dist')
    mkdirSync(outDir, { recursive: true })

    await githubPagesAdapter().adapt?.(makeContext(outDir))

    expect(existsSync(join(outDir, '.nojekyll'))).toBe(true)
    expect(readFileSync(join(outDir, '.nojekyll'), 'utf8')).toBe('')
  })

  it('copies index.html to 404.html when index.html exists', async () => {
    const outDir = join(tmpDir, 'dist')
    mkdirSync(outDir, { recursive: true })
    writeFileSync(join(outDir, 'index.html'), '<h1>Home</h1>')

    await githubPagesAdapter().adapt?.(makeContext(outDir))

    expect(readFileSync(join(outDir, '404.html'), 'utf8')).toBe('<h1>Home</h1>')
  })

  it('does not write a 404.html when index.html is absent', async () => {
    const outDir = join(tmpDir, 'dist')
    mkdirSync(outDir, { recursive: true })

    await githubPagesAdapter().adapt?.(makeContext(outDir))

    expect(existsSync(join(outDir, '404.html'))).toBe(false)
  })

  it('produces the same output regardless of base', async () => {
    const outDir = join(tmpDir, 'dist')
    mkdirSync(outDir, { recursive: true })
    writeFileSync(join(outDir, 'index.html'), '<h1>Home</h1>')

    await githubPagesAdapter().adapt?.(makeContext(outDir, { base: '/my-repo/' }))

    expect(existsSync(join(outDir, '.nojekyll'))).toBe(true)
    expect(readFileSync(join(outDir, '404.html'), 'utf8')).toBe('<h1>Home</h1>')
  })

  it('does not overwrite an existing 404.html', async () => {
    const outDir = join(tmpDir, 'dist')
    mkdirSync(outDir, { recursive: true })
    writeFileSync(join(outDir, 'index.html'), '<h1>Home</h1>')
    writeFileSync(join(outDir, '404.html'), '<h1>Custom 404</h1>')

    await githubPagesAdapter().adapt?.(makeContext(outDir))

    expect(readFileSync(join(outDir, '404.html'), 'utf8')).toBe('<h1>Custom 404</h1>')
  })
})

describe('denoDeployAdapter', () => {
  it('has the expected name and no adapt hook', () => {
    const adapter = denoDeployAdapter()
    expect(adapter.name).toBe('deno-deploy')
    expect(adapter.adapt).toBeUndefined()
  })
})

describe('oesterAdapter', () => {
  it('builds into the client directory of the Oester build output', () => {
    const adapter = oesterAdapter()
    expect(adapter.name).toBe('oester')
    expect(adapter.outDir).toBe('.oester/output/client')
  })

  it('writes a manifest that serves the built files and caches assets for a year', async () => {
    const outDir = join(tmpDir, '.oester', 'output', 'client')
    mkdirSync(outDir, { recursive: true })

    await oesterAdapter().adapt?.(makeContext(outDir, { outDirRelative: '.oester/output/client' }))

    const manifest = JSON.parse(readFileSync(join(tmpDir, '.oester', 'output', 'manifest.json'), 'utf8'))
    expect(manifest).toEqual({
      version: 2,
      framework: { name: 'wald' },
      routes: [],
      redirects: [],
      headers: [
        { path: '/assets/*', headers: { 'cache-control': 'public, max-age=31536000, immutable' } },
      ],
    })
  })

  it('tells Oester the base, which serves the build under it', async () => {
    const outDir = join(tmpDir, '.oester', 'output', 'client')
    mkdirSync(outDir, { recursive: true })
    writeFileSync(join(outDir, 'index.html'), '<h1>Home</h1>')

    await oesterAdapter().adapt?.(makeContext(outDir, { base: '/docs/' }))

    const manifest = JSON.parse(readFileSync(join(tmpDir, '.oester', 'output', 'manifest.json'), 'utf8'))
    expect(manifest).toEqual({
      version: 2,
      framework: { name: 'wald' },
      base: '/docs/',
      routes: [],
      redirects: [],
      headers: [
        { path: '/assets/*', headers: { 'cache-control': 'public, max-age=31536000, immutable' } },
      ],
    })
    expect(readFileSync(join(outDir, 'index.html'), 'utf8')).toBe('<h1>Home</h1>')
  })

  it('leaves the base out for an empty base, which the build treats as the root', async () => {
    const outDir = join(tmpDir, '.oester', 'output', 'client')
    mkdirSync(outDir, { recursive: true })

    await oesterAdapter().adapt?.(makeContext(outDir, { base: '' }))

    const manifest = JSON.parse(readFileSync(join(tmpDir, '.oester', 'output', 'manifest.json'), 'utf8'))
    expect(manifest).not.toHaveProperty('base')
  })
})
