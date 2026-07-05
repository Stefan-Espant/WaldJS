import { describe, it, expect, beforeAll } from 'vitest'
import { execSync } from 'node:child_process'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(__dirname, '..')

describe('marketing site build', () => {
  beforeAll(() => {
    execSync('pnpm build', { cwd: ROOT, stdio: 'pipe' })
  }, 180_000)

  it('produceert dist/index.html', () => {
    expect(existsSync(join(ROOT, 'dist/index.html'))).toBe(true)
  })

  it('begint met een doctype en bevat de secties', () => {
    const html = readFileSync(join(ROOT, 'dist/index.html'), 'utf-8')
    expect(html.trimStart().startsWith('<!DOCTYPE html>')).toBe(true)
    for (const id of ['quickstart', 'formaat', 'playground', 'metafoor', 'features', 'vergelijking', 'benchmarks', 'cli', 'structuur', 'packages', 'roadmap', 'faq', 'changelog']) {
      expect(html).toContain(`id="${id}"`)
    }
  })

  it('kopieert de assets mee', () => {
    expect(existsSync(join(ROOT, 'dist/css/site.css'))).toBe(true)
    expect(existsSync(join(ROOT, 'dist/js/site.js'))).toBe(true)
    expect(existsSync(join(ROOT, 'dist/js/forest.js'))).toBe(true)
    expect(existsSync(join(ROOT, 'dist/js/animations.js'))).toBe(true)
  })

  it('bevat geen inline script-blokken meer behalve CDN en asset-verwijzingen', () => {
    const html = readFileSync(join(ROOT, 'dist/index.html'), 'utf-8')
    const inlineScripts = html.match(/<script(?![^>]*src=)[^>]*>[\s\S]*?<\/script>/g) ?? []
    expect(inlineScripts).toEqual([])
  })
})
