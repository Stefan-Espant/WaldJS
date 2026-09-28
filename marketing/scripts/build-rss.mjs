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
