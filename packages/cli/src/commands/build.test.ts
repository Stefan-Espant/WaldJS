import { describe, it, expect, beforeEach } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { buildPages } from './build.js'


let tmpDir: string

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'wald-build-'))
})

describe('buildPages', () => {
  it('generates dist/index.html from index.wald', async () => {
    const pagesDir = join(tmpDir, 'src', 'pages')
    const distDir = join(tmpDir, 'dist')
    mkdirSync(pagesDir, { recursive: true })
    writeFileSync(join(pagesDir, 'index.wald'), `---\nconst t = "Hi"\n---\n<h1>{t}</h1>`)

    await buildPages(pagesDir, distDir)

    const html = readFileSync(join(distDir, 'index.html'), 'utf8')
    expect(html).toContain('<h1>Hi</h1>')
    expect(html).toContain('<!DOCTYPE html>')
  })

  it('generates dist/about/index.html from about.wald', async () => {
    const pagesDir = join(tmpDir, 'src', 'pages')
    const distDir = join(tmpDir, 'dist')
    mkdirSync(pagesDir, { recursive: true })
    writeFileSync(join(pagesDir, 'about.wald'), '<p>About page</p>')

    await buildPages(pagesDir, distDir)

    const html = readFileSync(join(distDir, 'about', 'index.html'), 'utf8')
    expect(html).toContain('<p>About page</p>')
  })

  it('skips dynamic routes without throwing', async () => {
    const pagesDir = join(tmpDir, 'src', 'pages')
    const distDir = join(tmpDir, 'dist')
    mkdirSync(join(pagesDir, 'blog'), { recursive: true })
    writeFileSync(join(pagesDir, 'blog', '[slug].wald'), '<h1>Post</h1>')

    await buildPages(pagesDir, distDir)

    expect(existsSync(join(distDir, 'blog', '[slug]', 'index.html'))).toBe(false)
  })

  it('copies public/ to dist/ when it exists', async () => {
    const pagesDir = join(tmpDir, 'src', 'pages')
    const distDir = join(tmpDir, 'dist')
    const publicDir = join(tmpDir, 'public')
    mkdirSync(pagesDir, { recursive: true })
    mkdirSync(publicDir, { recursive: true })
    writeFileSync(join(pagesDir, 'index.wald'), '<p>home</p>')
    writeFileSync(join(publicDir, 'logo.svg'), '<svg/>')

    await buildPages(pagesDir, distDir, publicDir)

    expect(existsSync(join(distDir, 'logo.svg'))).toBe(true)
  })

  it('generates HTML for each path returned by getStaticPaths()', async () => {
    const pagesDir = join(tmpDir, 'src', 'pages')
    const distDir = join(tmpDir, 'dist')
    const contentDir = join(tmpDir, 'content')

    mkdirSync(join(pagesDir, 'blog'), { recursive: true })
    mkdirSync(join(contentDir, 'blog'), { recursive: true })

    writeFileSync(join(contentDir, 'blog', 'hello.md'), '---\ntitle: Hello\n---\nContent')
    writeFileSync(join(contentDir, 'blog', 'world.md'), '---\ntitle: World\n---\nContent')

    writeFileSync(
      join(pagesDir, 'blog', '[slug].wald'),
      [
        '---',
        "import { getCollection, getEntry } from 'wald:content'",
        'export async function getStaticPaths() {',
        "  const posts = await getCollection('blog')",
        '  return posts.map(p => ({ params: { slug: p.slug } }))',
        '}',
        "const post = await getEntry('blog', $$props.slug)",
        '---',
        '<h1>{post.data.title}</h1>',
      ].join('\n')
    )

    await buildPages(pagesDir, distDir, undefined, contentDir)

    expect(readFileSync(join(distDir, 'blog', 'hello', 'index.html'), 'utf8')).toContain('<h1>Hello</h1>')
    expect(readFileSync(join(distDir, 'blog', 'world', 'index.html'), 'utf8')).toContain('<h1>World</h1>')
  })
})
