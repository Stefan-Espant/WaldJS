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
