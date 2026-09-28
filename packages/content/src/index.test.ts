import { describe, it, expect, beforeEach } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { tmpdir } from 'node:os'
import { readCollection, readEntry, readTranslations } from './index.js'

let contentDir: string

beforeEach(() => {
  contentDir = mkdtempSync(join(tmpdir(), 'wald-content-'))
  mkdirSync(join(contentDir, 'blog'))
})

function write(rel: string, content: string) {
  const full = join(contentDir, rel)
  mkdirSync(dirname(full), { recursive: true })
  writeFileSync(full, content)
}

describe('readCollection', () => {
  it('returns all entries sorted by filename', async () => {
    writeFileSync(join(contentDir, 'blog', 'beta.md'), '---\ntitle: Beta\n---\nBody')
    writeFileSync(join(contentDir, 'blog', 'alpha.md'), '---\ntitle: Alpha\n---\nBody')
    const entries = await readCollection('blog', contentDir)
    expect(entries).toHaveLength(2)
    expect(entries[0].slug).toBe('alpha')
    expect(entries[1].slug).toBe('beta')
  })

  it('parses frontmatter into data', async () => {
    writeFileSync(join(contentDir, 'blog', 'post.md'), '---\ntitle: My Post\ndate: 2026-06-28\n---\nContent')
    const [entry] = await readCollection('blog', contentDir)
    expect(entry.data.title).toBe('My Post')
    expect(entry.data.date).toBeTruthy()
  })

  it('renders markdown body as HTML', async () => {
    writeFileSync(join(contentDir, 'blog', 'post.md'), '---\n---\n# Hello\n\nParagraph.')
    const [entry] = await readCollection('blog', contentDir)
    expect(entry.body).toContain('<h1>')
    expect(entry.body).toContain('<p>')
  })
})

describe('readEntry', () => {
  it('returns a single entry by slug', async () => {
    writeFileSync(join(contentDir, 'blog', 'hello-world.md'), '---\ntitle: Hello World\n---\nContent')
    const entry = await readEntry('blog', 'hello-world', contentDir)
    expect(entry.slug).toBe('hello-world')
    expect(entry.data.title).toBe('Hello World')
  })

  it('throws when entry does not exist', async () => {
    await expect(readEntry('blog', 'nonexistent', contentDir)).rejects.toThrow()
  })
})

describe('readCollection with locales', () => {
  it('returns unlocalized entries first, then each locale directory sorted by name', async () => {
    write('blog/top.md', '---\ntitle: Top\n---\n')
    write('blog/nl/hallo.md', '---\ntitle: Hallo\n---\n')
    write('blog/en/hello.md', '---\ntitle: Hello\n---\n')
    const entries = await readCollection('blog', contentDir)
    expect(entries.map(e => [e.locale, e.slug])).toEqual([
      [undefined, 'top'],
      ['en', 'hello'],
      ['nl', 'hallo'],
    ])
  })

  it('filters by locale', async () => {
    write('blog/nl/hallo.md', '---\ntitle: Hallo\n---\n')
    write('blog/en/hello.md', '---\ntitle: Hello\n---\n')
    const entries = await readCollection('blog', contentDir, { locale: 'nl' })
    expect(entries).toHaveLength(1)
    expect(entries[0].slug).toBe('hallo')
    expect(entries[0].locale).toBe('nl')
    expect(entries[0].data.title).toBe('Hallo')
  })

  it('returns an empty array for a locale without a directory', async () => {
    write('blog/nl/hallo.md', '---\ntitle: Hallo\n---\n')
    expect(await readCollection('blog', contentDir, { locale: 'en' })).toEqual([])
  })

  it('treats region codes as locales and ignores other subdirectories', async () => {
    write('blog/en-GB/colour.md', '---\ntitle: Colour\n---\n')
    write('blog/drafts/secret.md', '---\ntitle: Secret\n---\n')
    const entries = await readCollection('blog', contentDir)
    expect(entries.map(e => [e.locale, e.slug])).toEqual([['en-GB', 'colour']])
  })

  it('does not add a locale key to unlocalized entries', async () => {
    write('blog/post.md', '---\ntitle: Post\n---\n')
    const [entry] = await readCollection('blog', contentDir)
    expect('locale' in entry).toBe(false)
  })

  it('rejects a locale option that is not a locale code', async () => {
    await expect(readCollection('blog', contentDir, { locale: '../secret' })).rejects.toThrow(
      'Invalid locale "../secret"',
    )
  })
})

describe('readEntry with locales', () => {
  it('reads an entry from a locale directory', async () => {
    write('blog/en/hello.md', '---\ntitle: Hello\n---\nBody')
    const entry = await readEntry('blog', 'hello', contentDir, { locale: 'en' })
    expect(entry.slug).toBe('hello')
    expect(entry.locale).toBe('en')
    expect(entry.data.title).toBe('Hello')
  })

  it('still reads a top-level entry without a locale in a localized collection', async () => {
    write('blog/about.md', '---\ntitle: About\n---\n')
    write('blog/nl/hallo.md', '---\ntitle: Hallo\n---\n')
    const entry = await readEntry('blog', 'about', contentDir)
    expect(entry.data.title).toBe('About')
    expect('locale' in entry).toBe(false)
  })

  it('requires a locale when the collection has locales', async () => {
    write('blog/nl/hello.md', '---\ntitle: Hallo\n---\n')
    write('blog/en/hello.md', '---\ntitle: Hello\n---\n')
    await expect(readEntry('blog', 'hello', contentDir)).rejects.toThrow(
      'Collection "blog" has locales (en, nl) — pass { locale } to getEntry("blog", "hello")',
    )
  })

  it('names the collection, slug, locale and available locales when an entry is missing', async () => {
    write('blog/nl/hallo.md', '---\ntitle: Hallo\n---\n')
    write('blog/en/hello.md', '---\ntitle: Hello\n---\n')
    await expect(readEntry('blog', 'nope', contentDir, { locale: 'en' })).rejects.toThrow(
      'Entry "nope" not found in collection "blog" for locale "en" (available locales: en, nl)',
    )
  })

  it('gives a readable error for a missing unlocalized entry', async () => {
    await expect(readEntry('blog', 'nonexistent', contentDir)).rejects.toThrow(
      'Entry "nonexistent" not found in collection "blog"',
    )
  })

  it('rejects a locale option that is not a locale code', async () => {
    await expect(readEntry('blog', 'x', contentDir, { locale: 'EN' })).rejects.toThrow('Invalid locale "EN"')
  })
})

describe('readTranslations', () => {
  it('returns every locale that has the slug, keyed by locale', async () => {
    write('blog/nl/hello.md', '---\ntitle: Hallo\n---\n')
    write('blog/en/hello.md', '---\ntitle: Hello\n---\n')
    const translations = await readTranslations('blog', 'hello', contentDir)
    expect(Object.keys(translations).sort()).toEqual(['en', 'nl'])
    expect(translations.nl.data.title).toBe('Hallo')
    expect(translations.en.locale).toBe('en')
  })

  it('only includes locales where the slug exists', async () => {
    write('blog/nl/hello.md', '---\ntitle: Hallo\n---\n')
    write('blog/en/other.md', '---\ntitle: Other\n---\n')
    const translations = await readTranslations('blog', 'hello', contentDir)
    expect(Object.keys(translations)).toEqual(['nl'])
  })

  it('returns an empty object when no locale has the slug, ignoring top-level entries', async () => {
    write('blog/hello.md', '---\ntitle: Top\n---\n')
    write('blog/nl/other.md', '---\ntitle: Other\n---\n')
    expect(await readTranslations('blog', 'hello', contentDir)).toEqual({})
  })
})

describe('slug validation', () => {
  it('rejects slugs that would escape the collection', async () => {
    write('blog/en/hello.md', '---\ntitle: Hello\n---\n')
    await expect(readEntry('blog', '../../secret', contentDir, { locale: 'en' })).rejects.toThrow('Invalid slug "../../secret"')
    await expect(readEntry('blog', 'a/b', contentDir)).rejects.toThrow('Invalid slug "a/b"')
    await expect(readTranslations('blog', '../x', contentDir)).rejects.toThrow('Invalid slug "../x"')
  })
})
