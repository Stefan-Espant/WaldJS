import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { readCollection, readEntry, readTranslations } from './index.js'

let root: string
const now = new Date('2026-11-09T12:00:00Z')

function write(path: string, fields = '') {
  const file = join(root, 'blog', path + '.md')
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, `---\ntitle: Test\n${fields}\n---\nBody`)
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(now)
  root = mkdtempSync(join(tmpdir(), 'wald-publishing-'))
})
afterEach(() => {
  vi.useRealTimers()
  rmSync(root, { recursive: true, force: true })
})

describe('drafts and scheduled publishing', () => {
  it('previews every entry but excludes drafts and future posts in production', async () => {
    write('published')
    write('draft', 'draft: true')
    write('scheduled', 'publishDate: 2026-11-10T12:00:00Z')
    write('past', 'publishDate: 2026-11-08')
    write('boundary', 'publishDate: "2026-11-09T12:00:00Z"')
    expect((await readCollection('blog', root)).map(entry => entry.slug))
      .toEqual(['boundary', 'draft', 'past', 'published', 'scheduled'])
    expect((await readCollection('blog', root, { production: true })).map(entry => entry.slug))
      .toEqual(['boundary', 'past', 'published'])
    await expect(readEntry('blog', 'draft', root, { production: true })).rejects.toThrow(/not published/)
    await expect(readEntry('blog', 'scheduled', root, { production: true })).rejects.toThrow(/not published/)
  })

  it('applies visibility to locales, individual entries and translations', async () => {
    write('nl/post', 'draft: true')
    write('en/post', 'publishDate: "2026-11-10T12:00:00Z"')
    write('en/visible', 'draft: false')
    expect(await readCollection('blog', root, { locale: 'nl', production: true })).toEqual([])
    expect((await readCollection('blog', root, { production: true })).map(entry => entry.slug)).toEqual(['visible'])
    expect(await readTranslations('blog', 'post', root, { production: true })).toEqual({})
    expect(Object.keys(await readTranslations('blog', 'post', root))).toEqual(['en', 'nl'])
    await expect(readEntry('blog', 'post', root, { locale: 'nl', production: true })).rejects.toThrow(/not published/)
    expect((await readEntry('blog', 'post', root, { locale: 'nl' })).data.draft).toBe(true)
  })

  it('re-evaluates a cached post when its publication time arrives', async () => {
    write('scheduled', 'publishDate: "2026-11-10T12:00:00Z"')
    expect(await readCollection('blog', root, { production: true })).toEqual([])
    vi.setSystemTime(new Date('2026-11-10T12:00:00Z'))
    expect((await readCollection('blog', root, { production: true })).map(entry => entry.slug)).toEqual(['scheduled'])
  })

  it.each(['not-a-date', '123', 'null'])('rejects invalid publishDate %s with the file name', async value => {
    write('invalid', `publishDate: ${value}`)
    await expect(readCollection('blog', root, { production: true })).rejects.toThrow(/invalid\.md.*publishDate/)
  })
})
