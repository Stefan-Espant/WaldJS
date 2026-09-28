# Marketing Blog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A bilingual blog on waldjs.eu — `/blog` (NL) and `/en/blog` (EN) with post pages, per-tag pages, author, cover image and an RSS feed per language — built on the content-collection locales from PR #82.

**Architecture:** Posts live in `marketing/content/blog/{nl,en}/<slug>.md`. Pure helpers in `marketing/src/lib/` (HTML escaping, head tags, blog view logic) are unit-tested. Three page components (`BlogIndexPage`, `BlogPostPage`, `BlogTagPage`) do all data fetching and rendering per locale; the six route files under `src/pages/blog/` and `src/pages/en/blog/` are thin wrappers. `Layout.wald`/`Nav.wald` gain optional props that fix a page's language in the static HTML (no JS needed) and turn the NL/EN switch into links. RSS is a post-build script like the sitemap.

**Tech Stack:** WaldJS (`.wald` pages/components, `wald:content`, `wald:image`), TypeScript helpers compiled by Vite, Vitest, Node scripts, sharp (via `@waldjs/cli`).

**Spec:** [2026-09-28-marketing-blog-design.md](../specs/2026-09-28-marketing-blog-design.md)

---

## Before you start

- Repo: work in the clone at the path you were given, on branch `feat/marketing-blog` (branched from `main` after PR #82 merged). **Do not** use the checkout under `~/Desktop/…/waldjs`: iCloud evicts its files and git objects ("Operation timed out" / "Need authenticator").
- Node ≥ 22. Install once: `pnpm install` at the repo root, then `pnpm --filter @waldjs/content build && pnpm --filter @waldjs/runtime build && pnpm --filter @waldjs/canopy build && pnpm --filter @waldjs/compiler build && pnpm --filter @waldjs/cli build` (the marketing build uses the built CLI).
- End every commit message with the line `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` (omitted below for brevity). Stage explicit paths only.
- `.wald` templates have **no loops or conditionals**. Repeated or optional markup is built as an HTML string in the frontmatter and interpolated with `{new SafeHtml(str)}` (`SafeHtml` is available without import, see `src/pages/changelog/index.wald`). Every user value inside such a string must go through `escapeHtml`.
- Interpolation does **not** happen inside `<script>` content in templates — JSON-LD and the language bootstrap script are therefore emitted as whole strings via `SafeHtml`.
- `Image` from `wald:image` is a tree: `await Image.render({ src, alt, widths, sizes })` returns the `<img>` HTML string (optimized in `wald build`, original file in `wald grow`).
- The marketing CSS source is `src/styles/partials/*.css`; the bundle is generated and gitignored (see the `rebuilding-marketing-css` skill). Smoke tests that read CSS need `node scripts/build-css.js public` first, because `wald build` copies `src/assets/css/site.css`.
- Known and out of scope: `wald check` types `$$props.slug` as `unknown` (#83); the marketing site already has 5 `wald check` errors on `main`.

## File map

| File | Responsibility |
|---|---|
| `marketing/src/lib/html.ts` (+ test) | `escapeHtml` |
| `marketing/src/lib/head.ts` (+ test) | Site constants, JSON-LD tag, hreflang links, RSS link, language bootstrap, language switch markup |
| `marketing/src/lib/blog.ts` (+ test) | Frontmatter validation → `PostMeta`, sorting, tags, dates, paths, UI strings, card/meta HTML, `BlogPosting` JSON-LD |
| `marketing/src/layouts/Layout.wald` | Optional `lang`, `alternates`, `langLinks`, `ogImage`, `ogType`, `jsonLd`, `rss` props |
| `marketing/src/components/Nav.wald` | Blog link, language switch via `langSwitchHtml` |
| `marketing/src/assets/js/site.js` | Don't apply the stored language on fixed-language pages; remember the page's language instead |
| `marketing/src/styles/partials/03-nav.css` | `.lang-switch` styles also apply to `<a>` |
| `marketing/src/components/BlogList.wald` | Post cards (with optimized cover thumbnails) |
| `marketing/src/components/BlogIndexPage.wald`, `BlogPostPage.wald`, `BlogTagPage.wald` | Full pages per locale |
| `marketing/src/pages/blog/{index,[slug]}.wald`, `blog/tag/[tag].wald` and the same under `src/pages/en/` | Routes + `getStaticPaths` |
| `marketing/content/blog/{nl,en}/content-locales.md`, `src/assets/blog/content-locales.jpg` | First post + cover |
| `marketing/src/styles/partials/30-blog.css`, `src/styles/site.css` | Blog styles + import |
| `marketing/scripts/build-rss.mjs` (+ test) | RSS 2.0 feed per locale |
| `marketing/package.json`, `marketing/scripts/vercel-build.mjs`, `pnpm-lock.yaml` | `@waldjs/content` dependency, RSS in both build paths |
| `marketing/src/smoke.test.ts` | End-to-end assertions on the built site |

---

### Task 1: `escapeHtml` and head helpers

**Files:**
- Create: `marketing/src/lib/html.ts`, `marketing/src/lib/html.test.ts`
- Create: `marketing/src/lib/head.ts`, `marketing/src/lib/head.test.ts`

- [ ] **Step 1: Write the failing tests**

`marketing/src/lib/html.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { escapeHtml } from './html'

describe('escapeHtml', () => {
  it('escapes the five HTML-significant characters', () => {
    expect(escapeHtml(`<a href="x">Tom & 'Jerry'</a>`)).toBe('&lt;a href=&quot;x&quot;&gt;Tom &amp; &#39;Jerry&#39;&lt;/a&gt;')
  })

  it('turns null and undefined into an empty string', () => {
    expect(escapeHtml(undefined)).toBe('')
    expect(escapeHtml(null)).toBe('')
  })
})
```

`marketing/src/lib/head.test.ts`:

```ts
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
    expect(html).toContain(`<button id="btn-nl" class="actief" onclick="zetTaal('nl')">NL</button>`)
    expect(html).toContain(`<button id="btn-en" onclick="zetTaal('en')">EN</button>`)
  })

  it('renders links to the other language when the language is fixed', () => {
    const html = langSwitchHtml('en', { nl: '/blog/a', en: '/en/blog/a' })
    expect(html).toContain('<a id="btn-nl" href="/blog/a" hreflang="nl"')
    expect(html).toContain('<a id="btn-en" class="actief" aria-current="true" href="/en/blog/a" hreflang="en"')
    expect(html).toContain(`localStorage.setItem('wald-taal','nl')`)
    expect(html).not.toContain('<button')
  })
})

describe('LANG_BOOTSTRAP_SCRIPT', () => {
  it('is the unhoisted inline script that applies the stored language', () => {
    expect(LANG_BOOTSTRAP_SCRIPT).toContain('data-wald-no-hoist')
    expect(LANG_BOOTSTRAP_SCRIPT).toContain(`localStorage.getItem('wald-taal')`)
  })
})
```

- [ ] **Step 2: Run to verify they fail**

Run: `cd marketing && npx vitest run src/lib`
Expected: FAIL — modules `./html` and `./head` do not exist.

- [ ] **Step 3: Implement**

`marketing/src/lib/html.ts`:

```ts
const ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}

export function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, char => ESCAPES[char])
}
```

`marketing/src/lib/head.ts`:

```ts
import { escapeHtml } from './html'

export type Locale = 'nl' | 'en'
export type LocalePaths = Partial<Record<Locale, string>>

export const SITE_URL = 'https://waldjs.eu'
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
    return `${open}<button id="btn-nl" class="actief" onclick="zetTaal('nl')">NL</button><button id="btn-en" onclick="zetTaal('en')">EN</button></div>`
  }
  const link = (locale: Locale) => {
    const current = locale === lang ? ' class="actief" aria-current="true"' : ''
    const href = escapeHtml(links[locale] ?? '/')
    return `<a id="btn-${locale}"${current} href="${href}" hreflang="${locale}" onclick="try{localStorage.setItem('wald-taal','${locale}')}catch(e){}">${locale.toUpperCase()}</a>`
  }
  return `${open}${link('nl')}${link('en')}</div>`
}
```

- [ ] **Step 4: Run to verify they pass**

Run: `cd marketing && npx vitest run src/lib`
Expected: PASS (all html + head tests).

- [ ] **Step 5: Commit**

```bash
git add marketing/src/lib/html.ts marketing/src/lib/html.test.ts marketing/src/lib/head.ts marketing/src/lib/head.test.ts
git commit -m "feat(marketing): head and HTML helpers for fixed-language pages"
```

---

### Task 2: Blog view helpers

**Files:**
- Create: `marketing/src/lib/blog.ts`, `marketing/src/lib/blog.test.ts`

- [ ] **Step 1: Write the failing tests**

`marketing/src/lib/blog.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import {
  blogPath,
  blogPostingJsonLd,
  collectTags,
  formatDate,
  otherLocale,
  postCardHtml,
  postMetaHtml,
  rssPath,
  sortByDate,
  t,
  tagPath,
  toPostMeta,
  type PostMeta,
} from './blog'

const entry = (data: Record<string, unknown>, slug = 'hello', locale = 'en') => ({ slug, locale, data, body: '<p>x</p>' })
const valid = { title: 'Hello', description: 'Desc', date: new Date('2026-09-28'), author: 'Stefan van der Kort' }

describe('toPostMeta', () => {
  it('maps valid frontmatter, defaulting tags to []', () => {
    const post = toPostMeta(entry(valid))
    expect(post).toMatchObject({ slug: 'hello', title: 'Hello', description: 'Desc', author: 'Stefan van der Kort', tags: [] })
    expect(post.date.toISOString()).toBe('2026-09-28T00:00:00.000Z')
  })

  it('accepts a date string', () => {
    expect(toPostMeta(entry({ ...valid, date: '2026-09-28' })).date.toISOString()).toBe('2026-09-28T00:00:00.000Z')
  })

  it('names the file and field when a required field is missing', () => {
    expect(() => toPostMeta(entry({ ...valid, title: undefined }))).toThrow('blog/en/hello.md: missing "title"')
  })

  it('rejects an invalid date', () => {
    expect(() => toPostMeta(entry({ ...valid, date: 'soon' }))).toThrow('blog/en/hello.md: invalid "date"')
  })

  it('requires coverAlt when a cover is set', () => {
    expect(() => toPostMeta(entry({ ...valid, cover: '/assets/blog/a.jpg' }))).toThrow(
      'blog/en/hello.md: "cover" requires "coverAlt"',
    )
  })

  it('requires kebab-case tags', () => {
    expect(() => toPostMeta(entry({ ...valid, tags: ['Big News'] }))).toThrow(
      'blog/en/hello.md: tag "Big News" must be kebab-case',
    )
  })
})

const post = (slug: string, date: string, tags: string[] = []): PostMeta =>
  toPostMeta(entry({ ...valid, title: slug, date, tags }, slug))

describe('sortByDate / collectTags', () => {
  it('sorts newest first without mutating the input', () => {
    const input = [post('old', '2026-01-01'), post('new', '2026-09-01')]
    expect(sortByDate(input).map(p => p.slug)).toEqual(['new', 'old'])
    expect(input[0].slug).toBe('old')
  })

  it('collects unique tags alphabetically', () => {
    expect(collectTags([post('a', '2026-01-01', ['release', 'content']), post('b', '2026-01-02', ['content'])])).toEqual([
      'content',
      'release',
    ])
  })
})

describe('formatDate', () => {
  it('formats per locale in UTC', () => {
    expect(formatDate(new Date('2026-09-28'), 'nl')).toBe('28 september 2026')
    expect(formatDate(new Date('2026-09-28'), 'en')).toBe('September 28, 2026')
  })
})

describe('paths and strings', () => {
  it('builds locale-prefixed paths', () => {
    expect(blogPath('nl')).toBe('/blog')
    expect(blogPath('en')).toBe('/en/blog')
    expect(blogPath('nl', 'a')).toBe('/blog/a')
    expect(blogPath('en', 'a')).toBe('/en/blog/a')
    expect(tagPath('en', 'release')).toBe('/en/blog/tag/release')
    expect(rssPath('nl')).toBe('/blog/rss.xml')
    expect(otherLocale('nl')).toBe('en')
  })

  it('has every UI string in both locales', () => {
    for (const key of ['tag', 'title', 'intro', 'back', 'tagged', 'by'] as const) {
      expect(t('nl', key)).not.toBe('')
      expect(t('en', key)).not.toBe('')
    }
  })
})

describe('HTML builders', () => {
  const p = toPostMeta(entry({ ...valid, title: 'A <b> title', tags: ['release'] }))

  it('renders escaped meta with author, time and tag links', () => {
    const html = postMetaHtml(p, 'en')
    expect(html).toContain('by Stefan van der Kort')
    expect(html).toContain('<time datetime="2026-09-28">September 28, 2026</time>')
    expect(html).toContain('<a href="/en/blog/tag/release">#release</a>')
  })

  it('renders a card with an h2 link, escaped title and the given cover HTML', () => {
    const html = postCardHtml(p, 'en', '<img src="c.webp" alt="c">')
    expect(html).toContain('<h2><a href="/en/blog/hello">A &lt;b&gt; title</a></h2>')
    expect(html).toContain('<img src="c.webp" alt="c">')
    expect(html).toContain('<p>Desc</p>')
  })

  it('builds BlogPosting JSON-LD', () => {
    const data = blogPostingJsonLd(p, 'en')
    expect(data).toMatchObject({
      '@type': 'BlogPosting',
      headline: 'A <b> title',
      inLanguage: 'en',
      datePublished: '2026-09-28',
      url: 'https://waldjs.eu/en/blog/hello',
      author: { '@type': 'Person', name: 'Stefan van der Kort' },
    })
  })
})
```

- [ ] **Step 2: Run to verify they fail**

Run: `cd marketing && npx vitest run src/lib/blog.test.ts`
Expected: FAIL — module `./blog` does not exist.

- [ ] **Step 3: Implement**

`marketing/src/lib/blog.ts`:

```ts
import { escapeHtml } from './html'
import { SITE_URL, type Locale } from './head'

export type { Locale }

export type BlogEntry = {
  slug: string
  locale?: string
  data: Record<string, unknown>
  body: string
}

export type PostMeta = {
  slug: string
  title: string
  description: string
  date: Date
  author: string
  authorAvatar?: string
  tags: string[]
  cover?: string
  coverAlt?: string
}

const KEBAB = /^[a-z0-9]+(-[a-z0-9]+)*$/

export function toPostMeta(entry: BlogEntry): PostMeta {
  const file = `blog/${entry.locale ?? ''}/${entry.slug}.md`.replace('//', '/')
  const d = entry.data
  for (const field of ['title', 'description', 'date', 'author']) {
    if (d[field] === undefined || d[field] === null || d[field] === '') {
      throw new Error(`${file}: missing "${field}"`)
    }
  }
  const date = d.date instanceof Date ? d.date : new Date(String(d.date))
  if (Number.isNaN(date.getTime())) throw new Error(`${file}: invalid "date"`)
  if (d.cover && !d.coverAlt) throw new Error(`${file}: "cover" requires "coverAlt"`)
  const tags = Array.isArray(d.tags) ? d.tags.map(String) : []
  for (const tag of tags) {
    if (!KEBAB.test(tag)) throw new Error(`${file}: tag "${tag}" must be kebab-case`)
  }
  return {
    slug: entry.slug,
    title: String(d.title),
    description: String(d.description),
    date,
    author: String(d.author),
    authorAvatar: d.authorAvatar ? String(d.authorAvatar) : undefined,
    tags,
    cover: d.cover ? String(d.cover) : undefined,
    coverAlt: d.coverAlt ? String(d.coverAlt) : undefined,
  }
}

export function sortByDate<T extends { date: Date }>(posts: T[]): T[] {
  return [...posts].sort((a, b) => b.date.getTime() - a.date.getTime())
}

export function collectTags(posts: PostMeta[]): string[] {
  return [...new Set(posts.flatMap(post => post.tags))].sort()
}

export function formatDate(date: Date, locale: Locale): string {
  return new Intl.DateTimeFormat(locale === 'nl' ? 'nl-NL' : 'en-US', { dateStyle: 'long', timeZone: 'UTC' }).format(date)
}

export function otherLocale(locale: Locale): Locale {
  return locale === 'nl' ? 'en' : 'nl'
}

const prefix = (locale: Locale) => (locale === 'en' ? '/en/blog' : '/blog')

export function blogPath(locale: Locale, slug?: string): string {
  return slug ? `${prefix(locale)}/${slug}` : prefix(locale)
}

export function tagPath(locale: Locale, tag: string): string {
  return `${prefix(locale)}/tag/${tag}`
}

export function rssPath(locale: Locale): string {
  return `${prefix(locale)}/rss.xml`
}

const STRINGS = {
  nl: {
    tag: 'Blog',
    title: 'Blog',
    intro: 'Verhalen uit het bos: releases, ontwerpkeuzes en hoe WaldJS groeit.',
    back: 'Terug naar alle posts',
    tagged: 'Posts met tag',
    by: 'door',
  },
  en: {
    tag: 'Blog',
    title: 'Blog',
    intro: 'Stories from the forest: releases, design decisions and how WaldJS grows.',
    back: 'Back to all posts',
    tagged: 'Posts tagged',
    by: 'by',
  },
} as const

export function t(locale: Locale, key: keyof (typeof STRINGS)['nl']): string {
  return STRINGS[locale][key]
}

const isoDate = (date: Date) => date.toISOString().slice(0, 10)

export function postMetaHtml(post: PostMeta, locale: Locale): string {
  const avatar = post.authorAvatar
    ? `<img class="blog-avatar" src="${escapeHtml(post.authorAvatar)}" alt="" width="32" height="32" loading="lazy">`
    : ''
  const tags = post.tags.length
    ? `<ul class="blog-tags" aria-label="Tags">${post.tags
        .map(tag => `<li><a href="${tagPath(locale, tag)}">#${escapeHtml(tag)}</a></li>`)
        .join('')}</ul>`
    : ''
  return `<div class="blog-meta">${avatar}<span>${t(locale, 'by')} ${escapeHtml(post.author)}</span> · <time datetime="${isoDate(post.date)}">${formatDate(post.date, locale)}</time>${tags}</div>`
}

export function postCardHtml(post: PostMeta, locale: Locale, coverHtml: string): string {
  const cover = coverHtml ? `<div class="blog-cover">${coverHtml}</div>` : ''
  return `<article class="log-kaart blog-kaart">${cover}<h2><a href="${blogPath(locale, post.slug)}">${escapeHtml(post.title)}</a></h2>${postMetaHtml(post, locale)}<p>${escapeHtml(post.description)}</p></article>`
}

export function blogPostingJsonLd(post: PostMeta, locale: Locale): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description: post.description,
    inLanguage: locale,
    datePublished: isoDate(post.date),
    url: SITE_URL + blogPath(locale, post.slug),
    ...(post.cover ? { image: SITE_URL + post.cover } : {}),
    author: { '@type': 'Person', name: post.author },
    publisher: { '@type': 'Organization', name: 'WaldJS', url: `${SITE_URL}/` },
  }
}
```

- [ ] **Step 4: Run to verify they pass**

Run: `cd marketing && npx vitest run src/lib`
Expected: PASS. If the `formatDate` expectation differs only in whitespace/ICU data, check `node -p "process.versions.icu"` — Node ≥ 22 ships full ICU; do not change the expectation to match a small-ICU build.

- [ ] **Step 5: Commit**

```bash
git add marketing/src/lib/blog.ts marketing/src/lib/blog.test.ts
git commit -m "feat(marketing): blog view helpers with frontmatter validation"
```

---

### Task 3: Fixed-language support in Layout, Nav and site.js

**Files:**
- Modify: `marketing/src/layouts/Layout.wald`
- Modify: `marketing/src/components/Nav.wald`
- Modify: `marketing/src/assets/js/site.js` (the stored-language block right after `function zetTaal`)
- Modify: `marketing/src/styles/partials/03-nav.css`
- Test: `marketing/src/smoke.test.ts`

Existing pages pass none of the new props and must render exactly as before (apart from an empty `data-lang-fixed=""` attribute and the Blog nav link). The existing smoke tests guard that.

- [ ] **Step 1: Add failing smoke assertions for the unchanged homepage + nav link**

In `marketing/src/smoke.test.ts`, before the final `})` of the `describe`, add:

```ts
  it('houdt de taal-bootstrap op pagina\'s zonder vaste taal en linkt naar de blog', () => {
    const html = readFileSync(join(ROOT, 'dist/index.html'), 'utf-8')
    expect(html).toContain('<html lang="nl" data-lang="nl" data-lang-fixed="">')
    expect(html).toContain(`localStorage.getItem('wald-taal')`)
    expect(html).toContain(`<button id="btn-nl" class="actief" onclick="zetTaal('nl')">NL</button>`)
    expect((html.match(/<a href="\/blog"/g) ?? []).length, 'blog links in desktop + mobile nav').toBe(2)
  })
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd marketing && node scripts/build-css.js public && npx vitest run src/smoke.test.ts`
Expected: the new test FAILS (no `data-lang-fixed`, no blog link); all other tests PASS.

- [ ] **Step 3: Update `Layout.wald`**

Replace the frontmatter (between the first two `---` lines) with:

```js
import Nav from '../components/Nav.wald'
import Footer from '../components/Footer.wald'
import CanopyPing from '../components/CanopyPing.wald'
import {
  SITE_URL,
  DEFAULT_OG_IMAGE,
  LANG_BOOTSTRAP_SCRIPT,
  SOFTWARE_APPLICATION_JSON_LD,
  alternateLinksHtml,
  jsonLdTag,
  rssLinkHtml,
} from '../lib/head'
// lang: set only on pages whose URL fixes the language (the blog). Then the
// HTML is correct without JS and the localStorage bootstrap is left out.
const { title, description, canonicalPath, pond, lang, alternates, langLinks, ogImage, ogType, jsonLd, rss } = $$props
const canonicalUrl = SITE_URL + canonicalPath
const ogImageUrl = ogImage ?? DEFAULT_OG_IMAGE
const htmlLang = lang ?? 'nl'
const fixedLang = lang ?? ''
const bootstrapScript = new SafeHtml(lang ? '' : LANG_BOOTSTRAP_SCRIPT)
const headLinks = new SafeHtml([alternateLinksHtml(alternates), rssLinkHtml(rss)].filter(Boolean).join('\n'))
const structuredData = new SafeHtml(jsonLdTag(jsonLd ?? SOFTWARE_APPLICATION_JSON_LD))
```

In the template:
- Replace `<html lang="nl" data-lang="nl">` with `<html lang={htmlLang} data-lang={htmlLang} data-lang-fixed={fixedLang}>`.
- Replace the whole `<script data-wald-no-hoist>…</script>` line with `{bootstrapScript}`.
- Replace `<meta property="og:type" content="website">` with `<meta property="og:type" content={ogType ?? 'website'}>`.
- Replace both `content={ogImage}` occurrences (og:image and twitter:image) with `content={ogImageUrl}`.
- Directly after `<link rel="canonical" href={canonicalUrl}>` add a line `{headLinks}`.
- Replace the whole literal `<script type="application/ld+json"> … </script>` block (from the opening tag through its closing `</script>`) with `{structuredData}`.
- Replace `<Nav canonicalPath={canonicalPath} />` with `<Nav canonicalPath={canonicalPath} lang={lang} langLinks={langLinks} />`.

- [ ] **Step 4: Update `Nav.wald`**

Replace the frontmatter with:

```js
import { langSwitchHtml } from '../lib/head'
const { canonicalPath, lang, langLinks } = $$props
const changelogCurrent = canonicalPath === '/changelog' ? 'page' : 'false'
const waaromCurrent = canonicalPath === '/waarom' ? 'page' : 'false'
const blogHref = lang === 'en' ? '/en/blog' : '/blog'
const blogCurrent = canonicalPath === blogHref ? 'page' : 'false'
const langSwitch = new SafeHtml(langSwitchHtml(lang, langLinks))
```

In the template:
- After the Changelog `<li>` in `ul.links-kant` add: `<li class="verberg"><a href={blogHref} aria-current={blogCurrent}>Blog</a></li>`
- After the Changelog `<a>` in `#mobielmenu` add: `<a href={blogHref} onclick="toggleMenu(false)" aria-current={blogCurrent}>Blog</a>`
- Replace the whole `<div class="lang-switch" …> … </div>` block (both buttons) with `{langSwitch}`.

Note the smoke assertion counts `<a href="/blog"` — keep `href` as the first attribute on both new links.

- [ ] **Step 5: Update `site.js`**

Replace:

```js
try {
  const bewaard = localStorage.getItem('wald-taal');
  if (bewaard === 'nl' || bewaard === 'en') zetTaal(bewaard);
} catch(e){}
```

with:

```js
try {
  // Pagina's met een vaste taal (de blog) negeren de bewaarde voorkeur en
  // onthouden juist hun eigen taal, zodat de rest van de site daarna meegaat.
  const vast = document.documentElement.dataset.langFixed;
  if (vast === 'nl' || vast === 'en') localStorage.setItem('wald-taal', vast);
  else {
    const bewaard = localStorage.getItem('wald-taal');
    if (bewaard === 'nl' || bewaard === 'en') zetTaal(bewaard);
  }
} catch(e){}
```

- [ ] **Step 6: Let the language-switch styles cover links**

In `marketing/src/styles/partials/03-nav.css`, replace every selector `.lang-switch button` (including `:hover`, `:focus-visible`, `.actief` variants) with `.lang-switch :is(button, a)`, e.g. `.lang-switch button.actief` → `.lang-switch :is(button, a).actief`. Then add at the end of the `.lang-switch :is(button, a)` base rule: `text-decoration: none;`.

Run: `grep -n "lang-switch" marketing/src/styles/partials/03-nav.css`
Expected: no remaining `.lang-switch button` selectors.

- [ ] **Step 7: Run the smoke tests**

Run: `cd marketing && node scripts/build-css.js public && npx vitest run`
Expected: all tests PASS, including the pre-existing JSON-LD test (`JSON.parse` of the ld+json block, `@type` SoftwareApplication) and the "no unsanctioned inline scripts" test.

- [ ] **Step 8: Commit**

```bash
git add marketing/src/layouts/Layout.wald marketing/src/components/Nav.wald marketing/src/assets/js/site.js marketing/src/styles/partials/03-nav.css marketing/src/smoke.test.ts
git commit -m "feat(marketing): fixed-language pages and blog link in the nav"
```

---

### Task 4: Blog pages, first post and styles

**Files:**
- Create: `marketing/src/components/BlogList.wald`, `BlogIndexPage.wald`, `BlogPostPage.wald`, `BlogTagPage.wald`
- Create: `marketing/src/pages/blog/index.wald`, `marketing/src/pages/blog/[slug].wald`, `marketing/src/pages/blog/tag/[tag].wald`
- Create: `marketing/src/pages/en/blog/index.wald`, `marketing/src/pages/en/blog/[slug].wald`, `marketing/src/pages/en/blog/tag/[tag].wald`
- Create: `marketing/content/blog/nl/content-locales.md`, `marketing/content/blog/en/content-locales.md`
- Create: `marketing/src/assets/blog/content-locales.jpg`
- Create: `marketing/src/styles/partials/30-blog.css`; Modify: `marketing/src/styles/site.css`
- Test: `marketing/src/smoke.test.ts`

- [ ] **Step 1: Add failing smoke tests**

In `marketing/src/smoke.test.ts`, before the final `})`, add:

```ts
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

  it('zet aria-current op de Blog-link van de blog-index', () => {
    const html = readFileSync(join(ROOT, 'dist/en/blog/index.html'), 'utf-8')
    expect((html.match(/href="\/en\/blog"[^>]*aria-current="page"/g) ?? []).length).toBe(2)
  })
```

Also extend the `pages` array in the existing test `heeft geldige koppen-volgorde (geen niveau overslaan) op elk paginatype` with:

```ts
      'dist/blog/index.html',
      'dist/en/blog/content-locales/index.html',
      'dist/blog/tag/release/index.html',
```

- [ ] **Step 2: Run to verify they fail**

Run: `cd marketing && npx vitest run src/smoke.test.ts`
Expected: the 5 new tests and the heading-order test FAIL (pages missing).

- [ ] **Step 3: Create the cover image**

A 1200×630 JPG rendered from the existing brand OG artwork:

```bash
mkdir -p marketing/src/assets/blog
pnpm --filter @waldjs/cli exec node -e "require('sharp')('$(pwd)/marketing/src/assets/og-image.svg',{density:200}).resize(1200,630,{fit:'cover'}).flatten({background:'#023B2D'}).jpeg({quality:82}).toFile('$(pwd)/marketing/src/assets/blog/content-locales.jpg').then(i=>console.log(i.width,i.height))"
```
Expected output: `1200 630`. Open the file and check it looks like the WaldJS OG image (logo on dark green).

- [ ] **Step 4: Write the first post (NL + EN)**

`marketing/content/blog/nl/content-locales.md`:

```markdown
---
title: "Meertalige content in WaldJS"
description: "Content-collecties kunnen nu een map per taal hebben. Zo werkt het, en waarom deze blog de eerste gebruiker is."
date: 2026-09-28
author: "Stefan van der Kort"
tags: [release, content, i18n]
cover: "/assets/blog/content-locales.jpg"
coverAlt: "Het WaldJS-logo, een witte boom, op een donkergroene achtergrond"
---
Deze blog is de eerste plek op waldjs.eu met een aparte Nederlandse en Engelse pagina per artikel. Daarvoor hadden we iets nodig wat WaldJS nog niet kon: content in meerdere talen.

## Een map per taal

Sinds `@waldjs/content` 0.2 mag een collectie submappen hebben met een taalcode als naam:

```
content/blog/nl/content-locales.md
content/blog/en/content-locales.md
```

Een bestand met dezelfde naam in twee taalmappen is een vertaling. Collecties zonder taalmappen werken precies zoals altijd.

## Drie functies

- `getCollection('blog', { locale: 'nl' })` geeft alleen de Nederlandse posts.
- `getEntry('blog', slug, { locale: 'nl' })` haalt één post op, en geeft een duidelijke fout als je vergeet welke taal je bedoelt.
- `getTranslations('blog', slug)` geeft alle vertalingen van een post, zodat een pagina naar zijn tegenhanger kan linken.

## Waarom losse pagina's per taal

De rest van de site wisselt van taal in de browser. Voor lange artikelen is een eigen URL per taal beter: zoekmachines zien één taal per pagina, `lang` en `hreflang` kloppen zonder JavaScript, en je downloadt alleen de tekst die je leest.

Lees ook de [documentatie over locales](https://github.com/Stefan-Espant/WaldJS#locales).
```

`marketing/content/blog/en/content-locales.md`:

```markdown
---
title: "Multilingual content in WaldJS"
description: "Content collections can now hold one directory per language. Here's how it works, and why this blog is its first user."
date: 2026-09-28
author: "Stefan van der Kort"
tags: [release, content, i18n]
cover: "/assets/blog/content-locales.jpg"
coverAlt: "The WaldJS logo, a white tree, on a dark green background"
---
This blog is the first place on waldjs.eu with a separate Dutch and English page per article. That needed something WaldJS couldn't do yet: content in more than one language.

## One directory per language

Since `@waldjs/content` 0.2, a collection can have subdirectories named after a locale code:

```
content/blog/nl/content-locales.md
content/blog/en/content-locales.md
```

A file with the same name in two locale directories is a translation. Collections without locale directories work exactly as before.

## Three functions

- `getCollection('blog', { locale: 'en' })` returns only the English posts.
- `getEntry('blog', slug, { locale: 'en' })` fetches one post, with a clear error if you forget which language you meant.
- `getTranslations('blog', slug)` returns every translation of a post, so a page can link to its counterpart.

## Why separate pages per language

The rest of the site switches language in the browser. For long articles a URL per language is better: search engines see one language per page, `lang` and `hreflang` are right without JavaScript, and you only download the text you read.

See also the [locales documentation](https://github.com/Stefan-Espant/WaldJS#locales).
```

Check the version claim: run `node -p "require('./packages/content/package.json').version"`. If `main` still says `0.1.0` (the changeset bumps it on release), replace "Sinds `@waldjs/content` 0.2" / "Since `@waldjs/content` 0.2" with "Sinds de nieuwste versie van `@waldjs/content`" / "Since the latest `@waldjs/content`".

- [ ] **Step 5: Create `BlogList.wald`**

`marketing/src/components/BlogList.wald`:

```wald
---
import { Image } from 'wald:image'
import { postCardHtml, sortByDate } from '../lib/blog'
const { posts, locale } = $$props
const cards = await Promise.all(
  sortByDate(posts).map(async post => {
    const cover = post.cover
      ? await Image.render({ src: post.cover, alt: post.coverAlt, widths: [400, 800], sizes: '(max-width: 47.5rem) 100vw, 47.5rem' })
      : ''
    return postCardHtml(post, locale, cover)
  }),
)
---
<div class="changelog blog-lijst">
  {new SafeHtml(cards.join(''))}
</div>
```

- [ ] **Step 6: Create `BlogIndexPage.wald`**

`marketing/src/components/BlogIndexPage.wald`:

```wald
---
import Layout from '../layouts/Layout.wald'
import BlogList from './BlogList.wald'
import { getCollection } from 'wald:content'
import { toPostMeta, blogPath, rssPath, t } from '../lib/blog'
const { locale } = $$props
const posts = (await getCollection('blog', { locale })).map(toPostMeta)
const paths = { nl: blogPath('nl'), en: blogPath('en') }
---
<Layout
  title="Blog — WaldJS"
  description={t(locale, 'intro')}
  canonicalPath={blogPath(locale)}
  lang={locale}
  alternates={paths}
  langLinks={paths}
  rss={rssPath(locale)}
>
  <section id="blog" class="pagina-intro">
    <div class="sectiekop">
      <span class="tag">{t(locale, 'tag')}</span>
      <h1>{t(locale, 'title')}</h1>
      <p>{t(locale, 'intro')}</p>
    </div>
    <BlogList posts={posts} locale={locale} />
  </section>
</Layout>
```

- [ ] **Step 7: Create `BlogPostPage.wald`**

`marketing/src/components/BlogPostPage.wald`:

```wald
---
import Layout from '../layouts/Layout.wald'
import { Image } from 'wald:image'
import { getEntry, getTranslations } from 'wald:content'
import { SITE_URL } from '../lib/head'
import { toPostMeta, blogPath, otherLocale, postMetaHtml, rssPath, t, blogPostingJsonLd } from '../lib/blog'
const { locale, slug } = $$props
const entry = await getEntry('blog', slug, { locale })
const post = toPostMeta(entry)
const translations = await getTranslations('blog', slug)
const other = otherLocale(locale)
const alternates = Object.fromEntries(Object.keys(translations).map(l => [l, blogPath(l, slug)]))
const langLinks = {
  [locale]: blogPath(locale, slug),
  [other]: translations[other] ? blogPath(other, slug) : blogPath(other),
}
const cover = post.cover
  ? await Image.render({ src: post.cover, alt: post.coverAlt, widths: [800, 1200], sizes: '(max-width: 47.5rem) 100vw, 47.5rem' })
  : ''
const ogImage = post.cover ? SITE_URL + post.cover : undefined
const meta = new SafeHtml(postMetaHtml(post, locale))
---
<Layout
  title={`${post.title} — WaldJS Blog`}
  description={post.description}
  canonicalPath={blogPath(locale, slug)}
  lang={locale}
  alternates={alternates}
  langLinks={langLinks}
  ogImage={ogImage}
  ogType="article"
  jsonLd={blogPostingJsonLd(post, locale)}
  rss={rssPath(locale)}
>
  <article id="blog-post" class="pagina-intro blog-post">
    <header class="sectiekop">
      <span class="tag">{t(locale, 'tag')}</span>
      <h1>{post.title}</h1>
      {meta}
    </header>
    <div class="blog-cover">{new SafeHtml(cover)}</div>
    <div class="log-kaart blog-body">
      {new SafeHtml(entry.body)}
    </div>
    <p><a href={blogPath(locale)}>← {t(locale, 'back')}</a></p>
  </article>
</Layout>
```

- [ ] **Step 8: Create `BlogTagPage.wald`**

`marketing/src/components/BlogTagPage.wald`:

```wald
---
import Layout from '../layouts/Layout.wald'
import BlogList from './BlogList.wald'
import { getCollection } from 'wald:content'
import { toPostMeta, blogPath, tagPath, otherLocale, rssPath, t } from '../lib/blog'
const { locale, tag } = $$props
const other = otherLocale(locale)
const posts = (await getCollection('blog', { locale })).map(toPostMeta).filter(p => p.tags.includes(tag))
const otherHasTag = (await getCollection('blog', { locale: other })).map(toPostMeta).some(p => p.tags.includes(tag))
const alternates = otherHasTag ? { [locale]: tagPath(locale, tag), [other]: tagPath(other, tag) } : undefined
const langLinks = { [locale]: tagPath(locale, tag), [other]: otherHasTag ? tagPath(other, tag) : blogPath(other) }
---
<Layout
  title={`#${tag} — WaldJS Blog`}
  description={`${t(locale, 'tagged')} #${tag}`}
  canonicalPath={tagPath(locale, tag)}
  lang={locale}
  alternates={alternates}
  langLinks={langLinks}
  rss={rssPath(locale)}
>
  <section id="blog-tag" class="pagina-intro">
    <div class="sectiekop">
      <span class="tag">{t(locale, 'tag')}</span>
      <h1>{t(locale, 'tagged')} #{tag}</h1>
    </div>
    <BlogList posts={posts} locale={locale} />
    <p><a href={blogPath(locale)}>← {t(locale, 'back')}</a></p>
  </section>
</Layout>
```

- [ ] **Step 9: Create the six route files**

`marketing/src/pages/blog/index.wald`:

```wald
---
import BlogIndexPage from '../../components/BlogIndexPage.wald'
---
<BlogIndexPage locale="nl" />
```

`marketing/src/pages/en/blog/index.wald`:

```wald
---
import BlogIndexPage from '../../../components/BlogIndexPage.wald'
---
<BlogIndexPage locale="en" />
```

`marketing/src/pages/blog/[slug].wald`:

```wald
---
import BlogPostPage from '../../components/BlogPostPage.wald'
import { getCollection } from 'wald:content'

export async function getStaticPaths() {
  const posts = await getCollection('blog', { locale: 'nl' })
  return posts.map(post => ({ params: { slug: post.slug } }))
}
---
<BlogPostPage locale="nl" slug={$$props.slug} />
```

`marketing/src/pages/en/blog/[slug].wald`:

```wald
---
import BlogPostPage from '../../../components/BlogPostPage.wald'
import { getCollection } from 'wald:content'

export async function getStaticPaths() {
  const posts = await getCollection('blog', { locale: 'en' })
  return posts.map(post => ({ params: { slug: post.slug } }))
}
---
<BlogPostPage locale="en" slug={$$props.slug} />
```

`marketing/src/pages/blog/tag/[tag].wald`:

```wald
---
import BlogTagPage from '../../../components/BlogTagPage.wald'
import { getCollection } from 'wald:content'
import { collectTags, toPostMeta } from '../../../lib/blog'

export async function getStaticPaths() {
  const posts = (await getCollection('blog', { locale: 'nl' })).map(toPostMeta)
  return collectTags(posts).map(tag => ({ params: { tag } }))
}
---
<BlogTagPage locale="nl" tag={$$props.tag} />
```

`marketing/src/pages/en/blog/tag/[tag].wald`:

```wald
---
import BlogTagPage from '../../../../components/BlogTagPage.wald'
import { getCollection } from 'wald:content'
import { collectTags, toPostMeta } from '../../../../lib/blog'

export async function getStaticPaths() {
  const posts = (await getCollection('blog', { locale: 'en' })).map(toPostMeta)
  return collectTags(posts).map(tag => ({ params: { tag } }))
}
---
<BlogTagPage locale="en" tag={$$props.tag} />
```

- [ ] **Step 10: Styles**

Create `marketing/src/styles/partials/30-blog.css`:

```css
/* ---------- blog ---------- */
.blog-kaart h2 {
  margin: 0 0 .5rem;
  font-size: 1.5rem
}

.blog-kaart h2 a {
  color: inherit;
  text-decoration: none
}

.blog-kaart h2 a:hover,
.blog-kaart h2 a:focus-visible {
  text-decoration: underline
}

.blog-cover img {
  display: block;
  width: 100%;
  height: auto;
  border-radius: .75rem;
  margin-bottom: 1rem
}

.blog-post .blog-cover {
  max-width: 47.5rem;
  margin: 0 auto 1.5rem
}

.blog-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: .5rem;
  color: var(--wit-zacht);
  font-size: .9rem
}

.blog-avatar {
  border-radius: 50%
}

.blog-tags {
  display: flex;
  flex-wrap: wrap;
  gap: .375rem;
  list-style: none;
  margin: 0;
  padding: 0
}

.blog-tags a {
  color: var(--wit-zacht);
  text-decoration: none;
  border: 0.0625rem solid rgba(255, 255, 255, .18);
  border-radius: 999rem;
  padding: .125rem .5rem
}

.blog-tags a:hover,
.blog-tags a:focus-visible {
  color: var(--wit);
  border-color: var(--rood)
}

.blog-body {
  max-width: 47.5rem;
  margin: 0 auto 1.5rem;
  line-height: 1.7
}

.blog-body h2 {
  margin-top: 2rem
}

.blog-body pre {
  overflow-x: auto
}
```

In `marketing/src/styles/site.css`, add after the `29-mobiel.css` import:

```css
@import "./partials/30-blog.css";
```

- [ ] **Step 11: Run the smoke tests**

Run: `cd marketing && node scripts/build-css.js public && npx vitest run`
Expected: all tests PASS. If the `og:image` or cover assertions fail, check that `dist/assets/blog/content-locales.jpg` exists (src/assets is copied to dist/assets) and that `Image.render` produced `.webp` variants under `dist/assets/optimized/`.

- [ ] **Step 12: Commit**

```bash
git add marketing/src/components/BlogList.wald marketing/src/components/BlogIndexPage.wald marketing/src/components/BlogPostPage.wald marketing/src/components/BlogTagPage.wald marketing/src/pages/blog marketing/src/pages/en marketing/content/blog marketing/src/assets/blog marketing/src/styles/partials/30-blog.css marketing/src/styles/site.css marketing/src/smoke.test.ts
git commit -m "feat(marketing): bilingual blog with post, tag pages and first post"
```

---

### Task 5: RSS feeds

**Files:**
- Create: `marketing/scripts/build-rss.mjs`, `marketing/scripts/build-rss.test.ts`
- Modify: `marketing/package.json` (dependency + `build` script), `marketing/scripts/vercel-build.mjs`, `pnpm-lock.yaml`

- [ ] **Step 1: Add the dependency**

In `marketing/package.json` `dependencies`, add `"@waldjs/content": "workspace:*"` (keep alphabetical order: after `@waldjs/cli`). Run `pnpm install` at the repo root.
Expected: `pnpm-lock.yaml` changes only in the `marketing` importer section.

- [ ] **Step 2: Write the failing test**

`marketing/scripts/build-rss.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { execFileSync } from 'node:child_process'

describe('build-rss.mjs', () => {
  let root: string

  beforeAll(() => {
    root = mkdtempSync(join(tmpdir(), 'wald-rss-'))
    mkdirSync(join(root, 'content/blog/nl'), { recursive: true })
    mkdirSync(join(root, 'content/blog/en'), { recursive: true })
    mkdirSync(join(root, 'dist'), { recursive: true })
    writeFileSync(
      join(root, 'content/blog/nl/oud.md'),
      '---\ntitle: "Oud"\ndescription: "Eerste"\ndate: 2026-01-01\nauthor: "A"\ntags: [release]\n---\nx',
    )
    writeFileSync(
      join(root, 'content/blog/nl/nieuw.md'),
      '---\ntitle: "Nieuw & <beter>"\ndescription: "Tweede"\ndate: 2026-09-01\nauthor: "A"\n---\nx',
    )
    writeFileSync(
      join(root, 'content/blog/en/new.md'),
      '---\ntitle: "New"\ndescription: "Second"\ndate: 2026-09-01\nauthor: "A"\n---\nx',
    )
    execFileSync(process.execPath, [join(__dirname, 'build-rss.mjs'), root, 'https://example.com'], { stdio: 'pipe' })
  })

  afterAll(() => {
    rmSync(root, { recursive: true, force: true })
  })

  it('writes one RSS 2.0 feed per locale', () => {
    const nl = readFileSync(join(root, 'dist/blog/rss.xml'), 'utf-8')
    const en = readFileSync(join(root, 'dist/en/blog/rss.xml'), 'utf-8')
    expect(nl.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true)
    expect(nl).toContain('<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">')
    expect(nl).toContain('<language>nl</language>')
    expect(nl).toContain('<atom:link href="https://example.com/blog/rss.xml" rel="self" type="application/rss+xml"/>')
    expect(en).toContain('<language>en</language>')
    expect(en).toContain('<link>https://example.com/en/blog/new</link>')
  })

  it('orders items newest first and escapes XML', () => {
    const nl = readFileSync(join(root, 'dist/blog/rss.xml'), 'utf-8')
    expect(nl.indexOf('nieuw')).toBeLessThan(nl.indexOf('/blog/oud'))
    expect(nl).toContain('<title>Nieuw &amp; &lt;beter&gt;</title>')
    expect(nl).toContain('<guid isPermaLink="true">https://example.com/blog/oud</guid>')
    expect(nl).toContain('<pubDate>Thu, 01 Jan 2026 00:00:00 GMT</pubDate>')
    expect(nl).toContain('<category>release</category>')
  })
})
```

- [ ] **Step 3: Run to verify it fails**

Run: `cd marketing && npx vitest run scripts/build-rss.test.ts`
Expected: FAIL — `build-rss.mjs` does not exist.

- [ ] **Step 4: Implement**

`marketing/scripts/build-rss.mjs`:

```js
#!/usr/bin/env node
// Writes dist/blog/rss.xml and dist/en/blog/rss.xml from the blog content
// collection. Runs after `wald build` (like build-sitemap.mjs) and reads the
// Markdown directly through @waldjs/content's locale API. Kept free of
// marketing-specific imports so it can move into an official integration (#75).
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { readCollection } from '@waldjs/content'

const root = process.argv[2] ?? process.cwd()
const baseUrl = (process.argv[3] ?? 'https://waldjs.eu').replace(/\/$/, '')
const contentDir = join(root, 'content')

const FEEDS = {
  nl: { prefix: '/blog', title: 'WaldJS Blog', description: 'Verhalen uit het bos: releases, ontwerpkeuzes en hoe WaldJS groeit.' },
  en: { prefix: '/en/blog', title: 'WaldJS Blog', description: 'Stories from the forest: releases, design decisions and how WaldJS grows.' },
}

function escapeXml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function toDate(value) {
  return value instanceof Date ? value : new Date(String(value))
}

for (const [locale, feed] of Object.entries(FEEDS)) {
  const entries = (await readCollection('blog', contentDir, { locale })).sort(
    (a, b) => toDate(b.data.date).getTime() - toDate(a.data.date).getTime(),
  )
  const items = entries
    .map(entry => {
      const url = `${baseUrl}${feed.prefix}/${entry.slug}`
      const categories = (Array.isArray(entry.data.tags) ? entry.data.tags : [])
        .map(tag => `      <category>${escapeXml(tag)}</category>`)
        .join('\n')
      return [
        '    <item>',
        `      <title>${escapeXml(entry.data.title)}</title>`,
        `      <link>${url}</link>`,
        `      <guid isPermaLink="true">${url}</guid>`,
        `      <pubDate>${toDate(entry.data.date).toUTCString()}</pubDate>`,
        `      <description>${escapeXml(entry.data.description)}</description>`,
        categories,
        '    </item>',
      ]
        .filter(Boolean)
        .join('\n')
    })
    .join('\n')

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(feed.title)}</title>
    <link>${baseUrl}${feed.prefix}</link>
    <description>${escapeXml(feed.description)}</description>
    <language>${locale}</language>
    <atom:link href="${baseUrl}${feed.prefix}/rss.xml" rel="self" type="application/rss+xml"/>
${items}
  </channel>
</rss>
`
  const outDir = join(root, 'dist', ...feed.prefix.split('/').filter(Boolean))
  mkdirSync(outDir, { recursive: true })
  writeFileSync(join(outDir, 'rss.xml'), xml)
  console.log(`rss: ${entries.length} ${locale} posts -> ${join(outDir, 'rss.xml')}`)
}
```

- [ ] **Step 5: Run to verify it passes**

Run: `cd marketing && npx vitest run scripts/build-rss.test.ts`
Expected: PASS.

- [ ] **Step 6: Wire into both build paths**

In `marketing/package.json`, change the `build` script to:

```json
"build": "wald build && node scripts/build-css.js dist && node scripts/build-sitemap.mjs . https://waldjs.eu && node scripts/build-rss.mjs . https://waldjs.eu",
```

In `marketing/scripts/vercel-build.mjs`, after the `build-sitemap.mjs` `execFileSync(...)` call, add:

```js
// RSS-feeds per taal uit de blog-collectie.
execFileSync(
  node,
  [join(marketingDir, 'scripts', 'build-rss.mjs'), marketingDir, 'https://waldjs.eu'],
  { cwd: marketingDir, stdio: 'inherit' },
)
```

Commit `1881208` fixed exactly this omission for the sitemap — the Vercel path must not be forgotten.

- [ ] **Step 7: Verify the real build**

Run: `pnpm --filter @waldjs/marketing build`
Expected: ends with `rss: 1 nl posts -> …/dist/blog/rss.xml` and `rss: 1 en posts -> …/dist/en/blog/rss.xml`; `sitemap:` line lists more routes than before (blog index ×2, post ×2, tag pages ×6).

- [ ] **Step 8: Commit**

```bash
git add marketing/scripts/build-rss.mjs marketing/scripts/build-rss.test.ts marketing/package.json marketing/scripts/vercel-build.mjs pnpm-lock.yaml
git commit -m "feat(marketing): RSS feed per blog language"
```

---

### Task 6: Live verification

Unit and smoke tests read static HTML; this checks the behaviour a visitor sees.

- [ ] **Step 1: Full marketing test run**

Run: `cd marketing && node scripts/build-css.js public && npx vitest run`
Expected: all tests PASS.

- [ ] **Step 2: Preview and check by hand**

Run: `pnpm --filter @waldjs/marketing build && cd marketing && node ../packages/cli/bin/wald.js preview`
In a browser (with an empty localStorage first, then with `wald-taal` = `nl`):
- `/en/blog` shows English nav and text even when the stored language is `nl`; after visiting it, `/` opens in English.
- The NL/EN switch on `/blog/content-locales` goes to `/en/blog/content-locales` and back; on a tag page for a tag without translation it goes to the other blog index.
- "Blog" appears in the desktop nav and the mobile menu; the mobile menu still opens, traps focus and closes.
- The cover image renders; `/blog/rss.xml` and `/en/blog/rss.xml` load as XML.
- Nothing else on `/`, `/changelog`, `/waarom` changed visually (language toggle buttons still work there).

- [ ] **Step 3: Check nothing leaked**

Run: `git status --short`
Expected: clean.
