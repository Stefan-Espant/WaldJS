import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync, utimesSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

// Count how often a file is actually parsed.
const parses = vi.hoisted(() => ({ count: 0 }))
vi.mock('gray-matter', async (importOriginal) => {
  const actual = (await importOriginal<{ default: (...a: unknown[]) => unknown }>()).default
  return { default: (...args: unknown[]) => { parses.count++; return actual(...args) } }
})

const { readCollection, readEntry } = await import('./index.js')

let contentDir: string
beforeEach(() => {
  contentDir = mkdtempSync(join(tmpdir(), 'wald-content-cache-'))
  mkdirSync(join(contentDir, 'blog'))
  parses.count = 0
})

describe('content cache', () => {
  it('parses each unchanged file once across getCollection and getEntry calls', async () => {
    for (let i = 0; i < 5; i++) writeFileSync(join(contentDir, 'blog', `p${i}.md`), `---\ntitle: P${i}\n---\nBody ${i}`)
    await readCollection('blog', contentDir)
    for (let i = 0; i < 5; i++) await readEntry('blog', `p${i}`, contentDir)
    await readCollection('blog', contentDir)
    expect(parses.count).toBe(5)
  })

  it('re-parses a file after it changes', async () => {
    const file = join(contentDir, 'blog', 'post.md')
    writeFileSync(file, '---\ntitle: Old\n---\nBody')
    expect((await readEntry('blog', 'post', contentDir)).data.title).toBe('Old')
    writeFileSync(file, '---\ntitle: New and longer\n---\nBody')
    expect((await readEntry('blog', 'post', contentDir)).data.title).toBe('New and longer')
  })

  it('re-parses a same-size edit when the modification time changes', async () => {
    const file = join(contentDir, 'blog', 'post.md')
    writeFileSync(file, '---\ntitle: AAA\n---\nBody')
    utimesSync(file, new Date(2026, 0, 1), new Date(2026, 0, 1))
    expect((await readEntry('blog', 'post', contentDir)).data.title).toBe('AAA')
    writeFileSync(file, '---\ntitle: BBB\n---\nBody')
    utimesSync(file, new Date(2026, 0, 2), new Date(2026, 0, 2))
    expect((await readEntry('blog', 'post', contentDir)).data.title).toBe('BBB')
  })

  it('sees new files and new locale folders in a collection', async () => {
    writeFileSync(join(contentDir, 'blog', 'a.md'), '---\n---\nA')
    expect(await readCollection('blog', contentDir)).toHaveLength(1)
    writeFileSync(join(contentDir, 'blog', 'b.md'), '---\n---\nB')
    expect(await readCollection('blog', contentDir)).toHaveLength(2)
    mkdirSync(join(contentDir, 'blog', 'en'))
    writeFileSync(join(contentDir, 'blog', 'en', 'c.md'), '---\n---\nC')
    expect(await readCollection('blog', contentDir)).toHaveLength(3)
  })

  it('hands out copies, so one page mutating an entry cannot leak into the next', async () => {
    writeFileSync(join(contentDir, 'blog', 'post.md'), '---\ntitle: Original\n---\nBody')
    const first = await readEntry('blog', 'post', contentDir)
    first.data.title = 'Mutated'
    expect((await readEntry('blog', 'post', contentDir)).data.title).toBe('Original')
  })
})
