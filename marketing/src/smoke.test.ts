import { describe, it, expect, beforeAll } from 'vitest'
import { execSync } from 'node:child_process'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(__dirname, '..')

describe('marketing site build', () => {
  beforeAll(() => {
    execSync('node ../packages/cli/bin/wald.js build', { cwd: ROOT, stdio: 'pipe' })
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
    expect(existsSync(join(ROOT, 'dist/assets/css/site.css'))).toBe(true)
    expect(existsSync(join(ROOT, 'dist/assets/js/site.js'))).toBe(true)
    expect(existsSync(join(ROOT, 'dist/assets/js/forest.js'))).toBe(true)
    expect(existsSync(join(ROOT, 'dist/assets/js/animations.js'))).toBe(true)
  })

  it('bevat geen inline script-blokken meer behalve CDN, asset- en bekende bootstrap-scripts', () => {
    const html = readFileSync(join(ROOT, 'dist/index.html'), 'utf-8')
    const inlineScripts = html.match(/<script(?![^>]*src=)[^>]*>[\s\S]*?<\/script>/g) ?? []
    const isSanctioned = (script: string) =>
      script.includes('data-wald-no-hoist') || script.includes('dataLayer') || script.includes('application/ld+json')
    const unsanctioned = inlineScripts.filter((script) => !isSanctioned(script))
    expect(unsanctioned).toEqual([])
  })

  it('bouwt canopy islands als dist assets', () => {
    const html = readFileSync(join(ROOT, 'dist/index.html'), 'utf-8')
    expect(html).toContain('<wald-canopy')
    expect(html).toContain('data-strategy="load"')
    expect(html).toContain('/assets/wald-canopy-')
    expect(html).toContain('/assets/canopyping-')
  })

  it('bevat canonical, og:image en geldige JSON-LD structured data', () => {
    const html = readFileSync(join(ROOT, 'dist/index.html'), 'utf-8')
    expect(html).toContain('<link rel="canonical" href="https://waldjs.steefan.nl/">')
    expect(html).toContain('property="og:image"')
    expect(html).toContain('name="twitter:image"')

    const match = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)
    expect(match).not.toBeNull()
    const data = JSON.parse(match![1])
    expect(data['@type']).toBe('SoftwareApplication')
    expect(data.url).toBe('https://waldjs.steefan.nl/')
  })

  it('produceert robots.txt en sitemap.xml met de juiste canonical host', () => {
    const robots = readFileSync(join(ROOT, 'dist/robots.txt'), 'utf-8')
    expect(robots).toContain('Sitemap: https://waldjs.steefan.nl/sitemap.xml')

    const sitemap = readFileSync(join(ROOT, 'dist/sitemap.xml'), 'utf-8')
    expect(sitemap).toContain('<loc>https://waldjs.steefan.nl/</loc>')
  })
})
