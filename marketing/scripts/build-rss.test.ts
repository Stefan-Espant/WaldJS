import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { execFileSync } from 'node:child_process'

describe('build-rss.mjs', () => {
  let root: string

  beforeAll(() => {
    root = mkdtempSync(join(tmpdir(), 'wald-rss-'))
    mkdirSync(join(root, 'content/blog/nl'), { recursive: true })
    mkdirSync(join(root, 'content/blog/en'), { recursive: true })
    mkdirSync(join(root, 'dist'), { recursive: true })
    writeFileSync(
      join(root, 'content/blog/nl/oud.md'),
      '---\ntitle: "Oud"\ndescription: "Eerste"\ndate: 2026-01-01\nauthor: "A"\ntags: [release]\n---\nx',
    )
    writeFileSync(
      join(root, 'content/blog/nl/nieuw.md'),
      '---\ntitle: "Nieuw & <beter>"\ndescription: "Tweede"\ndate: 2026-09-01\nauthor: "A"\n---\nx',
    )
    writeFileSync(
      join(root, 'content/blog/en/new.md'),
      '---\ntitle: "New"\ndescription: "Second"\ndate: 2026-09-01\nauthor: "A"\n---\nx',
    )
    execFileSync(process.execPath, [join(__dirname, 'build-rss.mjs'), root, 'https://example.com'], { stdio: 'pipe' })
  })

  afterAll(() => {
    rmSync(root, { recursive: true, force: true })
  })

  it('writes one RSS 2.0 feed per locale', () => {
    const nl = readFileSync(join(root, 'dist/blog/rss.xml'), 'utf-8')
    const en = readFileSync(join(root, 'dist/en/blog/rss.xml'), 'utf-8')
    expect(nl.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true)
    expect(nl).toContain('<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">')
    expect(nl).toContain('<language>nl</language>')
    expect(nl).toContain('<atom:link href="https://example.com/blog/rss.xml" rel="self" type="application/rss+xml"/>')
    expect(en).toContain('<language>en</language>')
    expect(en).toContain('<link>https://example.com/en/blog/new</link>')
  })

  it('orders items newest first and escapes XML', () => {
    const nl = readFileSync(join(root, 'dist/blog/rss.xml'), 'utf-8')
    expect(nl.indexOf('nieuw')).toBeLessThan(nl.indexOf('/blog/oud'))
    expect(nl).toContain('<title>Nieuw &amp; &lt;beter&gt;</title>')
    expect(nl).toContain('<guid isPermaLink="true">https://example.com/blog/oud</guid>')
    expect(nl).toContain('<pubDate>Thu, 01 Jan 2026 00:00:00 GMT</pubDate>')
    expect(nl).toContain('<category>release</category>')
  })
})
