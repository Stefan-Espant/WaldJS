import { describe, it, expect, beforeEach } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { readCollection, readEntry } from './index.js'

let contentDir: string

beforeEach(() => {
  contentDir = mkdtempSync(join(tmpdir(), 'wald-content-'))
  mkdirSync(join(contentDir, 'blog'))
})

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
