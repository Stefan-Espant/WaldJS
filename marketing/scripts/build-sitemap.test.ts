import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { execFileSync } from 'node:child_process'

describe('build-sitemap.mjs', () => {
  let root: string

  beforeAll(() => {
    root = mkdtempSync(join(tmpdir(), 'wald-sitemap-'))
    // Simulate a built dist/ directory — this script now runs AFTER wald
    // build, scanning real output, not src/pages/ source files.
    mkdirSync(join(root, 'dist/about'), { recursive: true })
    mkdirSync(join(root, 'dist/changelog/roots'), { recursive: true })
    mkdirSync(join(root, 'dist/changelog/forest-polish'), { recursive: true })
    writeFileSync(join(root, 'dist/index.html'), '<h1>home</h1>')
    writeFileSync(join(root, 'dist/about/index.html'), '<h1>about</h1>')
    writeFileSync(join(root, 'dist/changelog/roots/index.html'), '<h1>roots</h1>')
    writeFileSync(join(root, 'dist/changelog/forest-polish/index.html'), '<h1>forest polish</h1>')
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

  it('includes one <loc> per built page, including nested/dynamic-origin routes', () => {
    const xml = readFileSync(join(root, 'dist/sitemap.xml'), 'utf-8')
    expect(xml).toContain('<loc>https://example.com/</loc>')
    expect(xml).toContain('<loc>https://example.com/about</loc>')
    expect(xml).toContain('<loc>https://example.com/changelog/roots</loc>')
    expect(xml).toContain('<loc>https://example.com/changelog/forest-polish</loc>')
  })

  it('does not include a trailing slash on non-root routes', () => {
    const xml = readFileSync(join(root, 'dist/sitemap.xml'), 'utf-8')
    expect(xml).not.toContain('<loc>https://example.com/about/</loc>')
  })

  it('XML-escapes special characters in route URLs', () => {
    const specialRoot = mkdtempSync(join(tmpdir(), 'wald-sitemap-special-'))
    mkdirSync(join(specialRoot, 'dist/foo&bar'), { recursive: true })
    writeFileSync(join(specialRoot, 'dist/foo&bar/index.html'), '<h1>x</h1>')
    execFileSync(
      process.execPath,
      [join(__dirname, 'build-sitemap.mjs'), specialRoot, 'https://example.com'],
      { stdio: 'pipe' },
    )
    const xml = readFileSync(join(specialRoot, 'dist/sitemap.xml'), 'utf-8')
    expect(xml).toContain('<loc>https://example.com/foo&amp;bar</loc>')
    expect(xml).not.toContain('<loc>https://example.com/foo&bar</loc>')
    rmSync(specialRoot, { recursive: true, force: true })
  })
})
