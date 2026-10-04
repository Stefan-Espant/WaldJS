import { escapeHtml } from './html'

export type Locale = 'nl' | 'en'
export type LocalePaths = Partial<Record<Locale, string>>

export const SITE_URL = 'https://waldjs.eu'
// Cookieless analytics (Umami Cloud, EU region). The tracker is only rendered
// once a website ID is filled in, so the site never loads a half-configured script.
export const UMAMI_SCRIPT_URL = 'https://cloud.umami.is/script.js'
export const UMAMI_WEBSITE_ID = ''
export const DEFAULT_OG_IMAGE = `${SITE_URL}/assets/og-image.png`

// Applies the visitor's stored language before first paint. Only rendered on
// pages whose language is NOT fixed by the URL (everything except the blog).
export const LANG_BOOTSTRAP_SCRIPT = `<script data-wald-no-hoist>try{var t=localStorage.getItem('wald-taal');if(t==='nl'||t==='en'){document.documentElement.dataset.lang=t;document.documentElement.lang=t;}}catch(e){}</script>`

export const SOFTWARE_APPLICATION_JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'WaldJS',
  description:
    'WaldJS is een content-first webframework voor razendsnelle, statische websites. Schrijf .wald-bestanden en WaldJS compileert ze tot een statische site.',
  applicationCategory: 'DeveloperApplication',
  operatingSystem: 'Cross-platform',
  url: 'https://waldjs.eu/',
  author: {
    '@type': 'Organization',
    name: 'WaldJS',
    url: 'https://github.com/Stefan-Espant/WaldJS',
  },
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'USD',
  },
}

export function jsonLdTag(data: unknown): string {
  // `<` is escaped so a value containing "</script>" can't end the tag early.
  const json = JSON.stringify(data, null, 2).replace(/</g, '\\u003c')
  return `<script type="application/ld+json">${json}</script>`
}

export function alternateLinksHtml(alternates: LocalePaths | undefined): string {
  const entries = Object.entries(alternates ?? {}).filter(([, path]) => path) as [Locale, string][]
  if (entries.length < 2) return ''
  const links = entries
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([locale, path]) => `<link rel="alternate" hreflang="${locale}" href="${escapeHtml(SITE_URL + path)}">`)
  const fallback = alternates?.nl ?? entries[0][1]
  links.push(`<link rel="alternate" hreflang="x-default" href="${escapeHtml(SITE_URL + fallback)}">`)
  return links.join('\n')
}

export function rssLinkHtml(path: string | undefined): string {
  if (!path) return ''
  return `<link rel="alternate" type="application/rss+xml" title="WaldJS Blog" href="${escapeHtml(path)}">`
}

export function langSwitchHtml(lang: Locale | undefined, links: LocalePaths | undefined): string {
  const open = '<div class="lang-switch" role="group" aria-label="Taal / Language">'
  if (!lang || !links) {
    return `${open}<button id="btn-nl" class="active" onclick="setLanguage('nl')">NL</button><button id="btn-en" onclick="setLanguage('en')">EN</button></div>`
  }
  const link = (locale: Locale) => {
    const current = locale === lang ? ' class="active" aria-current="true"' : ''
    const href = escapeHtml(links[locale] ?? '/')
    return `<a id="btn-${locale}"${current} href="${href}" hreflang="${locale}" onclick="try{localStorage.setItem('wald-taal','${locale}')}catch(e){}">${locale.toUpperCase()}</a>`
  }
  return `${open}${link('nl')}${link('en')}</div>`
}

export function analyticsScriptHtml(websiteId: string = UMAMI_WEBSITE_ID): string {
  if (!websiteId) return ''
  return `<script defer src="${UMAMI_SCRIPT_URL}" data-website-id="${escapeHtml(websiteId)}"></script>`
}
