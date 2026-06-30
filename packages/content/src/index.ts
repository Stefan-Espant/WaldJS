import { readdir, readFile } from 'node:fs/promises'
import { join, basename } from 'node:path'
import matter from 'gray-matter'
import { marked } from 'marked'

export type Entry = {
  slug: string
  data: Record<string, unknown>
  body: string
}

export async function readCollection(name: string, contentDir: string): Promise<Entry[]> {
  const dir = join(contentDir, name)
  const files = (await readdir(dir)).filter(f => f.endsWith('.md')).sort()
  return Promise.all(files.map(file => parseEntry(join(dir, file))))
}

export async function readEntry(collection: string, slug: string, contentDir: string): Promise<Entry> {
  const file = join(contentDir, collection, `${slug}.md`)
  return parseEntry(file)
}

async function parseEntry(filePath: string): Promise<Entry> {
  const raw = await readFile(filePath, 'utf8')
  const { data, content } = matter(raw)
  const body = await marked(content)
  const slug = basename(filePath, '.md')
  return { slug, data: data as Record<string, unknown>, body }
}
