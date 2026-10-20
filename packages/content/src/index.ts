import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
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

// Content doesn't change while a site renders, but the same files are read
// over and over: getStaticPaths() parses the whole collection, then every page
// calls getEntry() again, and each call used to re-read the directory listing.
// Both caches are keyed on the file system's own change markers (a directory's
// mtime changes when entries are added or removed; a file's mtime/size when it
// is edited), so `wald grow` still sees every edit without a restart.
type DirListing = { mtimeMs: number; markdown: string[]; locales: string[] }
const dirCache = new Map<string, DirListing>()

function listDir(dir: string): DirListing {
  const { mtimeMs } = statSync(dir)
  const cached = dirCache.get(dir)
  if (cached && cached.mtimeMs === mtimeMs) return cached
  const dirents = readdirSync(dir, { withFileTypes: true })
  const listing = {
    mtimeMs,
    markdown: dirents.filter(d => d.isFile() && d.name.endsWith('.md')).map(d => d.name).sort(),
    locales: dirents.filter(d => d.isDirectory() && LOCALE_PATTERN.test(d.name)).map(d => d.name).sort(),
  }
  dirCache.set(dir, listing)
  return listing
}

async function listLocales(collection: string, contentDir: string): Promise<string[]> {
  const dir = join(contentDir, collection)
  if (!existsSync(dir)) return []
  return listDir(dir).locales
}

async function listMarkdown(dir: string): Promise<string[]> {
  return listDir(dir).markdown
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

type CachedEntry = { mtimeMs: number; size: number; entry: Entry }
const entryCache = new Map<string, CachedEntry>()

async function parseEntry(filePath: string, locale?: string): Promise<Entry> {
  const { mtimeMs, size } = statSync(filePath)
  const cached = entryCache.get(filePath)
  if (cached && cached.mtimeMs === mtimeMs && cached.size === size) return copyEntry(cached.entry)

  const { data, content } = matter(readFileSync(filePath, 'utf8'))
  const body = await marked(content)
  const slug = basename(filePath, '.md')
  const entryData = data as Record<string, unknown>
  const entry: Entry = locale === undefined
    ? { slug, data: entryData, body }
    : { slug, locale, data: entryData, body }
  entryCache.set(filePath, { mtimeMs, size, entry })
  return copyEntry(entry)
}

// Every caller gets its own copy: a page that mutates entry.data must not
// change what the next page sees. (gray-matter caches parsed frontmatter by
// input string, so this could already leak before the cache existed.)
function copyEntry(entry: Entry): Entry {
  return { ...entry, data: structuredClone(entry.data) }
}
