import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { execFileSync } from 'node:child_process'

describe('build-sitemap.mjs', () => {
  let root: string

  beforeAll(() => {
    root = mkdtempSync(join(tmpdir(), 'wald-sitemap-'))
    mkdirSync(join(root, 'src/pages/blog'), { recursive: true })
    writeFileSync(join(root, 'src/pages/index.wald'), '<h1>home</h1>')
    writeFileSync(join(root, 'src/pages/about.wald'), '<h1>about</h1>')
    writeFileSync(join(root, 'src/pages/blog/index.wald'), '<h1>blog</h1>')
    writeFileSync(join(root, 'src/pages/blog/[slug].wald'), '<h1>post</h1>')
    writeFileSync(join(root, 'src/pages/foo&bar.wald'), '<h1>special chars</h1>')
    mkdirSync(join(root, 'dist'), { recursive: true })
    execFileSync(
      process.execPath,
      [join(__dirname, 'build-sitemap.mjs'), root, 'https://example.com'],
      { stdio: 'pipe' },
    )
  })

  afterAll(() => {
    rmSync(root, { recursive: true, force: true })
  })

  it('writes dist/sitemap.xml', () => {
    const xml = readFileSync(join(root, 'dist/sitemap.xml'), 'utf-8')
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true)
  })

  it('includes one <loc> per route, index files collapsed to their directory', () => {
    const xml = readFileSync(join(root, 'dist/sitemap.xml'), 'utf-8')
    expect(xml).toContain('<loc>https://example.com/</loc>')
    expect(xml).toContain('<loc>https://example.com/about</loc>')
    expect(xml).toContain('<loc>https://example.com/blog</loc>')
  })

  it('does not include a trailing slash on non-root routes', () => {
    const xml = readFileSync(join(root, 'dist/sitemap.xml'), 'utf-8')
    expect(xml).not.toContain('<loc>https://example.com/about/</loc>')
  })

  it('excludes dynamic [param] routes, which have no single known URL', () => {
    const xml = readFileSync(join(root, 'dist/sitemap.xml'), 'utf-8')
    expect(xml).not.toContain('[slug]')
    expect(xml).not.toContain('<loc>https://example.com/blog/:slug</loc>')
  })

  it('XML-escapes special characters in route URLs', () => {
    const xml = readFileSync(join(root, 'dist/sitemap.xml'), 'utf-8')
    expect(xml).toContain('<loc>https://example.com/foo&amp;bar</loc>')
    expect(xml).not.toContain('<loc>https://example.com/foo&bar</loc>')
  })
})
