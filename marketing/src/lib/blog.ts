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
  return `<article class="log-card blog-card">${cover}<h2><a href="${blogPath(locale, post.slug)}">${escapeHtml(post.title)}</a></h2>${postMetaHtml(post, locale)}<p>${escapeHtml(post.description)}</p></article>`
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
