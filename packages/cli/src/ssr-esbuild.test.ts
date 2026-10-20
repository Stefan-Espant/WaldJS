import { describe, it, expect, afterEach } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { canBundleSsrWithEsbuild } from './ssr-esbuild.js'

function srcWith(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), 'wald-ssr-choice-'))
  for (const [rel, content] of Object.entries(files)) {
    mkdirSync(join(dir, rel, '..'), { recursive: true })
    writeFileSync(join(dir, rel), content)
  }
  return dir
}

describe('canBundleSsrWithEsbuild', () => {
  afterEach(() => { delete process.env.WALD_SSR_BUNDLER })

  it('allows a plain project and one with only ssr.external', () => {
    const src = srcWith({ 'pages/index.wald': '---\n---\n<h1>x</h1>' })
    expect(canBundleSsrWithEsbuild({}, src)).toBe(true)
    expect(canBundleSsrWithEsbuild({ ssr: { external: ['a'] } }, src)).toBe(true)
  })

  it.each([
    ['plugins', { plugins: [] }],
    ['resolve.alias', { resolve: { alias: {} } }],
    ['define', { define: {} }],
    ['ssr.noExternal', { ssr: { noExternal: ['a'] } }],
  ])('refuses Vite option %s', (_name, vite) => {
    expect(canBundleSsrWithEsbuild(vite as any, srcWith({ 'pages/index.wald': '' }))).toBe(false)
  })

  it.each([
    ['import.meta.env', 'const m = import.meta.env.MODE'],
    ['import.meta.glob', "const posts = import.meta.glob('./*.md')"],
    ['?raw import', "import svg from './logo.svg?raw'"],
    ['?url import', "import u from './a.png?url'"],
  ])('refuses source using %s', (_name, code) => {
    expect(canBundleSsrWithEsbuild({}, srcWith({ 'lib/x.ts': code }))).toBe(false)
  })

  it('ignores node_modules inside src and honours WALD_SSR_BUNDLER=vite', () => {
    const src = srcWith({ 'node_modules/dep/index.js': 'import.meta.env', 'pages/index.wald': '' })
    expect(canBundleSsrWithEsbuild({}, src)).toBe(true)
    process.env.WALD_SSR_BUNDLER = 'vite'
    expect(canBundleSsrWithEsbuild({}, src)).toBe(false)
  })
})
