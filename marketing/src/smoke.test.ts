import { describe, it, expect, beforeAll } from 'vitest'
import { execSync } from 'node:child_process'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(__dirname, '..')

function checkHeadingOrder(html: string, label: string): void {
  const levels = [...html.matchAll(/<h([1-6])[ >]/g)].map(m => Number(m[1]))
  for (let i = 1; i < levels.length; i++) {
    expect(levels[i] - levels[i - 1], `${label}: heading jumps from h${levels[i - 1]} to h${levels[i]} (position ${i})`).toBeLessThanOrEqual(1)
  }
}

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
      script.includes('data-wald-no-hoist') || script.includes('dataLayer') || /^<script[^>]*\btype="application\/ld\+json"/.test(script)
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

  it('laadt alle externe scripts met defer, behalve de inline taal-bootstrap', () => {
    const html = readFileSync(join(ROOT, 'dist/index.html'), 'utf-8')
    for (const src of [
      'three.min.js',
      'gsap.min.js',
      'ScrollTrigger.min.js',
      '/assets/js/site.js',
      '/assets/js/forest.js',
      '/assets/js/animations.js',
    ]) {
      const match = html.match(new RegExp(`<script[^>]*src="[^"]*${src.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[^>]*>`))
      expect(match, `script tag for ${src} not found`).not.toBeNull()
      expect(match![0], `${src} should have defer`).toContain('defer')
    }

    const inlineLangScript = html.match(/<script data-wald-no-hoist[^>]*>/)
    expect(inlineLangScript).not.toBeNull()
    expect(inlineLangScript![0]).not.toContain('defer')
  })

  it('genereert changelog-overzicht en 8 losse changelog-detailpagina\'s', () => {
    expect(existsSync(join(ROOT, 'dist/changelog/index.html'))).toBe(true)
    const overzicht = readFileSync(join(ROOT, 'dist/changelog/index.html'), 'utf-8')
    for (const slug of ['roots', 'seed', 'sapling', 'branches', 'forest-vite-pipeline', 'canopy', 'forest-polish', 'forest-deployment-adapters']) {
      expect(existsSync(join(ROOT, `dist/changelog/${slug}/index.html`)), `missing dist/changelog/${slug}/index.html`).toBe(true)
      expect(overzicht).toContain(`/changelog/${slug}`)
    }

    const sitemap = readFileSync(join(ROOT, 'dist/sitemap.xml'), 'utf-8')
    expect(sitemap).toContain('<loc>https://waldjs.steefan.nl/changelog</loc>')
    expect(sitemap).toContain('<loc>https://waldjs.steefan.nl/changelog/roots</loc>')
  })

  it('toont nog maar de 3 recentste changelog-entries op de homepage', () => {
    const html = readFileSync(join(ROOT, 'dist/index.html'), 'utf-8')
    const kaarten = html.match(/class="log-kaart"/g) ?? []
    expect(kaarten.length).toBe(3)
    expect(html).toContain('href="/changelog"')
  })

  it('rendert changelog-body als echte HTML, niet ge-escaped', () => {
    const detail = readFileSync(join(ROOT, 'dist/changelog/canopy/index.html'), 'utf-8')
    expect(detail).toContain('<span class="nl">')
    expect(detail).not.toContain('&lt;span')
  })

  it('produceert vergelijkingspagina\'s met eigen titel en canonical', () => {
    for (const [slug, title] of [
      ['astro', 'WaldJS vs Astro'],
      ['eleventy', 'WaldJS vs Eleventy'],
    ] as const) {
      const path = join(ROOT, `dist/vs/${slug}/index.html`)
      expect(existsSync(path), `missing dist/vs/${slug}/index.html`).toBe(true)
      const html = readFileSync(path, 'utf-8')
      expect(html).toContain(`<title>${title}`)
      expect(html).toContain(`<link rel="canonical" href="https://waldjs.steefan.nl/vs/${slug}">`)
    }

    const sitemap = readFileSync(join(ROOT, 'dist/sitemap.xml'), 'utf-8')
    expect(sitemap).toContain('<loc>https://waldjs.steefan.nl/vs/astro</loc>')
    expect(sitemap).toContain('<loc>https://waldjs.steefan.nl/vs/eleventy</loc>')
  })

  it('gebruikt absolute homepage-anchors in nav/footer zodat ze ook werken op andere pagina\'s', () => {
    const changelog = readFileSync(join(ROOT, 'dist/changelog/index.html'), 'utf-8')
    expect(changelog).toContain('href="/#quickstart"')
    expect(changelog).not.toContain('href="#quickstart"')
  })

  it('produceert een /waarom-pagina zonder concurrent-namen', () => {
    const path = join(ROOT, 'dist/waarom/index.html')
    expect(existsSync(path)).toBe(true)
    const html = readFileSync(path, 'utf-8')
    expect(html).toContain('<link rel="canonical" href="https://waldjs.steefan.nl/waarom">')
    expect(html.toLowerCase()).not.toContain('astro')
    expect(html.toLowerCase()).not.toContain('eleventy')

    const sitemap = readFileSync(join(ROOT, 'dist/sitemap.xml'), 'utf-8')
    expect(sitemap).toContain('<loc>https://waldjs.steefan.nl/waarom</loc>')
  })

  it('bevat een prefers-reduced-motion regel die transitions/animaties uitzet', () => {
    const css = readFileSync(join(ROOT, 'dist/assets/css/site.css'), 'utf-8')
    expect(css).toContain('@media(prefers-reduced-motion:reduce)')
    expect(css).toContain('scroll-behavior:auto !important')
  })

  it('bevat een prefers-contrast:more boost voor randen, gedempte tekst en het benchmark-label', () => {
    const css = readFileSync(join(ROOT, 'dist/assets/css/site.css'), 'utf-8')
    expect(css).toContain('@media(prefers-contrast:more)')
    expect(css).toContain('--rand:rgba(255,255,255,0.4)')
    expect(css).toContain('--wit-zacht:rgba(255,255,255,0.92)')
    expect(css).toContain('.staaf.wald .label b{color:var(--wit)}')
  })

  it('boost ook de losse, niet-getokeniseerde gedempte teksten onder prefers-contrast:more', () => {
    const css = readFileSync(join(ROOT, 'dist/assets/css/site.css'), 'utf-8')
    for (const selector of ['.log-kop .datum', '.footer-onder', '.c-c', '.vergelijk .nee', '.bench .disclaimer']) {
      expect(css, `${selector} mist een prefers-contrast:more override`).toContain(`${selector}{color:var(--wit-zacht)}`)
    }
  })

  it('heeft geldige koppen-volgorde (geen niveau overslaan) op elk paginatype', () => {
    const pages = [
      'dist/index.html',
      'dist/waarom/index.html',
      'dist/vs/astro/index.html',
      'dist/vs/eleventy/index.html',
      'dist/changelog/index.html',
      'dist/changelog/roots/index.html',
    ]
    for (const page of pages) {
      const html = readFileSync(join(ROOT, page), 'utf-8')
      checkHeadingOrder(html, page)
    }
  })

  it('gebruikt h2 voor changelog-kaarttitels en footer-kolomtitels, geen h3/h4', () => {
    const changelog = readFileSync(join(ROOT, 'dist/changelog/index.html'), 'utf-8')
    expect(changelog).toContain('<h2><a href="/changelog/roots">')
    expect(changelog).not.toContain('<h3><a href="/changelog/')

    const html = readFileSync(join(ROOT, 'dist/index.html'), 'utf-8')
    expect((html.match(/class="footer-grid"[\s\S]*?<h2>/g) ?? []).length).toBeGreaterThan(0)
  })

  it('heeft precies een <main id="main"> landmark en een skip-link ernaartoe', () => {
    for (const page of ['dist/index.html', 'dist/waarom/index.html']) {
      const html = readFileSync(join(ROOT, page), 'utf-8')
      expect((html.match(/<main id="main"[^>]*>/g) ?? []).length, `${page} main count`).toBe(1)
      expect(html).toContain('<main id="main" tabindex="-1">')
      expect(html).toContain('<a class="skip-link" href="#main">')
    }
  })

  it('heeft scope="col" op alle th-cellen, ook in de Features-tabel op de homepage', () => {
    for (const page of ['dist/vs/astro/index.html', 'dist/index.html']) {
      const html = readFileSync(join(ROOT, page), 'utf-8')
      const ths = html.match(/<th[^>]*>/g) ?? []
      expect(ths.length, page).toBeGreaterThan(0)
      for (const th of ths) {
        expect(th, `${page}: ${th}`).toContain('scope="col"')
      }
    }
  })
})
