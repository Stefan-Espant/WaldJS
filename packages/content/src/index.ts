import { existsSync } from 'node:fs'
import { readdir, readFile } from 'node:fs/promises'
import { join, basename } from 'node:path'
import matter from 'gray-matter'
import { marked } from 'marked'

export type Entry = {
  slug: string
  locale?: string
  data: Record<string, unknown>
  body: string
}

export type LocaleOptions = {
  locale?: string
}

// A collection subdirectory with a name like `nl`, `en` or `en-GB` holds that
// locale's entries. Anything else stays ignored, as before locales existed.
const LOCALE_PATTERN = /^[a-z]{2}(-[A-Z]{2})?$/

function assertLocale(locale: string): void {
  if (!LOCALE_PATTERN.test(locale)) {
    throw new Error(`Invalid locale "${locale}" — expected a code like "nl", "en" or "en-GB"`)
  }
}

function assertSlug(slug: string): void {
  if (slug === '' || slug.includes('/') || slug.includes('\\') || slug.startsWith('.')) {
    throw new Error(`Invalid slug "${slug}" — expected a file name without path separators`)
  }
}

async function listLocales(collection: string, contentDir: string): Promise<string[]> {
  const dir = join(contentDir, collection)
  if (!existsSync(dir)) return []
  const dirents = await readdir(dir, { withFileTypes: true })
  return dirents
    .filter(d => d.isDirectory() && LOCALE_PATTERN.test(d.name))
    .map(d => d.name)
    .sort()
}

async function listMarkdown(dir: string): Promise<string[]> {
  return (await readdir(dir)).filter(f => f.endsWith('.md')).sort()
}

export async function readCollection(
  name: string,
  contentDir: string,
  options: LocaleOptions = {},
): Promise<Entry[]> {
  const dir = join(contentDir, name)

  if (options.locale !== undefined) {
    const { locale } = options
    assertLocale(locale)
    const localeDir = join(dir, locale)
    if (!existsSync(localeDir)) return []
    const files = await listMarkdown(localeDir)
    return Promise.all(files.map(file => parseEntry(join(localeDir, file), locale)))
  }

  const files = await listMarkdown(dir)
  const entries = await Promise.all(files.map(file => parseEntry(join(dir, file))))
  for (const locale of await listLocales(name, contentDir)) {
    entries.push(...(await readCollection(name, contentDir, { locale })))
  }
  return entries
}

export async function readEntry(
  collection: string,
  slug: string,
  contentDir: string,
  options: LocaleOptions = {},
): Promise<Entry> {
  assertSlug(slug)
  const dir = join(contentDir, collection)
  const locales = await listLocales(collection, contentDir)

  if (options.locale !== undefined) {
    const { locale } = options
    assertLocale(locale)
    const file = join(dir, locale, `${slug}.md`)
    if (!existsSync(file)) {
      const available = locales.length > 0 ? locales.join(', ') : 'none'
      throw new Error(
        `Entry "${slug}" not found in collection "${collection}" for locale "${locale}" (available locales: ${available})`,
      )
    }
    return parseEntry(file, locale)
  }

  const file = join(dir, `${slug}.md`)
  if (existsSync(file)) return parseEntry(file)
  if (locales.length > 0) {
    throw new Error(
      `Collection "${collection}" has locales (${locales.join(', ')}) — pass { locale } to getEntry("${collection}", "${slug}")`,
    )
  }
  throw new Error(`Entry "${slug}" not found in collection "${collection}"`)
}

export async function readTranslations(
  collection: string,
  slug: string,
  contentDir: string,
): Promise<Record<string, Entry>> {
  assertSlug(slug)
  const translations: Record<string, Entry> = {}
  for (const locale of await listLocales(collection, contentDir)) {
    const file = join(contentDir, collection, locale, `${slug}.md`)
    if (existsSync(file)) translations[locale] = await parseEntry(file, locale)
  }
  return translations
}

async function parseEntry(filePath: string, locale?: string): Promise<Entry> {
  const raw = await readFile(filePath, 'utf8')
  const { data, content } = matter(raw)
  const body = await marked(content)
  const slug = basename(filePath, '.md')
  const entryData = data as Record<string, unknown>
  return locale === undefined
    ? { slug, data: entryData, body }
    : { slug, locale, data: entryData, body }
}
