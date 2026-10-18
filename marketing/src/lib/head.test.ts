import { describe, it, expect } from 'vitest'
import {
  alternateLinksHtml,
  jsonLdTag,
  langSwitchHtml,
  rssLinkHtml,
  LANG_BOOTSTRAP_SCRIPT,
  SOFTWARE_APPLICATION_JSON_LD,
} from './head'

describe('jsonLdTag', () => {
  it('wraps JSON in an ld+json script and neutralises </script>', () => {
    const tag = jsonLdTag({ name: '</script><b>' })
    expect(tag.startsWith('<script type="application/ld+json">')).toBe(true)
    expect(tag).not.toContain('</script><b>')
    const json = tag.slice('<script type="application/ld+json">'.length, -'</script>'.length)
    expect(JSON.parse(json).name).toBe('</script><b>')
  })

  it('keeps the existing SoftwareApplication data', () => {
    expect(SOFTWARE_APPLICATION_JSON_LD['@type']).toBe('SoftwareApplication')
    expect(SOFTWARE_APPLICATION_JSON_LD.url).toBe('https://waldjs.eu/')
  })
})

describe('alternateLinksHtml', () => {
  it('renders hreflang links per locale plus x-default pointing at NL', () => {
    const html = alternateLinksHtml({ nl: '/blog/a', en: '/en/blog/a' })
    expect(html).toContain('<link rel="alternate" hreflang="nl" href="https://waldjs.eu/blog/a">')
    expect(html).toContain('<link rel="alternate" hreflang="en" href="https://waldjs.eu/en/blog/a">')
    expect(html).toContain('<link rel="alternate" hreflang="x-default" href="https://waldjs.eu/blog/a">')
  })

  it('renders nothing without at least two locales', () => {
    expect(alternateLinksHtml(undefined)).toBe('')
    expect(alternateLinksHtml({ en: '/en/blog/a' })).toBe('')
  })
})

describe('rssLinkHtml', () => {
  it('renders an RSS alternate link or nothing', () => {
    expect(rssLinkHtml('/en/blog/rss.xml')).toBe(
      '<link rel="alternate" type="application/rss+xml" title="WaldJS Blog" href="/en/blog/rss.xml">',
    )
    expect(rssLinkHtml(undefined)).toBe('')
  })
})

describe('langSwitchHtml', () => {
  it('renders the client-side toggle buttons when the language is not fixed', () => {
    const html = langSwitchHtml(undefined, undefined)
    expect(html).toContain(`<button id="btn-nl" onclick="setLanguage('nl')">NL</button>`)
    expect(html).toContain(`<button id="btn-en" class="active" onclick="setLanguage('en')">EN</button>`)
  })

  it('renders links to the other language when the language is fixed', () => {
    const html = langSwitchHtml('en', { nl: '/blog/a', en: '/en/blog/a' })
    expect(html).toContain('<a id="btn-nl" href="/blog/a" hreflang="nl"')
    expect(html).toContain('<a id="btn-en" class="active" aria-current="true" href="/en/blog/a" hreflang="en"')
    expect(html).toContain(`localStorage.setItem('wald-taal','nl')`)
    expect(html).not.toContain('<button')
  })
})

describe('LANG_BOOTSTRAP_SCRIPT', () => {
  it('is the unhoisted inline script that applies the stored language', () => {
    expect(LANG_BOOTSTRAP_SCRIPT).toContain('data-wald-no-hoist')
    expect(LANG_BOOTSTRAP_SCRIPT).toContain(`localStorage.getItem('wald-taal')`)
  })

  // Runs the inline script against a fake browser: the HTML defaults to English
  // (what search engines see); the script picks the visitor's language.
  function run({ saved, browser, storageThrows = false }: { saved?: string; browser: string; storageThrows?: boolean }) {
    const documentElement = { dataset: { lang: 'en' } as Record<string, string>, lang: 'en' }
    const localStorage = {
      getItem: () => { if (storageThrows) throw new Error('blocked'); return saved ?? null },
    }
    const body = LANG_BOOTSTRAP_SCRIPT.replace(/^<script[^>]*>/, '').replace(/<\/script>$/, '')
    new Function('document', 'localStorage', 'navigator', body)({ documentElement }, localStorage, { language: browser })
    return documentElement.lang
  }

  it('uses a stored choice first', () => {
    expect(run({ saved: 'nl', browser: 'en-US' })).toBe('nl')
    expect(run({ saved: 'en', browser: 'nl-NL' })).toBe('en')
  })

  it('switches a Dutch browser without a stored choice to Dutch', () => {
    expect(run({ browser: 'nl-NL' })).toBe('nl')
    expect(run({ browser: 'nl-BE' })).toBe('nl')
  })

  it('keeps English for every other browser language', () => {
    expect(run({ browser: 'en-US' })).toBe('en')
    expect(run({ browser: 'de-DE' })).toBe('en')
  })

  it('falls back to the browser language when storage is blocked', () => {
    expect(run({ browser: 'nl', storageThrows: true })).toBe('nl')
  })
})
