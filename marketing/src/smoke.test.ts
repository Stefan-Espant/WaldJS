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
    for (const id of ['quickstart', 'format', 'playground', 'metaphor', 'features', 'comparison', 'benchmarks', 'cli', 'structure', 'packages', 'roadmap', 'faq', 'changelog']) {
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
      script.includes('data-wald-no-hoist') || /^<script[^>]*\btype="application\/ld\+json"/.test(script)
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
    expect(html).toContain('<link rel="canonical" href="https://waldjs.eu/">')
    expect(html).toContain('property="og:image"')
    expect(html).toContain('name="twitter:image"')

    const match = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)
    expect(match).not.toBeNull()
    const data = JSON.parse(match![1])
    expect(data['@type']).toBe('SoftwareApplication')
    expect(data.url).toBe('https://waldjs.eu/')
  })

  it('produceert robots.txt en sitemap.xml met de juiste canonical host', () => {
    const robots = readFileSync(join(ROOT, 'dist/robots.txt'), 'utf-8')
    expect(robots).toContain('Sitemap: https://waldjs.eu/sitemap.xml')

    const sitemap = readFileSync(join(ROOT, 'dist/sitemap.xml'), 'utf-8')
    expect(sitemap).toContain('<loc>https://waldjs.eu/</loc>')
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
    expect(sitemap).toContain('<loc>https://waldjs.eu/changelog</loc>')
    expect(sitemap).toContain('<loc>https://waldjs.eu/changelog/roots</loc>')
  })

  it('toont nog maar de 3 recentste changelog-entries op de homepage', () => {
    const html = readFileSync(join(ROOT, 'dist/index.html'), 'utf-8')
    const kaarten = html.match(/class="log-card"/g) ?? []
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
      expect(html).toContain(`<link rel="canonical" href="https://waldjs.eu/vs/${slug}">`)
    }

    const sitemap = readFileSync(join(ROOT, 'dist/sitemap.xml'), 'utf-8')
    expect(sitemap).toContain('<loc>https://waldjs.eu/vs/astro</loc>')
    expect(sitemap).toContain('<loc>https://waldjs.eu/vs/eleventy</loc>')
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
    expect(html).toContain('<link rel="canonical" href="https://waldjs.eu/waarom">')
    expect(html.toLowerCase()).not.toContain('astro')
    expect(html.toLowerCase()).not.toContain('eleventy')

    const sitemap = readFileSync(join(ROOT, 'dist/sitemap.xml'), 'utf-8')
    expect(sitemap).toContain('<loc>https://waldjs.eu/waarom</loc>')
  })

  it('produceert een /voorwaarden-pagina, gelinkt vanuit de footer behalve op zichzelf', () => {
    const path = join(ROOT, 'dist/voorwaarden/index.html')
    expect(existsSync(path)).toBe(true)
    const html = readFileSync(path, 'utf-8')
    expect(html).toContain('<link rel="canonical" href="https://waldjs.eu/voorwaarden">')
    expect(html).toContain('opzet of bewuste roekeloosheid')
    expect(html).not.toContain('href="/voorwaarden"')

    const home = readFileSync(join(ROOT, 'dist/index.html'), 'utf-8')
    expect(home).toContain('<a class="footer-legal" href="/voorwaarden">')

    const sitemap = readFileSync(join(ROOT, 'dist/sitemap.xml'), 'utf-8')
    expect(sitemap).toContain('<loc>https://waldjs.eu/voorwaarden</loc>')
  })

  it('produceert een /privacy-pagina, gelinkt vanuit de footer behalve op zichzelf', () => {
    const path = join(ROOT, 'dist/privacy/index.html')
    expect(existsSync(path)).toBe(true)
    const html = readFileSync(path, 'utf-8')
    expect(html).toContain('<link rel="canonical" href="https://waldjs.eu/privacy">')
    expect(html).toContain('Autoriteit Persoonsgegevens')
    expect(html).not.toContain('href="/privacy"')
    expect(html).toContain('<a class="footer-legal" href="/voorwaarden">')

    const home = readFileSync(join(ROOT, 'dist/index.html'), 'utf-8')
    expect(home).toContain('<a class="footer-legal" href="/privacy">')

    const sitemap = readFileSync(join(ROOT, 'dist/sitemap.xml'), 'utf-8')
    expect(sitemap).toContain('<loc>https://waldjs.eu/privacy</loc>')
  })

  it('laadt geen Google Analytics meer', () => {
    for (const page of ['dist/index.html', 'dist/privacy/index.html', 'dist/blog/index.html']) {
      const html = readFileSync(join(ROOT, page), 'utf-8')
      expect(html, page).not.toContain('googletagmanager')
      expect(html, page).not.toContain('gtag(')
    }
  })

  it('noemt WaldJS als generator, met de CLI-versie', () => {
    const cliVersion = JSON.parse(readFileSync(join(ROOT, '../packages/cli/package.json'), 'utf-8')).version
    for (const page of ['dist/index.html', 'dist/waarom/index.html', 'dist/blog/index.html']) {
      const html = readFileSync(join(ROOT, page), 'utf-8')
      expect(html, page).toContain(`<meta name="generator" content="WaldJS v${cliVersion}">`)
    }
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
    expect(css).toContain('.stat.wald .label b{color:var(--wit)}')
  })

  it('boost ook de losse, niet-getokeniseerde gedempte teksten onder prefers-contrast:more', () => {
    const css = readFileSync(join(ROOT, 'dist/assets/css/site.css'), 'utf-8')
    for (const selector of ['.log-header .date', '.footer-bottom', '.c-c', '.compare .no', '.bench .disclaimer']) {
      expect(css, `${selector} mist een prefers-contrast:more override`).toContain(`${selector}{color:var(--wit-zacht)}`)
    }
  })

  it('heeft geldige koppen-volgorde (geen niveau overslaan) op elk paginatype', () => {
    const pages = [
      'dist/index.html',
      'dist/waarom/index.html',
      'dist/voorwaarden/index.html',
      'dist/privacy/index.html',
      'dist/vs/astro/index.html',
      'dist/vs/eleventy/index.html',
      'dist/changelog/index.html',
      'dist/changelog/roots/index.html',
      'dist/blog/index.html',
      'dist/en/blog/content-locales/index.html',
      'dist/blog/tag/release/index.html',
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

  it('zet aria-current="page" alleen op de nav-link van de huidige pagina, in desktop en mobiel menu', () => {
    const changelog = readFileSync(join(ROOT, 'dist/changelog/index.html'), 'utf-8')
    expect((changelog.match(/href="\/changelog"[^>]*aria-current="page"/g) ?? []).length, 'changelog links met aria-current=page').toBe(2)
    expect(changelog).not.toMatch(/href="\/waarom"[^>]*aria-current="page"/)

    const waarom = readFileSync(join(ROOT, 'dist/waarom/index.html'), 'utf-8')
    expect((waarom.match(/href="\/waarom"[^>]*aria-current="page"/g) ?? []).length, 'waarom links met aria-current=page').toBe(2)
    expect(waarom).not.toMatch(/href="\/changelog"[^>]*aria-current="page"/)

    const home = readFileSync(join(ROOT, 'dist/index.html'), 'utf-8')
    expect(home).not.toContain('aria-current="page"')
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

  it('geeft het mobiele menu dialog-semantiek en start inert (niet met Tab bereikbaar) tot het open is', () => {
    const html = readFileSync(join(ROOT, 'dist/index.html'), 'utf-8')
    expect(html).toContain('id="mobile-menu"')
    const mobileMenuTag = html.match(/<div id="mobile-menu"[^>]*>/)?.[0] ?? ''
    expect(mobileMenuTag).toContain('role="dialog"')
    expect(mobileMenuTag).toContain('aria-modal="true"')
    expect(mobileMenuTag).toMatch(/\binert\b/)
  })

  it('sluit ook het mobiele menu als je op de GitHub-link erin klikt', () => {
    const html = readFileSync(join(ROOT, 'dist/index.html'), 'utf-8')
    const mobileMenu = html.match(/<div id="mobile-menu"[\s\S]*?<\/div>/)?.[0] ?? ''
    const githubLink = mobileMenu.match(/<a[^>]*github\.com[^>]*>/i)?.[0] ?? ''
    expect(githubLink, mobileMenu).toContain('onclick="toggleMenu(false)"')
  })

  it('gebruikt alleen phrasing content (geen div) binnen de hero h1', () => {
    const html = readFileSync(join(ROOT, 'dist/index.html'), 'utf-8')
    const h1 = html.match(/<h1>[\s\S]*?<\/h1>/)?.[0] ?? ''
    expect(h1).not.toContain('<div')
    expect(h1).toContain('<span class="nl">')
    expect(h1).toContain('<span class="en">')
  })

  it('houdt de taal-bootstrap op pagina\'s zonder vaste taal en linkt naar de blog', () => {
    const html = readFileSync(join(ROOT, 'dist/index.html'), 'utf-8')
    expect(html).toContain('<html lang="nl" data-lang="nl" data-lang-fixed="">')
    expect(html).toContain(`localStorage.getItem('wald-taal')`)
    expect(html).toContain(`<button id="btn-nl" class="active" onclick="setLanguage('nl')">NL</button>`)
    expect((html.match(/<a href="\/blog"/g) ?? []).length, 'blog links in desktop + mobile nav').toBe(2)
  })

  it('genereert de blog in NL en EN: index, post en tagpagina', () => {
    for (const page of [
      'dist/blog/index.html',
      'dist/en/blog/index.html',
      'dist/blog/content-locales/index.html',
      'dist/en/blog/content-locales/index.html',
      'dist/blog/tag/release/index.html',
      'dist/en/blog/tag/release/index.html',
    ]) {
      expect(existsSync(join(ROOT, page)), `missing ${page}`).toBe(true)
    }
    const nlIndex = readFileSync(join(ROOT, 'dist/blog/index.html'), 'utf-8')
    expect(nlIndex).toContain('<h2><a href="/blog/content-locales">')
    const enIndex = readFileSync(join(ROOT, 'dist/en/blog/index.html'), 'utf-8')
    expect(enIndex).toContain('<h2><a href="/en/blog/content-locales">')
  })

  it('zet de taal vast in de HTML van blogpagina\'s, zonder taal-bootstrap', () => {
    const en = readFileSync(join(ROOT, 'dist/en/blog/content-locales/index.html'), 'utf-8')
    expect(en).toContain('<html lang="en" data-lang="en" data-lang-fixed="en">')
    expect(en).not.toContain(`localStorage.getItem('wald-taal')`)
    const nl = readFileSync(join(ROOT, 'dist/blog/content-locales/index.html'), 'utf-8')
    expect(nl).toContain('<html lang="nl" data-lang="nl" data-lang-fixed="nl">')
  })

  it('koppelt NL- en EN-versies via hreflang en de taalschakelaar', () => {
    const nl = readFileSync(join(ROOT, 'dist/blog/content-locales/index.html'), 'utf-8')
    expect(nl).toContain('<link rel="alternate" hreflang="en" href="https://waldjs.eu/en/blog/content-locales">')
    expect(nl).toContain('<link rel="alternate" hreflang="x-default" href="https://waldjs.eu/blog/content-locales">')
    expect(nl).toContain('<a id="btn-en" href="/en/blog/content-locales" hreflang="en"')
    expect(nl).toContain('<link rel="alternate" type="application/rss+xml" title="WaldJS Blog" href="/blog/rss.xml">')
  })

  it('geeft een blogpost een cover, og:image en BlogPosting JSON-LD', () => {
    const en = readFileSync(join(ROOT, 'dist/en/blog/content-locales/index.html'), 'utf-8')
    expect(en).toContain('<meta property="og:type" content="article">')
    expect(en).toContain('content="https://waldjs.eu/assets/blog/content-locales.jpg"')
    expect(en).toMatch(/<img[^>]*srcset="[^"]*\.webp/)
    const ld = en.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)
    expect(JSON.parse(ld![1])['@type']).toBe('BlogPosting')
    expect(existsSync(join(ROOT, 'dist/assets/blog/content-locales.jpg'))).toBe(true)
  })

  it('stijlt de taalschakelaar voor knoppen en links (minifier breekt `.x :is()`)', () => {
    const css = readFileSync(join(ROOT, 'dist/assets/css/site.css'), 'utf-8')
    expect(css).toContain('.lang-switch button.active,.lang-switch a.active{')
    expect(css).not.toMatch(/\.lang-switch:is\(/)
  })

  it('zet aria-current op de Blog-link van de blog-index', () => {
    const html = readFileSync(join(ROOT, 'dist/en/blog/index.html'), 'utf-8')
    expect((html.match(/href="\/en\/blog"[^>]*aria-current="page"/g) ?? []).length).toBe(2)
  })
})
